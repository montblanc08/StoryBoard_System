"""Canonical custom-field lifecycle.

The irreversible invariant is deliberate: a purged column keeps an immutable
definition/preference tombstone. Old Saved Views, browser caches or import
mappings may still mention the key, but they cannot recreate the field.
"""
from __future__ import annotations

import copy
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.collaboration import AuditLog
from app.models.field import ColumnPreference, CustomFieldDefinition, ShotCustomFieldValue
from app.models.production import Production
from app.models.shot import Shot
from app.models.user import User
from app.models.view import SavedView
from app.schemas.custom_field import (
    CustomFieldCreate,
    CustomFieldPurgeRequest,
    CustomFieldStateUpdate,
    CustomFieldUpdate,
    CustomFieldValuePatch,
)


class CustomFieldService:
    FIELD_TYPES = {"text", "textarea", "number", "boolean", "date", "url", "select"}
    COLUMN_STATES = {"visible", "hidden", "removed"}

    @staticmethod
    def _has_permission(user: User, permission: str) -> bool:
        permissions = getattr(getattr(user, "role", None), "permissions", None) or {}
        return bool(permissions.get("*") or permissions.get(permission))

    @staticmethod
    def _require_write(user: User) -> None:
        if not CustomFieldService._has_permission(user, "shot.write"):
            raise DomainError("当前账号没有修改自定义列的权限", code="FORBIDDEN")

    @staticmethod
    async def _production(db: AsyncSession, production_id: str) -> Production:
        result = await db.execute(
            select(Production).where(
                Production.id == production_id,
                Production.deleted_at.is_(None),
            )
        )
        production = result.scalar_one_or_none()
        if not production:
            raise NotFoundError("项目不存在")
        return production

    @staticmethod
    async def _field(
        db: AsyncSession,
        production_id: str,
        field_id: str,
        *,
        for_update: bool = False,
        include_purged: bool = False,
    ) -> CustomFieldDefinition:
        query = select(CustomFieldDefinition).where(
            CustomFieldDefinition.id == field_id,
            CustomFieldDefinition.production_id == production_id,
        )
        if not include_purged:
            query = query.where(CustomFieldDefinition.is_purged.is_(False))
        if for_update:
            query = query.with_for_update()

        result = await db.execute(query)
        field = result.scalar_one_or_none()
        if not field:
            raise NotFoundError("自定义列不存在")
        return field

    @staticmethod
    async def _preference(
        db: AsyncSession,
        production_id: str,
        column_key: str,
        *,
        for_update: bool = False,
    ) -> ColumnPreference | None:
        query = select(ColumnPreference).where(
            ColumnPreference.production_id == production_id,
            ColumnPreference.column_key == column_key,
        )
        if for_update:
            query = query.with_for_update()
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    def _column_key(field: CustomFieldDefinition) -> str:
        return f"custom:{field.key}"

    @staticmethod
    def _audit(
        db: AsyncSession,
        *,
        user_id: str,
        action: str,
        field_id: str,
        production_id: str,
        metadata: dict | None = None,
    ) -> None:
        db.add(AuditLog(
            user_id=user_id,
            action=action,
            entity_type="custom_field",
            entity_id=field_id,
            metadata_json={"production_id": production_id, **(metadata or {})},
        ))

    @staticmethod
    def _normalize_key(raw: str | None) -> str:
        if raw is None or not raw.strip():
            return f"field_{uuid.uuid4().hex[:10]}"
        key = raw.strip().lower().replace("-", "_").replace(" ", "_")
        key = re.sub(r"[^a-z0-9_]", "", key)
        key = re.sub(r"_+", "_", key).strip("_")
        if not key:
            raise DomainError(
                "自定义列键只能包含英文小写字母、数字和下划线",
                code="INVALID_FIELD_KEY",
            )
        if key[0].isdigit():
            key = f"field_{key}"
        return key[:80]

    @staticmethod
    def _normalize_options(options: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in options:
            value = str(item).strip()[:120]
            if value and value not in seen:
                normalized.append(value)
                seen.add(value)
        if len(normalized) > 100:
            raise DomainError("自定义列选项过多", code="VALIDATION_ERROR")
        return normalized

    @staticmethod
    def _normalize_value(
        field_type: str,
        value: Any,
        options: list[str],
    ) -> Any:
        if value is None:
            return None

        if field_type in {"text", "textarea", "date", "url"}:
            text = str(value)
            max_length = 10000 if field_type == "textarea" else 2000
            if len(text) > max_length:
                raise DomainError("自定义列内容过长", code="VALIDATION_ERROR")
            return text

        if field_type == "number":
            if isinstance(value, bool):
                raise DomainError("数值列不能写入布尔值", code="VALIDATION_ERROR")
            if isinstance(value, (int, float)):
                return value
            try:
                number = float(str(value).strip())
            except (TypeError, ValueError):
                raise DomainError("数值列内容格式无效", code="VALIDATION_ERROR")
            return int(number) if number.is_integer() else number

        if field_type == "boolean":
            if not isinstance(value, bool):
                raise DomainError("布尔列只能写入 true/false", code="VALIDATION_ERROR")
            return value

        if field_type == "select":
            selected = str(value)
            if selected not in options:
                raise DomainError("选择值不在自定义列选项中", code="VALIDATION_ERROR")
            return selected

        raise DomainError("不支持的自定义列类型", code="INVALID_FIELD_TYPE")

    @staticmethod
    async def _projection(
        db: AsyncSession,
        fields: list[CustomFieldDefinition],
    ) -> list[dict]:
        if not fields:
            return []

        production_id = fields[0].production_id
        result = await db.execute(
            select(ColumnPreference).where(
                ColumnPreference.production_id == production_id,
                ColumnPreference.column_key.in_(
                    [CustomFieldService._column_key(field) for field in fields]
                ),
            )
        )
        preferences = {item.column_key: item for item in result.scalars().all()}

        rows: list[dict] = []
        for field in fields:
            column_key = CustomFieldService._column_key(field)
            preference = preferences.get(column_key)
            rows.append({
                "id": field.id,
                "production_id": field.production_id,
                "key": field.key,
                "column_key": column_key,
                "label": field.label,
                "description": field.description,
                "field_type": field.field_type,
                "group_name": field.group_name,
                "options": list(field.options or []),
                "required": field.required,
                "default_value": field.default_value,
                "sort_index": field.sort_index,
                "state": preference.state if preference else "visible",
                "permanently_deleted": (
                    bool(preference.permanently_deleted) if preference else field.is_purged
                ),
                "position": preference.position if preference else field.sort_index,
                "width_px": preference.width_px if preference else 180,
                "wrap_text": preference.wrap_text if preference else field.field_type == "textarea",
                "revision": field.revision,
                "created_by": field.created_by,
                "created_at": field.created_at,
                "updated_at": field.updated_at,
            })
        return rows

    @staticmethod
    async def list_fields(
        db: AsyncSession,
        production_id: str,
    ) -> list[dict]:
        await CustomFieldService._production(db, production_id)
        result = await db.execute(
            select(CustomFieldDefinition)
            .where(
                CustomFieldDefinition.production_id == production_id,
                CustomFieldDefinition.is_purged.is_(False),
            )
            .order_by(
                CustomFieldDefinition.sort_index.asc(),
                CustomFieldDefinition.created_at.asc(),
                CustomFieldDefinition.id.asc(),
            )
        )
        return await CustomFieldService._projection(db, list(result.scalars().all()))

    @staticmethod
    async def create_field(
        db: AsyncSession,
        production_id: str,
        req: CustomFieldCreate,
        user: User,
    ) -> dict:
        CustomFieldService._require_write(user)
        await CustomFieldService._production(db, production_id)

        label = req.label.strip()
        if not label:
            raise DomainError("自定义列名称不能为空", code="VALIDATION_ERROR")

        key = CustomFieldService._normalize_key(req.key)
        existing_result = await db.execute(
            select(CustomFieldDefinition).where(
                CustomFieldDefinition.production_id == production_id,
                CustomFieldDefinition.key == key,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            if existing.is_purged:
                raise DomainError(
                    "该列键已被永久删除，不能由旧配置或新建操作重新激活",
                    code="FIELD_KEY_PURGED",
                )
            raise DomainError("该自定义列键已存在", code="FIELD_KEY_EXISTS")

        options = CustomFieldService._normalize_options(req.options)
        if req.field_type != "select":
            options = []
        elif not options:
            raise DomainError("选择列至少需要一个选项", code="VALIDATION_ERROR")

        default_value = CustomFieldService._normalize_value(
            req.field_type,
            req.default_value,
            options,
        )

        max_sort_result = await db.execute(
            select(func.coalesce(func.max(CustomFieldDefinition.sort_index), 0)).where(
                CustomFieldDefinition.production_id == production_id,
                CustomFieldDefinition.is_purged.is_(False),
            )
        )
        sort_index = int(max_sort_result.scalar() or 0) + 100

        field = CustomFieldDefinition(
            production_id=production_id,
            key=key,
            label=label,
            description=req.description.strip(),
            field_type=req.field_type,
            group_name=req.group_name.strip() or "Custom",
            options=options,
            required=req.required,
            default_value=default_value,
            sort_index=sort_index,
            is_active=True,
            is_purged=False,
            created_by=user.id,
            revision=1,
        )
        db.add(field)
        await db.flush()

        preference = ColumnPreference(
            production_id=production_id,
            column_key=CustomFieldService._column_key(field),
            state="visible",
            permanently_deleted=False,
            position=sort_index,
            width_px=220 if req.field_type == "textarea" else 180,
            wrap_text=req.field_type == "textarea",
            updated_by=user.id,
            revision=1,
        )
        db.add(preference)

        CustomFieldService._audit(
            db,
            user_id=user.id,
            action="custom_field.create",
            field_id=field.id,
            production_id=production_id,
            metadata={"key": field.key, "field_type": field.field_type},
        )
        await db.flush()
        return (await CustomFieldService._projection(db, [field]))[0]

    @staticmethod
    async def update_field(
        db: AsyncSession,
        production_id: str,
        field_id: str,
        req: CustomFieldUpdate,
        user: User,
    ) -> dict:
        CustomFieldService._require_write(user)
        field = await CustomFieldService._field(
            db,
            production_id,
            field_id,
            for_update=True,
        )

        if field.revision != req.revision:
            raise ConflictError(
                message="自定义列已被其他用户修改，请刷新后重试。",
                details={
                    "field_id": field.id,
                    "server_revision": field.revision,
                    "client_revision": req.revision,
                },
            )

        changed: list[str] = []
        if req.label is not None:
            label = req.label.strip()
            if not label:
                raise DomainError("自定义列名称不能为空", code="VALIDATION_ERROR")
            if field.label != label:
                field.label = label
                changed.append("label")

        if req.description is not None:
            description = req.description.strip()
            if field.description != description:
                field.description = description
                changed.append("description")

        if req.group_name is not None:
            group_name = req.group_name.strip() or "Custom"
            if field.group_name != group_name:
                field.group_name = group_name
                changed.append("group_name")

        next_options = list(field.options or [])
        if req.options is not None:
            next_options = CustomFieldService._normalize_options(req.options)
            if field.field_type != "select":
                next_options = []
            elif not next_options:
                raise DomainError("选择列至少需要一个选项", code="VALIDATION_ERROR")

            if field.field_type == "select" and next_options != list(field.options or []):
                values_result = await db.execute(
                    select(ShotCustomFieldValue.value).where(
                        ShotCustomFieldValue.field_definition_id == field.id
                    )
                )
                used = {
                    value
                    for value in values_result.scalars().all()
                    if value is not None
                }
                removed_in_use = sorted(
                    str(value) for value in used if value not in next_options
                )
                if removed_in_use:
                    raise DomainError(
                        "不能删除仍被镜头使用的选项：" + "、".join(removed_in_use[:10]),
                        code="FIELD_OPTION_IN_USE",
                    )

            if list(field.options or []) != next_options:
                field.options = next_options
                changed.append("options")

        if req.required is not None and field.required != req.required:
            field.required = req.required
            changed.append("required")

        if req.default_value_set:
            next_default = CustomFieldService._normalize_value(
                field.field_type,
                req.default_value,
                next_options,
            )
            if field.default_value != next_default:
                field.default_value = next_default
                changed.append("default_value")

        if changed:
            field.revision += 1
            field.updated_at = datetime.now(timezone.utc)
            CustomFieldService._audit(
                db,
                user_id=user.id,
                action="custom_field.update",
                field_id=field.id,
                production_id=production_id,
                metadata={"changed_fields": changed, "revision": field.revision},
            )
            await db.flush()

        return (await CustomFieldService._projection(db, [field]))[0]

    @staticmethod
    async def set_state(
        db: AsyncSession,
        production_id: str,
        field_id: str,
        req: CustomFieldStateUpdate,
        user: User,
    ) -> dict:
        CustomFieldService._require_write(user)
        field = await CustomFieldService._field(
            db,
            production_id,
            field_id,
            for_update=True,
        )
        if field.revision != req.revision:
            raise ConflictError(
                message="自定义列已被其他用户修改，请刷新后重试。",
                details={
                    "field_id": field.id,
                    "server_revision": field.revision,
                    "client_revision": req.revision,
                },
            )

        column_key = CustomFieldService._column_key(field)
        preference = await CustomFieldService._preference(
            db,
            production_id,
            column_key,
            for_update=True,
        )
        if preference and preference.permanently_deleted:
            raise DomainError(
                "永久删除的列不能重新显示或恢复",
                code="FIELD_PERMANENTLY_DELETED",
            )

        if not preference:
            preference = ColumnPreference(
                production_id=production_id,
                column_key=column_key,
                state="visible",
                permanently_deleted=False,
                position=field.sort_index,
                width_px=220 if field.field_type == "textarea" else 180,
                wrap_text=field.field_type == "textarea",
                updated_by=user.id,
                revision=1,
            )
            db.add(preference)
            await db.flush()

        if preference.state == req.state:
            return (await CustomFieldService._projection(db, [field]))[0]

        preference.state = req.state
        preference.updated_by = user.id
        preference.revision += 1
        preference.updated_at = datetime.now(timezone.utc)
        field.revision += 1
        field.updated_at = preference.updated_at

        CustomFieldService._audit(
            db,
            user_id=user.id,
            action={
                "visible": "custom_field.restore",
                "hidden": "custom_field.hide",
                "removed": "custom_field.archive",
            }[req.state],
            field_id=field.id,
            production_id=production_id,
            metadata={
                "column_key": column_key,
                "state": req.state,
                "revision": field.revision,
            },
        )
        await db.flush()
        return (await CustomFieldService._projection(db, [field]))[0]

    @staticmethod
    def _sanitize_saved_view_config(
        config: dict,
        *,
        column_key: str,
    ) -> tuple[dict, bool]:
        next_config = copy.deepcopy(config)
        changed = False

        def remove_from_list(container: dict, key: str) -> None:
            nonlocal changed
            value = container.get(key)
            if isinstance(value, list):
                filtered = [item for item in value if item != column_key]
                if filtered != value:
                    container[key] = filtered
                    changed = True

        def remove_from_map(container: dict, key: str) -> None:
            nonlocal changed
            value = container.get(key)
            if isinstance(value, dict) and column_key in value:
                value = dict(value)
                value.pop(column_key, None)
                container[key] = value
                changed = True

        presentation = next_config.get("presentation")
        if isinstance(presentation, dict):
            for key in ("columnOrder", "hiddenColumns", "visibleColumns", "columns"):
                remove_from_list(presentation, key)
            for key in ("columnWidths", "widths"):
                remove_from_map(presentation, key)

        custom_columns = next_config.get("customColumns")
        if isinstance(custom_columns, dict):
            for key in ("order", "hidden", "visible", "columns"):
                remove_from_list(custom_columns, key)
            for key in ("widths", "columnWidths"):
                remove_from_map(custom_columns, key)

        sort_config = next_config.get("sort")
        if isinstance(sort_config, dict) and sort_config.get("key") == column_key:
            sort_config = dict(sort_config)
            sort_config["key"] = "default"
            sort_config["direction"] = "asc"
            next_config["sort"] = sort_config
            changed = True

        return next_config, changed

    @staticmethod
    async def purge_field(
        db: AsyncSession,
        production_id: str,
        field_id: str,
        req: CustomFieldPurgeRequest,
        user: User,
    ) -> bool:
        CustomFieldService._require_write(user)
        field = await CustomFieldService._field(
            db,
            production_id,
            field_id,
            for_update=True,
            include_purged=True,
        )
        if field.is_purged:
            return False
        if field.revision != req.revision:
            raise ConflictError(
                message="自定义列已被其他用户修改，请刷新后重试。",
                details={
                    "field_id": field.id,
                    "server_revision": field.revision,
                    "client_revision": req.revision,
                },
            )

        column_key = CustomFieldService._column_key(field)
        preference = await CustomFieldService._preference(
            db,
            production_id,
            column_key,
            for_update=True,
        )
        if not preference or preference.state != "removed":
            raise DomainError(
                "只能永久删除已归档的自定义列",
                code="FIELD_NOT_ARCHIVED",
            )

        await db.execute(
            delete(ShotCustomFieldValue).where(
                ShotCustomFieldValue.field_definition_id == field.id
            )
        )

        now = datetime.now(timezone.utc)
        field.is_active = False
        field.is_purged = True
        field.revision += 1
        field.updated_at = now

        preference.state = "removed"
        preference.permanently_deleted = True
        preference.updated_by = user.id
        preference.revision += 1
        preference.updated_at = now

        views_result = await db.execute(
            select(SavedView).where(SavedView.production_id == production_id)
        )
        for view in views_result.scalars().all():
            config = view.config if isinstance(view.config, dict) else {}
            sanitized, changed = CustomFieldService._sanitize_saved_view_config(
                config,
                column_key=column_key,
            )
            if changed:
                view.config = sanitized
                view.revision += 1
                view.updated_at = now

        CustomFieldService._audit(
            db,
            user_id=user.id,
            action="custom_field.purge",
            field_id=field.id,
            production_id=production_id,
            metadata={
                "key": field.key,
                "column_key": column_key,
                "revision": field.revision,
            },
        )
        await db.flush()
        return True

    @staticmethod
    async def value_matrix(
        db: AsyncSession,
        production_id: str,
    ) -> dict:
        await CustomFieldService._production(db, production_id)

        field_result = await db.execute(
            select(CustomFieldDefinition.id).where(
                CustomFieldDefinition.production_id == production_id,
                CustomFieldDefinition.is_purged.is_(False),
            )
        )
        field_ids = set(field_result.scalars().all())
        if not field_ids:
            return {"values": {}}

        rows_result = await db.execute(
            select(ShotCustomFieldValue).where(
                ShotCustomFieldValue.field_definition_id.in_(field_ids)
            )
        )
        values: dict[str, dict[str, Any]] = {}
        for row in rows_result.scalars().all():
            values.setdefault(row.shot_id, {})[row.field_definition_id] = row.value
        return {"values": values}

    @staticmethod
    async def patch_value(
        db: AsyncSession,
        shot_id: str,
        field_id: str,
        req: CustomFieldValuePatch,
        user: User,
    ) -> dict:
        CustomFieldService._require_write(user)

        shot_result = await db.execute(
            select(Shot)
            .where(Shot.id == shot_id, Shot.deleted_at.is_(None))
            .with_for_update()
        )
        shot = shot_result.scalar_one_or_none()
        if not shot:
            raise NotFoundError("镜头不存在")

        field = await CustomFieldService._field(
            db,
            shot.production_id,
            field_id,
        )
        preference = await CustomFieldService._preference(
            db,
            shot.production_id,
            CustomFieldService._column_key(field),
        )
        if preference and preference.state == "removed":
            raise DomainError("归档列不能继续写入", code="FIELD_ARCHIVED")
        if preference and preference.permanently_deleted:
            raise DomainError("永久删除的列不能继续写入", code="FIELD_PERMANENTLY_DELETED")

        if shot.revision != req.revision:
            raise ConflictError(
                message="镜头已被其他用户修改，请刷新后重试。",
                details={
                    "shot_id": shot.id,
                    "server_revision": shot.revision,
                    "client_revision": req.revision,
                },
            )

        normalized = CustomFieldService._normalize_value(
            field.field_type,
            req.value,
            list(field.options or []),
        )

        value_result = await db.execute(
            select(ShotCustomFieldValue).where(
                ShotCustomFieldValue.shot_id == shot.id,
                ShotCustomFieldValue.field_definition_id == field.id,
            )
        )
        value_row = value_result.scalar_one_or_none()
        effective_current = (
            value_row.value if value_row is not None else field.default_value
        )

        if effective_current == normalized and (
            value_row is not None or normalized == field.default_value
        ):
            return {
                "changed": False,
                "shot_id": shot.id,
                "field_id": field.id,
                "value": normalized,
                "revision": shot.revision,
            }

        if normalized is None:
            if value_row is not None:
                await db.delete(value_row)
        elif value_row is None:
            db.add(ShotCustomFieldValue(
                shot_id=shot.id,
                field_definition_id=field.id,
                value=normalized,
                updated_by=user.id,
            ))
        else:
            value_row.value = normalized
            value_row.updated_by = user.id
            value_row.updated_at = datetime.now(timezone.utc)

        shot.revision += 1
        shot.updated_at = datetime.now(timezone.utc)
        db.add(AuditLog(
            user_id=user.id,
            action="shot.custom_field.patch",
            entity_type="shot",
            entity_id=shot.id,
            metadata_json={
                "field_id": field.id,
                "field_key": field.key,
                "revision": shot.revision,
            },
        ))
        await db.flush()

        return {
            "changed": True,
            "shot_id": shot.id,
            "field_id": field.id,
            "value": normalized,
            "revision": shot.revision,
        }
