"""Shot API Routes with Revision Optimistic Concurrency and Transactional Reordering."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.models.production import Production
from app.models.shot import Panel, ProductionStep, Shot
from app.models.user import User
from app.schemas.shot import (
    BulkUpdateShotsRequest,
    ShotCreate,
    ShotOut,
    ShotPatch,
    ShotReorderRequest
)
from app.services.shot_service import ShotService
from app.core.exceptions import DomainError, NotFoundError, ConflictError

router = APIRouter(tags=["Shots"])


@router.get("/productions/{production_id}/shots", response_model=list[ShotOut])
async def list_production_shots(
    production_id: str,
    sequence_id: Optional[str] = Query(None),
    primary_method: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Shot)
        .where(Shot.production_id == production_id, Shot.deleted_at.is_(None))
        .order_by(Shot.sort_index.asc(), Shot.display_number.asc())
    )
    if sequence_id:
        query = query.where(Shot.sequence_id == sequence_id)
    if primary_method:
        query = query.where(Shot.primary_method == primary_method)
    if department:
        query = query.where(Shot.department == department)
    if status_filter:
        query = query.where(Shot.status == status_filter)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/productions/{production_id}/shots", response_model=ShotOut, status_code=status.HTTP_201_CREATED)
async def create_shot(
    production_id: str,
    req: ShotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        shot = await ShotService.create_shot(db, production_id, req, current_user.id)
        return shot
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": e.message})
    except DomainError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.patch("/shots/{id}", response_model=ShotOut)
async def patch_shot(
    id: str,
    req: ShotPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        shot = await ShotService.patch_shot(db, id, req, current_user.id)
        return shot
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": e.message})
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": "SHOT_REVISION_CONFLICT", "message": e.message, "details": e.details})
    except DomainError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.delete("/shots/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shot(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Shot).where(Shot.id == id, Shot.deleted_at.is_(None)))
    shot = result.scalar_one_or_none()
    if shot:
        shot.deleted_at = datetime.now(timezone.utc)
        await db.flush()
    return None


@router.post("/shots/{id}/restore", status_code=status.HTTP_200_OK)
async def restore_shot(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Restore a soft-deleted shot."""
    result = await db.execute(select(Shot).where(Shot.id == id, Shot.deleted_at.is_not(None)))
    shot = result.scalar_one_or_none()
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found in trash")
    shot.deleted_at = None
    # Bump revision to notify clients of state change
    shot.revision += 1
    await db.flush()
    return {"ok": True, "id": id}


@router.delete("/shots/{id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_shot(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a shot."""
    result = await db.execute(select(Shot).where(Shot.id == id, Shot.deleted_at.is_not(None)))
    shot = result.scalar_one_or_none()
    if shot:
        await db.delete(shot)
        await db.flush()
    return None


@router.get("/productions/{production_id}/shots/trash", response_model=list[dict])
async def list_trash_shots(
    production_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List soft-deleted shots for a production. Retention cleanup is not implemented here."""
    result = await db.execute(
        select(Shot).where(
            Shot.production_id == production_id,
            Shot.deleted_at.is_not(None)
        ).order_by(Shot.deleted_at.desc())
    )
    shots = result.scalars().all()
    # Simple dict serialization
    return [
        {
            "id": s.id,
            "display_number": s.display_number,
            "name": s.name,
            "deleted_at": s.deleted_at.isoformat() if s.deleted_at else None
        }
        for s in shots
    ]


@router.post("/shots/reorder", status_code=status.HTTP_200_OK)
async def reorder_shots(
    req: ShotReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Transactional numeric reorder (Spec Section 46-47)."""
    for item in req.items:
        await db.execute(
            update(Shot)
            .where(Shot.id == item.id)
            .values(sort_index=item.sort_index, updated_at=datetime.now(timezone.utc))
        )
    await db.flush()
    return {"ok": True, "reordered_count": len(req.items)}


@router.post("/shots/bulk-update", status_code=status.HTTP_200_OK)
async def bulk_update_shots(
    req: BulkUpdateShotsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk update multiple shots in a single transaction (Spec Section 71)."""
    allowed_fields = {"primary_method", "department", "owner_id", "status", "sequence_id", "scene_id", "lens_mm"}
    valid_updates = {k: v for k, v in req.updates.items() if k in allowed_fields}
    if not valid_updates:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "无有效的批量更新字段"})

    valid_updates["updated_at"] = datetime.now(timezone.utc)
    for sid in req.shot_ids:
        await db.execute(
            update(Shot)
            .where(Shot.id == sid, Shot.deleted_at.is_(None))
            .values(**valid_updates)
        )
    await db.flush()
    return {"ok": True, "updated_count": len(req.shot_ids)}
