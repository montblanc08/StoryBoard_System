import uuid
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.production import Production
from app.models.shot import Shot, Panel
from app.schemas.shot import ShotResponse, ShotCreate, ShotPatch, ShotSequenceUpdate
from app.services.shot_service import ShotService
from app.core.exceptions import DomainError, NotFoundError, ConflictError

router = APIRouter()

@router.post("/productions/{production_id}/shots", response_model=ShotResponse, status_code=status.HTTP_201_CREATED)
async def create_shot(
    production_id: str,
    req: ShotCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    try:
        shot = await ShotService.create_shot(db, production_id, req, user_id)
        return shot
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": e.code, "message": e.message})
    except DomainError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})

@router.patch("/shots/{id}", response_model=ShotResponse)
async def update_shot(
    id: str,
    req: ShotPatch,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    try:
        shot = await ShotService.patch_shot(db, id, req, user_id)
        return shot
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": e.code, "message": e.message})
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": "SHOT_REVISION_CONFLICT", "message": e.message, "details": e.details})
    except DomainError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
