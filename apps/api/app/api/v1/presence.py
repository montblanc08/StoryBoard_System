"""Presence & Collaboration API Routes."""
from __future__ import annotations

import json
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.api.v1.deps import get_current_user
from app.models.user import User
from app.services.presence import presence_engine, ws_manager

router = APIRouter(tags=["Presence"])


class HeartbeatRequest(BaseModel):
    session_id: str
    color: str = "#3B82F6"
    state: str = "viewing"
    selected_shot_id: Optional[str] = None
    focused_field: Optional[str] = None


class LockRequest(BaseModel):
    shot_id: str
    field_name: str


class UnlockRequest(BaseModel):
    shot_id: str
    field_name: str


@router.get("/presence/rooms/{production_id}")
async def get_room_presence(
    production_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Retrieve current active collaborative session snapshot and locks."""
    return presence_engine.get_room_snapshot(production_id)


@router.post("/presence/rooms/{production_id}/heartbeat")
async def send_heartbeat(
    production_id: str,
    req: HeartbeatRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Send heartbeat to maintain presence and update viewing/selection state."""
    sess = presence_engine.join_or_heartbeat(
        production_id=production_id,
        session_id=req.session_id,
        user_id=current_user.id,
        user_name=current_user.display_name or current_user.email,
        color=req.color,
        state=req.state,
        selected_shot_id=req.selected_shot_id,
        focused_field=req.focused_field
    )
    # Broadcast snapshot to room
    snapshot = presence_engine.get_room_snapshot(production_id)
    await ws_manager.broadcast(production_id, {"type": "presence_update", "data": snapshot})
    return {"ok": True, "session_id": sess.session_id}


@router.post("/presence/rooms/{production_id}/lock")
async def acquire_cell_lock(
    production_id: str,
    req: LockRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Acquire fine-grained soft lock for editing a field in a shot."""
    ok, lock = presence_engine.lock_mgr.acquire(
        production_id=production_id,
        shot_id=req.shot_id,
        field_name=req.field_name,
        user_id=current_user.id,
        user_name=current_user.display_name or current_user.email
    )
    if not ok and lock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CELL_LOCKED",
                "message": f"该单元格正在被 {lock.user_name} 编辑中",
                "details": {
                    "locked_by": lock.user_id,
                    "locked_by_name": lock.user_name,
                    "expires_at": lock.expires_at
                }
            }
        )

    # Broadcast updated locks
    snapshot = presence_engine.get_room_snapshot(production_id)
    await ws_manager.broadcast(production_id, {"type": "lock_update", "data": snapshot})
    return {"ok": True, "lock": lock}


@router.post("/presence/rooms/{production_id}/unlock")
async def release_cell_lock(
    production_id: str,
    req: UnlockRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Release fine-grained cell lock."""
    released = presence_engine.lock_mgr.release(
        production_id=production_id,
        shot_id=req.shot_id,
        field_name=req.field_name,
        user_id=current_user.id
    )
    snapshot = presence_engine.get_room_snapshot(production_id)
    await ws_manager.broadcast(production_id, {"type": "lock_update", "data": snapshot})
    return {"ok": True, "released": released}


@router.websocket("/presence/rooms/{production_id}/ws")
@router.websocket("/ws/presence/{production_id}")
async def presence_websocket(
    websocket: WebSocket,
    production_id: str
):
    """Realtime WebSocket endpoint for presence notifications and cursors."""
    await ws_manager.connect(production_id, websocket)
    client_session_id = None
    try:
        # Send initial snapshot upon connection
        snapshot = presence_engine.get_room_snapshot(production_id)
        await websocket.send_json({"type": "init", "data": snapshot})

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                if msg_type == "join":
                    client_session_id = msg.get("session_id")
                    presence_engine.join_or_heartbeat(
                        production_id=production_id,
                        session_id=client_session_id,
                        user_id=msg.get("user_id", "anon"),
                        user_name=msg.get("user_name", "Anonymous"),
                        color=msg.get("color", "#10B981"),
                        state=msg.get("state", "viewing"),
                        selected_shot_id=msg.get("selected_shot_id"),
                        focused_field=msg.get("focused_field")
                    )
                    snap = presence_engine.get_room_snapshot(production_id)
                    await ws_manager.broadcast(production_id, {"type": "presence_update", "data": snap})
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": snap.get("timestamp") if "snap" in locals() else None})
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(production_id, websocket)
        if client_session_id:
            presence_engine.leave(production_id, client_session_id)
            snap = presence_engine.get_room_snapshot(production_id)
            await ws_manager.broadcast(production_id, {"type": "presence_update", "data": snap})
    except Exception:
        ws_manager.disconnect(production_id, websocket)
