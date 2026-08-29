"""Health Check Endpoints."""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/healthz")
@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "FrameForge Core API V1.0",
        "storage": "internal_node",
        "zero_residency_public": True
    }
