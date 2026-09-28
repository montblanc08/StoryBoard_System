"""AI & Automation Schemas."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AIStatusResponse(BaseModel):
    is_enabled: bool
    active_provider: str
    supported_capabilities: List[str]


class ProposalGenerateRequest(BaseModel):
    production_id: str
    capability: str
    target_shot_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ProposalReviewRequest(BaseModel):
    action: str = Field(description="Must be 'accept' or 'reject'")
    review_notes: Optional[str] = None


class AIProposalOut(BaseModel):
    id: str
    production_id: str
    capability: str
    status: str  # pending_review | accepted | rejected
    target_shot_id: Optional[str] = None
    proposed_changes: Dict[str, Any]
    original_state: Dict[str, Any]
    review_notes: Optional[str] = None
    created_at: str
    reviewed_at: Optional[str] = None
