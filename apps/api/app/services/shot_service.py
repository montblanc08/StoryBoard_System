import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.models.production import Production
from app.models.shot import Panel, Shot
from app.schemas.shot import ShotCreate, ShotPatch

class ShotService:
    @staticmethod
    async def create_shot(db: AsyncSession, production_id: str, req: ShotCreate, user_id: str) -> Shot:
        # Verify production
        p_res = await db.execute(select(Production).where(Production.id == production_id, Production.deleted_at.is_(None)))
        if not p_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "项目不存在"})

        # Get max sort index
        max_res = await db.execute(
            select(func.coalesce(func.max(Shot.sort_index), 0.0)).where(Shot.production_id == production_id)
        )
        max_sort = max_res.scalar() or 0.0
        new_sort = max_sort + 1000.0

        sid = str(uuid.uuid4())
        shot = Shot(
            id=sid,
            production_id=production_id,
            sequence_id=req.sequence_id,
            scene_id=req.scene_id,
            display_number=req.display_number,
            sort_index=new_sort,
            name=req.name,
            description=req.description,
            action=req.action,
            performance=req.performance,
            composition=req.composition,
            director_notes=req.director_notes,
            duration_frames=req.duration_frames,
            timing_locked=req.timing_locked,
            shot_size=req.shot_size,
            camera_angle=req.camera_angle,
            camera_height=req.camera_height,
            lens_mm=req.lens_mm,
            camera=req.camera,
            camera_movement=req.camera_movement or {"type": req.movement or "固定"},
            voice_over=req.voice_over,
            dialogue=req.dialogue,
            primary_method=req.primary_method,
            secondary_methods=req.secondary_methods,
            department=req.department,
            owner_id=req.owner_id,
            status=req.status,
            revision=1,
            created_by=user_id
        )
        db.add(shot)

        # Add default panel
        panel = Panel(
            id=str(uuid.uuid4()),
            shot_id=sid,
            display_number="A",
            sort_index=1000.0,
            duration_frames=req.duration_frames
        )
        db.add(panel)
        await db.flush()

        return shot

    @staticmethod
    async def patch_shot(db: AsyncSession, shot_id: str, req: ShotPatch, user_id: str) -> Shot:
        result = await db.execute(select(Shot).where(Shot.id == shot_id, Shot.deleted_at.is_(None)))
        shot = result.scalar_one_or_none()
        if not shot:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "镜头不存在"})

        # Optimistic Concurrency Control (Spec Section 107-108)
        if shot.revision != req.revision:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "SHOT_REVISION_CONFLICT",
                    "message": "该镜头已被其他用户修改，请刷新并核对最新版本。",
                    "details": {
                        "server_revision": shot.revision,
                        "client_revision": req.revision
                    }
                }
            )

        changed = False
        for field, val in req.changes.items():
            if hasattr(shot, field) and field not in ("id", "production_id", "revision", "created_at"):
                current_val = getattr(shot, field)
                if current_val != val:
                    setattr(shot, field, val)
                    changed = True

        if changed:
            shot.revision += 1
            shot.updated_at = datetime.now(timezone.utc)
            await db.flush()

        return shot
