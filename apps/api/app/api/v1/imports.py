"""Import API Routes for Excel / CSV Table Ingestion."""
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.models.production import Production, Sequence
from app.models.shot import Panel, ProductionStep, Shot
from app.models.user import User
from app.services.importer import map_headers, parse_table

router = APIRouter(prefix="/productions/{production_id}", tags=["Imports"])


class ImportPreviewRequest(BaseModel):
    filename: str
    file_base64: str


class ImportCommitRequest(BaseModel):
    rows: list[list[str]]
    mapping: dict[str, dict[str, Any]]
    sequence_id: str | None = None


@router.post("/import-preview")
async def preview_table_import(
    production_id: str,
    req: ImportPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Parse uploaded Excel/CSV file, match headers, and return preview sample."""
    try:
        content = base64.b64decode(req.file_base64)
    except Exception:
        raise HTTPException(status_code=400, detail={"code": "INVALID_FILE", "message": "文件 Base64 解码失败"})

    rows = parse_table(content, req.filename)
    if not rows:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_TABLE", "message": "无法解析表格内容或表格为空"})

    headers = [str(c).strip() for c in rows[0]]
    mapping = map_headers(headers)
    data_rows = rows[1:]

    preview_sample: list[dict[str, Any]] = []
    for r in data_rows[:10]:
        shot_sample = {}
        for f, info in mapping.items():
            col = info["col"]
            shot_sample[f] = r[col] if col < len(r) else ""
        preview_sample.append(shot_sample)

    return {
        "total_rows": len(data_rows),
        "headers": headers,
        "mapping": mapping,
        "sample_preview": preview_sample,
        "raw_rows": data_rows
    }


@router.post("/import-commit", status_code=status.HTTP_201_CREATED)
async def commit_table_import(
    production_id: str,
    req: ImportCommitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Commit mapped Excel/CSV rows into shots table."""
    p_res = await db.execute(select(Production).where(Production.id == production_id, Production.deleted_at.is_(None)))
    prod = p_res.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "项目不存在"})

    fps = prod.fps_num / (prod.fps_den or 1)

    # Get default sequence if none provided
    seq_id = req.sequence_id
    if not seq_id:
        seq_res = await db.execute(select(Sequence).where(Sequence.production_id == production_id).limit(1))
        seq = seq_res.scalar_one_or_none()
        if seq:
            seq_id = seq.id

    # Get current max sort index
    max_res = await db.execute(
        select(func.coalesce(func.max(Shot.sort_index), 0.0)).where(Shot.production_id == production_id)
    )
    current_sort = max_res.scalar() or 0.0

    imported_count = 0
    now = datetime.now(timezone.utc)

    for r in req.rows:
        if not any(str(c).strip() for c in r):
            continue

        values: dict[str, str] = {}
        for f, info in req.mapping.items():
            col = info.get("col", -1)
            values[f] = str(r[col]).strip() if 0 <= col < len(r) else ""

        current_sort += 1000.0
        num = values.get("number") or f"{int(current_sort / 1000):03d}"

        # Calculate duration
        dur_raw = values.get("duration", "")
        dur_frames_raw = values.get("duration_frames", "")
        if dur_frames_raw and dur_frames_raw.isdigit():
            dur_frames = max(1, int(dur_frames_raw))
        elif dur_raw:
            try:
                clean_sec = float("".join(c for c in dur_raw if c.isdigit() or c == "."))
                dur_frames = max(1, int(round(clean_sec * fps)))
            except ValueError:
                dur_frames = 75
        else:
            dur_frames = 75

        p_method = (values.get("primary_method") or "live").lower()
        if p_method not in ("live", "stock", "client", "archive", "still", "ae", "mg", "three_d", "vfx", "type"):
            p_method = "live"

        lens_val = None
        if values.get("lens_mm"):
            try:
                lens_val = float("".join(c for c in values["lens_mm"] if c.isdigit() or c == "."))
            except ValueError:
                lens_val = None

        sid = str(uuid.uuid4())
        shot = Shot(
            id=sid,
            production_id=production_id,
            sequence_id=seq_id,
            display_number=num,
            sort_index=current_sort,
            name=values.get("name") or f"镜头 {num}",
            description=values.get("description", ""),
            voiceover=values.get("voiceover", ""),
            duration_frames=dur_frames,
            shot_size=values.get("shot_size", "全景"),
            lens_mm=lens_val,
            movement=values.get("movement", "固定"),
            camera_angle=values.get("camera_angle", "平视"),
            primary_method=p_method,
            department=values.get("department", "camera"),
            owner_id=values.get("owner_id", ""),
            director_notes=values.get("director_notes", ""),
            status="draft",
            revision=1,
            created_by=current_user.id
        )
        db.add(shot)

        # Default panel
        panel = Panel(
            id=str(uuid.uuid4()),
            shot_id=sid,
            display_number="A",
            sort_index=1000.0,
            duration_frames=dur_frames
        )
        db.add(panel)
        imported_count += 1

    await db.flush()
    return {"ok": True, "imported_count": imported_count}
