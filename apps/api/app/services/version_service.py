"""Canonical immutable Shot version snapshots.

This slice restores the 5e86 baseline's Shot-field snapshot/accept/restore
semantics. Panel/assets/custom-field snapshots remain an explicit later parity
gate rather than being silently approximated here.
"""
from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.collaboration import AuditLog, ShotVersion
from app.models.shot import Shot
from app.models.user import User
from app.schemas.shot import ShotPatch
from app.schemas.version import ShotVersionCreate, ShotVersionRestore
from app.services.shot_service import ShotService


class VersionService:
    @staticmethod
    def _has_permission(user: User, permission: str) -> bool:
        permissions = getattr(getattr(user, "role", None), "permissions", None) or {}
        return bool(permissions.get("*") or permissions.get(permission))

    @staticmethod
    def _audit(
        db: AsyncSession,
        *,
        user_id: str,
        action: str,
        version_id: str,
        shot_id: str,
        metadata: dict | None = None,
    ) -> None:
        db.add(AuditLog(
            user_id=user_id,
            action=action,
            entity_type="shot_version",
            entity_id=version_id,
            metadata_json={"shot_id": shot_id, **(metadata or {})},
        ))

    @staticmethod
    async def _active_shot(db: AsyncSession, shot_id: str) -> Shot:
        result = await db.execute(
            select(Shot).where(Shot.id == shot_id, Shot.deleted_at.is_(None))
        )
        shot = result.scalar_one_or_none()
        if not shot:
            raise NotFoundError("镜头不存在")
        return shot

    @staticmethod
    def _snapshot(shot: Shot) -> dict:
        # Snapshot only canonical Shot data fields. System identity, ordering,
        # revision, ownership timestamps and deletion are never restorable.
        return {
            field: getattr(shot, field)
            for field in sorted(ShotService.PATCH_FIELDS)
        }

    @staticmethod
    async def _next_version_number(db: AsyncSession, shot_id: str) -> int:
        result = await db.execute(
            select(func.coalesce(func.max(ShotVersion.version_number), 0))
            .where(ShotVersion.shot_id == shot_id)
        )
        return int(result.scalar() or 0) + 1

    @staticmethod
    async def _create_snapshot_row(
        db: AsyncSession,
        *,
        shot: Shot,
        snapshot: dict,
        name: str,
        branch_name: str,
        parent_version_id: str | None,
        merge_parent_id: str | None,
        user_id: str,
    ) -> ShotVersion:
        number = await VersionService._next_version_number(db, shot.id)
        version = ShotVersion(
            shot_id=shot.id,
            version_number=number,
            name=name.strip()[:160] or f"快照 v{number:03d}",
            snapshot=snapshot,
            status="Draft",
            branch_name=branch_name.strip()[:64] or "main",
            parent_version_id=parent_version_id,
            merge_parent_id=merge_parent_id,
            is_accepted=False,
            created_by=user_id,
        )
        db.add(version)
        await db.flush()
        return version

    @staticmethod
    async def list_versions(db: AsyncSession, shot_id: str) -> list[ShotVersion]:
        await VersionService._active_shot(db, shot_id)
        result = await db.execute(
            select(ShotVersion)
            .where(ShotVersion.shot_id == shot_id)
            .order_by(ShotVersion.version_number.desc(), ShotVersion.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_version(
        db: AsyncSession,
        shot_id: str,
        req: ShotVersionCreate,
        user: User,
    ) -> ShotVersion:
        if not VersionService._has_permission(user, "shot.write"):
            raise DomainError("当前账号没有保存镜头版本的权限", code="FORBIDDEN")

        shot = await VersionService._active_shot(db, shot_id)
        parent_version_id = req.parent_version_id

        if parent_version_id:
            result = await db.execute(
                select(ShotVersion).where(
                    ShotVersion.id == parent_version_id,
                    ShotVersion.shot_id == shot_id,
                )
            )
            if not result.scalar_one_or_none():
                raise DomainError("父版本不存在或不属于当前镜头", code="INVALID_VERSION_PARENT")
        else:
            latest = await db.execute(
                select(ShotVersion)
                .where(
                    ShotVersion.shot_id == shot_id,
                    ShotVersion.branch_name == req.branch_name,
                )
                .order_by(ShotVersion.version_number.desc())
                .limit(1)
            )
            latest_version = latest.scalar_one_or_none()
            parent_version_id = latest_version.id if latest_version else None

        version = await VersionService._create_snapshot_row(
            db,
            shot=shot,
            snapshot=VersionService._snapshot(shot),
            name=req.name,
            branch_name=req.branch_name,
            parent_version_id=parent_version_id,
            merge_parent_id=None,
            user_id=user.id,
        )
        VersionService._audit(
            db,
            user_id=user.id,
            action="version.create",
            version_id=version.id,
            shot_id=shot.id,
            metadata={
                "version_number": version.version_number,
                "branch_name": version.branch_name,
                "parent_version_id": version.parent_version_id,
            },
        )
        await db.flush()
        return version

    @staticmethod
    async def accept_version(
        db: AsyncSession,
        version_id: str,
        user: User,
    ) -> ShotVersion:
        if not VersionService._has_permission(user, "review.approve"):
            raise DomainError("当前账号没有接受镜头版本的权限", code="FORBIDDEN")

        result = await db.execute(select(ShotVersion).where(ShotVersion.id == version_id))
        version = result.scalar_one_or_none()
        if not version:
            raise NotFoundError("版本不存在")
        await VersionService._active_shot(db, version.shot_id)

        await db.execute(
            update(ShotVersion)
            .where(ShotVersion.shot_id == version.shot_id)
            .values(is_accepted=False)
        )
        version.is_accepted = True
        version.status = "Accepted"

        VersionService._audit(
            db,
            user_id=user.id,
            action="version.accept",
            version_id=version.id,
            shot_id=version.shot_id,
            metadata={"version_number": version.version_number},
        )
        await db.flush()
        return version

    @staticmethod
    async def restore_version(
        db: AsyncSession,
        version_id: str,
        req: ShotVersionRestore,
        user: User,
    ) -> dict:
        if not VersionService._has_permission(user, "shot.write"):
            raise DomainError("当前账号没有恢复镜头版本的权限", code="FORBIDDEN")

        result = await db.execute(select(ShotVersion).where(ShotVersion.id == version_id))
        version = result.scalar_one_or_none()
        if not version:
            raise NotFoundError("版本不存在")

        shot = await VersionService._active_shot(db, version.shot_id)
        if shot.revision != req.revision:
            raise ConflictError(
                message="镜头已被其他用户修改，请刷新后再恢复版本。",
                details={
                    "shot_id": shot.id,
                    "server_revision": shot.revision,
                    "client_revision": req.revision,
                },
            )

        snapshot = version.snapshot if isinstance(version.snapshot, dict) else {}
        changes = {
            field: snapshot[field]
            for field in ShotService.PATCH_FIELDS
            if field in snapshot and getattr(shot, field) != snapshot[field]
        }
        if not changes:
            return {
                "changed": False,
                "shot_id": shot.id,
                "revision": shot.revision,
                "restored_version_id": version.id,
                "backup_version_id": None,
            }

        backup = await VersionService._create_snapshot_row(
            db,
            shot=shot,
            snapshot=VersionService._snapshot(shot),
            name="回滚前备份",
            branch_name=version.branch_name or "main",
            parent_version_id=version.id,
            merge_parent_id=None,
            user_id=user.id,
        )

        saved = await ShotService.patch_shot(
            db,
            shot.id,
            ShotPatch(revision=req.revision, changes=changes),
            user.id,
        )

        VersionService._audit(
            db,
            user_id=user.id,
            action="version.restore",
            version_id=version.id,
            shot_id=shot.id,
            metadata={
                "version_number": version.version_number,
                "backup_version_id": backup.id,
                "revision": saved.revision,
                "changed_fields": sorted(changes),
            },
        )
        await db.flush()

        return {
            "changed": True,
            "shot_id": saved.id,
            "revision": saved.revision,
            "restored_version_id": version.id,
            "backup_version_id": backup.id,
        }
