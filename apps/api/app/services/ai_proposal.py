"""AI Proposal Service managing Human-In-The-Loop generation and review."""
from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shot import Shot
from app.services.ai_provider import provider_registry


class ProposalStore:
    """In-memory persistent store for AI candidate proposals."""

    def __init__(self):
        self._proposals: Dict[str, dict] = {}

    def add(self, proposal: dict) -> None:
        self._proposals[proposal["id"]] = proposal

    def get(self, proposal_id: str) -> Optional[dict]:
        return self._proposals.get(proposal_id)

    def list(self, production_id: Optional[str] = None, status: Optional[str] = None) -> List[dict]:
        items = list(self._proposals.values())
        if production_id:
            items = [p for p in items if p["production_id"] == production_id]
        if status:
            items = [p for p in items if p["status"] == status]
        return items


proposal_store = ProposalStore()


async def generate_proposal(
    db: AsyncSession,
    production_id: str,
    capability: str,
    target_shot_id: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None
) -> dict:
    """Generate candidate proposal via active AI provider without mutating production data."""
    parameters = parameters or {}
    provider = provider_registry.get("mock-provider-offline")
    if not provider:
        raise ValueError("No AI provider available")

    # Fetch target shot original state if specified
    original_state = {}
    if target_shot_id:
        res = await db.execute(select(Shot).where(Shot.id == target_shot_id, Shot.deleted_at.is_(None)))
        shot = res.scalar_one_or_none()
        if not shot:
            raise ValueError(f"Target shot {target_shot_id} not found")
        original_state = {
            "description": shot.description,
            "action": shot.action,
            "dialogue": shot.dialogue,
            "voice_over": shot.voice_over,
            "shot_size": shot.shot_size,
            "camera_angle": shot.camera_angle,
            "lens_mm": shot.lens_mm,
        }

    job_result = await provider.execute_job(
        capability=capability,
        parameters=parameters,
    )

    # Build proposed changes based on capability
    proposed_changes = {}
    if capability == "screenplay_breakdown":
        proposed_changes = job_result.get("result", {})
    elif capability == "voice_alignment":
        aligned_frames = job_result.get("result", {}).get("aligned_duration_frames", 120)
        proposed_changes = {
            "duration_frames": aligned_frames,
            "timing_locked": True,
        }
    else:
        # Generic suggestion
        proposed_changes = {
            "director_notes": f"AI suggestion ({capability}): {job_result.get('result', {}).get('message', '')}"
        }

    proposal_id = str(uuid.uuid4())
    proposal = {
        "id": proposal_id,
        "production_id": production_id,
        "capability": capability,
        "status": "pending_review",
        "target_shot_id": target_shot_id,
        "proposed_changes": proposed_changes,
        "original_state": original_state,
        "created_by": user_id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": None
    }
    proposal_store.add(proposal)
    return proposal


async def review_proposal(
    db: AsyncSession,
    proposal_id: str,
    action: str,  # "accept" or "reject"
    user_id: str,
    review_notes: Optional[str] = None
) -> dict:
    """Accept or reject an AI proposal. On accept, commits changes to shot with revision increment."""
    proposal = proposal_store.get(proposal_id)
    if not proposal:
        raise ValueError(f"Proposal {proposal_id} not found")

    if proposal["status"] != "pending_review":
        raise ValueError(f"Proposal is already {proposal['status']}")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    proposal["reviewed_by"] = user_id
    proposal["reviewed_at"] = now_iso
    proposal["review_notes"] = review_notes

    if action == "reject":
        proposal["status"] = "rejected"
        return proposal

    if action == "accept":
        proposal["status"] = "accepted"
        target_shot_id = proposal.get("target_shot_id")
        if target_shot_id and proposal.get("proposed_changes"):
            res = await db.execute(select(Shot).where(Shot.id == target_shot_id, Shot.deleted_at.is_(None)))
            shot = res.scalar_one_or_none()
            if shot:
                for k, v in proposal["proposed_changes"].items():
                    if hasattr(shot, k) and k not in ("id", "production_id", "revision", "created_at"):
                        setattr(shot, k, v)
                shot.revision += 1
                shot.updated_at = datetime.datetime.now(datetime.timezone.utc)
                await db.flush()
        return proposal

    raise ValueError(f"Unknown review action: {action}")
