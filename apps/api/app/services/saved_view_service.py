"""Canonical saved-view persistence and revision handling."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.collaboration import AuditLog
from app.models.production import Production
from app.models.user import User
from app.models.view import SavedView
from app.schemas.saved_view import SavedViewCreate, SavedViewUpdate


class SavedViewService:
    @staticmethod
    def _has_permission(user: User, permission: str) -> bool:
        permissions = getattr(getattr(user, "role", None), "permissions", None) or {}
        return bool(permissions.get("*") or permissions.get(permission))

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
    def _require_write(user: User) -> None:
        if not SavedViewService._has_permission(user, "shot.write"):
            raise DomainError("当前账号没有保存项目视图的权限", code="FORBIDDEN")

    @staticmethod
    def _audit(
        db: AsyncSession,
        *,
        user_id: str,
        action: str,
        view_id: str,
        production_id: str,
        metadata: dict | None = None,
    ) -> None:
        db.add(AuditLog(
            user_id=user_id,
            action=action,
            entity_type="saved_view",
            entity_id=view_id,
            metadata_json={"production_id": production_id, **(metadata or {})},
        ))

    @staticmethod
    async def list_views(
        db: AsyncSession,
        production_id: str,
        user: User,
    ) -> list[SavedView]:
        await SavedViewService._production(db, production_id)
        result = await db.execute(
            select(SavedView)
            .where(
                SavedView.production_id == production_id,
                (SavedView.is_shared.is_(True)) | (SavedView.created_by == user.id),
            )
            .order_by(SavedView.created_at.asc(), SavedView.id.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_view(
        db: AsyncSession,
        production_id: str,
        req: SavedViewCreate,
        user: User,
    ) -> SavedView:
        SavedViewService._require_write(user)
        await SavedViewService._production(db, production_id)

        name = req.name.strip()
        if not name:
            raise DomainError("视图名称不能为空", code="VALIDATION_ERROR")

        view = SavedView(
            production_id=production_id,
            name=name,
            view_type=req.view_type,
            is_shared=req.is_shared,
            created_by=user.id,
            config=req.config,
            revision=1,
        )
        db.add(view)
        await db.flush()
        SavedViewService._audit(
            db,
            user_id=user.id,
            action="saved_view.create",
            view_id=view.id,
            production_id=production_id,
            metadata={"name": view.name, "view_type": view.view_type},
        )
        await db.flush()
        return view

    @staticmethod
    async def update_view(
        db: AsyncSession,
        production_id: str,
        view_id: str,
        req: SavedViewUpdate,
        user: User,
    ) -> SavedView:
        SavedViewService._require_write(user)
        await SavedViewService._production(db, production_id)

        result = await db.execute(
            select(SavedView).where(
                SavedView.id == view_id,
                SavedView.production_id == production_id,
            )
        )
        view = result.scalar_one_or_none()
        if not view:
            raise NotFoundError("保存视图不存在")
        if not view.is_shared and view.created_by != user.id and not SavedViewService._has_permission(user, "review.approve"):
            raise DomainError("无权修改其他用户的私有视图", code="FORBIDDEN")

        if view.revision != req.revision:
            raise ConflictError(
                message="保存视图已被其他用户修改，请刷新后重试。",
                details={
                    "saved_view_id": view.id,
                    "server_revision": view.revision,
                    "client_revision": req.revision,
                },
            )

        changed: list[str] = []
        if req.name is not None:
            name = req.name.strip()
            if not name:
                raise DomainError("视图名称不能为空", code="VALIDATION_ERROR")
            if view.name != name:
                view.name = name
                changed.append("name")
        if req.is_shared is not None and view.is_shared != req.is_shared:
            view.is_shared = req.is_shared
            changed.append("is_shared")
        if req.config is not None and view.config != req.config:
            view.config = req.config
            changed.append("config")

        if not changed:
            return view

        view.revision += 1
        view.updated_at = datetime.now(timezone.utc)
        SavedViewService._audit(
            db,
            user_id=user.id,
            action="saved_view.update",
            view_id=view.id,
            production_id=production_id,
            metadata={"changed_fields": changed, "revision": view.revision},
        )
        await db.flush()
        return view

    @staticmethod
    async def delete_view(
        db: AsyncSession,
        production_id: str,
        view_id: str,
        user: User,
    ) -> bool:
        SavedViewService._require_write(user)
        await SavedViewService._production(db, production_id)

        result = await db.execute(
            select(SavedView).where(
                SavedView.id == view_id,
                SavedView.production_id == production_id,
            )
        )
        view = result.scalar_one_or_none()
        if not view:
            return False
        if not view.is_shared and view.created_by != user.id and not SavedViewService._has_permission(user, "review.approve"):
            raise DomainError("无权删除其他用户的私有视图", code="FORBIDDEN")

        SavedViewService._audit(
            db,
            user_id=user.id,
            action="saved_view.delete",
            view_id=view.id,
            production_id=production_id,
            metadata={"name": view.name},
        )
        await db.delete(view)
        await db.flush()
        return True
