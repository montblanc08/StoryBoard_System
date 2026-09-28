"""Real-time Presence & Cell Lock Collaboration Service for FrameForge OS.

Implements Master Specification Section 12-14:
- Cell-level optimistic soft locking (avoids blind overwriting during multi-user editing)
- Heartbeat & TTL session reaping (default 30s timeout)
- State transitions: idle -> viewing -> selected -> editing
- WebSocket broadcasting of room snapshots and lock state changes
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket


@dataclass
class CellLock:
    shot_id: str
    field_name: str
    user_id: str
    user_name: str
    acquired_at: float
    expires_at: float


@dataclass
class PresenceSession:
    session_id: str
    user_id: str
    user_name: str
    color: str
    state: str = "idle"  # idle | viewing | selected | editing
    selected_shot_id: Optional[str] = None
    focused_field: Optional[str] = None
    last_heartbeat: float = field(default_factory=time.time)


class SoftLockManager:
    """Manages fine-grained cell locks per production."""

    def __init__(self, lock_ttl_seconds: float = 15.0):
        self.lock_ttl = lock_ttl_seconds
        # key: (production_id, shot_id, field_name) -> CellLock
        self._locks: Dict[tuple[str, str, str], CellLock] = {}

    def acquire(self, production_id: str, shot_id: str, field_name: str, user_id: str, user_name: str) -> tuple[bool, Optional[CellLock]]:
        now = time.time()
        self._purge_expired(now)
        key = (production_id, shot_id, field_name)
        existing = self._locks.get(key)
        if existing:
            if existing.user_id == user_id:
                # Renew
                existing.expires_at = now + self.lock_ttl
                return True, existing
            return False, existing

        lock = CellLock(
            shot_id=shot_id,
            field_name=field_name,
            user_id=user_id,
            user_name=user_name,
            acquired_at=now,
            expires_at=now + self.lock_ttl
        )
        self._locks[key] = lock
        return True, lock

    def release(self, production_id: str, shot_id: str, field_name: str, user_id: str) -> bool:
        key = (production_id, shot_id, field_name)
        existing = self._locks.get(key)
        if existing and existing.user_id == user_id:
            del self._locks[key]
            return True
        return False

    def release_all_for_user(self, production_id: str, user_id: str) -> List[tuple[str, str]]:
        released = []
        keys_to_delete = [
            k for k, v in self._locks.items()
            if k[0] == production_id and v.user_id == user_id
        ]
        for k in keys_to_delete:
            del self._locks[k]
            released.append((k[1], k[2]))
        return released

    def list_locks(self, production_id: str) -> List[CellLock]:
        now = time.time()
        self._purge_expired(now)
        return [v for k, v in self._locks.items() if k[0] == production_id]

    def _purge_expired(self, now: float) -> None:
        expired_keys = [k for k, v in self._locks.items() if v.expires_at < now]
        for k in expired_keys:
            del self._locks[k]


class PresenceEngine:
    """Realtime Presence Engine maintaining room members and active states."""

    def __init__(self, session_ttl_seconds: float = 30.0):
        self.session_ttl = session_ttl_seconds
        # production_id -> dict[session_id, PresenceSession]
        self._rooms: Dict[str, Dict[str, PresenceSession]] = {}
        self.lock_mgr = SoftLockManager()

    def join_or_heartbeat(
        self,
        production_id: str,
        session_id: str,
        user_id: str,
        user_name: str,
        color: str,
        state: str = "idle",
        selected_shot_id: Optional[str] = None,
        focused_field: Optional[str] = None
    ) -> PresenceSession:
        now = time.time()
        room = self._rooms.setdefault(production_id, {})
        self._reap_expired(production_id, now)

        if session_id in room:
            sess = room[session_id]
            sess.last_heartbeat = now
            sess.state = state
            sess.selected_shot_id = selected_shot_id
            sess.focused_field = focused_field
            return sess

        sess = PresenceSession(
            session_id=session_id,
            user_id=user_id,
            user_name=user_name,
            color=color,
            state=state,
            selected_shot_id=selected_shot_id,
            focused_field=focused_field,
            last_heartbeat=now
        )
        room[session_id] = sess
        return sess

    def leave(self, production_id: str, session_id: str) -> Optional[PresenceSession]:
        room = self._rooms.get(production_id)
        if not room:
            return None
        sess = room.pop(session_id, None)
        if sess:
            self.lock_mgr.release_all_for_user(production_id, sess.user_id)
        return sess

    def get_room_snapshot(self, production_id: str) -> dict:
        now = time.time()
        self._reap_expired(production_id, now)
        room = self._rooms.get(production_id, {})
        sessions = [
            {
                "session_id": s.session_id,
                "user_id": s.user_id,
                "user_name": s.user_name,
                "color": s.color,
                "state": s.state,
                "selected_shot_id": s.selected_shot_id,
                "focused_field": s.focused_field,
            }
            for s in room.values()
        ]
        locks = [
            {
                "shot_id": l.shot_id,
                "field_name": l.field_name,
                "user_id": l.user_id,
                "user_name": l.user_name,
                "expires_at": l.expires_at,
            }
            for l in self.lock_mgr.list_locks(production_id)
        ]
        return {
            "production_id": production_id,
            "active_user_count": len(sessions),
            "sessions": sessions,
            "locks": locks,
            "timestamp": now
        }

    def _reap_expired(self, production_id: str, now: float) -> None:
        room = self._rooms.get(production_id)
        if not room:
            return
        expired = [sid for sid, s in room.items() if now - s.last_heartbeat > self.session_ttl]
        for sid in expired:
            s = room.pop(sid)
            self.lock_mgr.release_all_for_user(production_id, s.user_id)


class WebSocketConnectionManager:
    """Manages active WebSockets and multicasts room updates."""

    def __init__(self):
        # production_id -> set[WebSocket]
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, production_id: str, ws: WebSocket) -> None:
        await ws.accept()
        conns = self._connections.setdefault(production_id, set())
        conns.add(ws)

    def disconnect(self, production_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(production_id)
        if conns and ws in conns:
            conns.remove(ws)

    async def broadcast(self, production_id: str, message: dict) -> None:
        conns = self._connections.get(production_id, set())
        dead_sockets = set()
        for ws in list(conns):
            try:
                await ws.send_json(message)
            except Exception:
                dead_sockets.add(ws)
        for dead in dead_sockets:
            conns.discard(dead)


# Global singletons for presence
presence_engine = PresenceEngine()
ws_manager = WebSocketConnectionManager()
