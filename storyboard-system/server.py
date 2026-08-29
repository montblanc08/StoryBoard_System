#!/usr/bin/env python3
"""
FrameForge Professional Film/Video Storyboard & Shot Production Management System.
Master Specification V3.0 Backend Engine.
Standard library only: HTTP + SQLite + Threading + Encryption + Media Proxy.
"""
from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import json
import math
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
import time
import urllib.parse
import uuid
import zipfile
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from xml.etree import ElementTree as ET

APP_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = APP_ROOT / "static"
DATA_ROOT = Path(os.environ.get("STORYBOARD_DATA_ROOT", APP_ROOT / "data")).resolve()
DB_PATH = DATA_ROOT / "storyboard.db"
MEDIA_ROOT = DATA_ROOT / "media"
EXPORT_ROOT = DATA_ROOT / "exports"
MAX_BODY = int(os.environ.get("STORYBOARD_MAX_BODY", str(400 * 1024 * 1024)))
SESSION_SECONDS = 14 * 86400
FPS_VALUES = {23.976, 24.0, 25.0, 29.97, 30.0, 48.0, 50.0, 59.94, 60.0}
SESSION_COOKIE = "frameforge_session"

# Standard Production Methods (Spec Section 5)
PRODUCTION_METHODS = [
    "LIVE", "STOCK", "CLIENT", "ARCHIVE", "STILL",
    "AE", "MG", "3D", "VFX", "TYPE"
]

# Standard Departments (Spec Section 8)
DEPARTMENTS = [
    "Director", "Camera", "Production", "Art", "Stock",
    "Editorial", "Motion", "MG", "3D", "VFX", "Sound", "Color", "Legal"
]

# Standard Approval Statuses (Spec Section 96)
APPROVAL_STATUSES = [
    "Draft", "WIP", "Ready for Review", "Changes Requested", "Approved", "Locked", "Deprecated"
]

# Column Header Recognition Dictionary (Spec Section 115)
ALIASES = {
    "number": ["镜号", "镜头编号", "编号", "shot", "shot no", "shot number", "序号", "no", "id"],
    "title": ["镜头标题", "标题", "内容", "镜头内容", "shot title", "title", "name"],
    "chapter": ["篇章", "章节", "幕", "chapter", "act", "sequence", "seq"],
    "scene": ["场景", "地点", "场景/地点", "scene", "location", "int/ext", "内外景"],
    "description": ["画面描述", "画面内容", "画面", "分镜画面", "description", "visual", "action"],
    "voiceover": ["对应旁白", "旁白", "解说词", "配音", "voiceover", "vo", "narration", "dialogue"],
    "duration": ["时长", "时长(秒)", "时长（秒）", "duration", "seconds", "sec", "length"],
    "duration_frames": ["帧数", "frames", "frame count", "duration frames"],
    "shot_size": ["景别", "shot size", "framing", "size"],
    "lens": ["焦段", "建议焦段", "镜头焦段", "镜头", "lens", "focal"],
    "movement": ["机位/运镜", "运镜", "镜头运动", "movement", "camera movement", "camera"],
    "angle": ["机位角度", "角度", "angle", "camera angle"],
    "primary_method": ["制作方式", "执行方式", "拍摄方式", "制作类型", "method", "production method", "execution"],
    "department": ["责任部门", "责任组", "部门", "department", "dept"],
    "owner": ["负责人", "执行人", "owner", "assignee", "artist"],
    "sound": ["声音", "音效", "sound", "sfx", "audio"],
    "transition": ["剪辑/转场", "转场", "transition", "edit"],
    "vfx": ["vfx", "特效", "视效", "cg", "vfx requirement"],
    "notes": ["备注", "制作备注", "导演备注", "notes", "director notes", "comment"],
    "source_type": ["素材来源", "素材路径", "source", "source type", "stock source", "asset path"],
    "source_note": ["素材说明", "来源说明", "source note", "rights note"]
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


class Database(sqlite3.Connection):
    """Transaction context that also commits/rollbacks."""
    def __exit__(self, exc_type, exc, traceback):
        try:
            if exc_type is None:
                self.commit()
            else:
                self.rollback()
        finally:
            self.close()
        return False


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH, timeout=30, factory=Database)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    return db


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    rounds = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        _, rounds, salt, expected = encoded.split("$", 3)
        salt_b = base64.urlsafe_b64decode(salt)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt_b, int(rounds))
        return hmac.compare_digest(actual, base64.urlsafe_b64decode(expected))
    except Exception:
        return False


# ==========================================
# SMPTE Timecode Engine (Spec Section 19-22)
# ==========================================

def frames_to_tc(total_frames: int, fps: float, is_drop_frame: bool = False) -> str:
    """Convert integer frames to SMPTE Timecode string."""
    total_frames = max(0, int(round(total_frames)))
    nominal_fps = int(round(fps))

    if is_drop_frame and abs(fps - 29.97) < 0.05:
        # 29.97 SMPTE Drop Frame formula
        drop_frames = 2
        frames_per_minute = 1800 - drop_frames  # 1798
        frames_per_10minutes = 1800 * 10 - drop_frames * 9  # 17982
        frames_per_hour = frames_per_10minutes * 6  # 107892

        d = total_frames // frames_per_10minutes
        m = total_frames % frames_per_10minutes
        if m > drop_frames:
            total_frames += drop_frames * 9 * d + drop_frames * ((m - drop_frames) // frames_per_minute)
        else:
            total_frames += drop_frames * 9 * d

        ff = total_frames % 30
        ss = (total_frames // 30) % 60
        mm = (total_frames // 1800) % 60
        hh = total_frames // 108000
        return f"{hh:02d}:{mm:02d}:{ss:02d};{ff:02d}"

    # Non-drop frame calculation
    ff = total_frames % nominal_fps
    total_seconds = total_frames // nominal_fps
    ss = total_seconds % 60
    mm = (total_seconds // 60) % 60
    hh = total_seconds // 3600
    sep = ";" if is_drop_frame else ":"
    return f"{hh:02d}:{mm:02d}:{ss:02d}{sep}{ff:02d}"


def tc_to_frames(tc_str: str, fps: float) -> int:
    """Convert SMPTE Timecode string (HH:MM:SS:FF or HH:MM:SS;FF) to integer frames."""
    if not tc_str or not isinstance(tc_str, str):
        return 0
    parts = re.split(r"[:;.]", tc_str.strip())
    if len(parts) != 4:
        return 0
    try:
        hh, mm, ss, ff = [int(p) for p in parts]
    except ValueError:
        return 0

    nominal_fps = int(round(fps))
    is_df = ";" in tc_str or (abs(fps - 29.97) < 0.05 and ";" in tc_str)

    if is_df and abs(fps - 29.97) < 0.05:
        total_minutes = 60 * hh + mm
        drop_frames = 2
        total_frames = (108000 * hh + 1800 * mm + 30 * ss + ff) - drop_frames * (total_minutes - total_minutes // 10)
        return max(0, total_frames)

    return max(0, (hh * 3600 + mm * 60 + ss) * nominal_fps + ff)


# ===============================================
# VO Auto-Timing Engine (Spec Section 23-30)
# ===============================================

def calculate_vo_weight(text: str) -> dict:
    """Analyze Voice Over script text and calculate frame pause weights."""
    if not text or not text.strip():
        return {"char_count": 0, "comma_count": 0, "period_count": 0, "ellipsis_count": 0, "total_weight": 1.0}
    clean = re.sub(r"\s+", "", text)
    char_count = len(clean)
    comma_count = len(re.findall(r"[，,、]", text))
    period_count = len(re.findall(r"[。！？!?；;]", text))
    ellipsis_count = len(re.findall(r"[…：:]", text))

    # Weight formula: each char = 1.0, comma = +1.5, period/sentence = +3.0, ellipsis = +2.0
    total_weight = max(1.0, char_count * 1.0 + comma_count * 1.5 + period_count * 3.0 + ellipsis_count * 2.0)
    return {
        "char_count": char_count,
        "comma_count": comma_count,
        "period_count": period_count,
        "ellipsis_count": ellipsis_count,
        "total_weight": total_weight
    }


def compute_auto_timing(shots: list[dict], target_seconds: float, fps: float) -> list[dict]:
    """
    Intelligently distribute duration frames for unlocked shots strictly equal to target_seconds.
    Locked shots preserve their manual frames. Floating point drift is strictly 0.
    """
    nominal_fps = int(round(fps))
    target_frames = int(round(target_seconds * fps))

    # Calculate locked shots frames
    locked_frames = sum(s.get("duration_frames", nominal_fps * 3) for s in shots if s.get("locked"))
    unlocked_shots = [s for s in shots if not s.get("locked")]

    if not unlocked_shots:
        return shots

    available_frames = max(len(unlocked_shots), target_frames - locked_frames)

    # Weights
    weights = []
    for s in unlocked_shots:
        w_info = calculate_vo_weight(s.get("voiceover", ""))
        weights.append(w_info["total_weight"])
    sum_weights = sum(weights) or float(len(unlocked_shots))

    min_shot_frames = max(1, int(round(fps * 0.8)))  # min 0.8s default

    # First pass proportional allocation
    assigned = 0
    allocations = []
    for i, s in enumerate(unlocked_shots):
        if i == len(unlocked_shots) - 1:
            # Final shot gets remainder to guarantee exact sum == target_frames
            f = max(min_shot_frames, available_frames - assigned)
        else:
            proportion = weights[i] / sum_weights
            f = max(min_shot_frames, int(round(available_frames * proportion)))
        allocations.append(f)
        assigned += f

    # Adjust drift if total != available_frames
    diff = available_frames - sum(allocations)
    if diff != 0 and len(allocations) > 0:
        allocations[-1] = max(min_shot_frames, allocations[-1] + diff)

    # Apply back
    u_idx = 0
    for s in shots:
        if not s.get("locked"):
            s["duration_frames"] = allocations[u_idx]
            u_idx += 1

    return shots


# ==========================================
# Database Schema (Spec Master Spec V3.0)
# ==========================================

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    display_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    production_type TEXT NOT NULL DEFAULT 'promo',
    fps REAL NOT NULL DEFAULT 25.0,
    start_tc TEXT NOT NULL DEFAULT '01:00:00:00',
    target_seconds REAL NOT NULL DEFAULT 270.0,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    status TEXT NOT NULL DEFAULT 'development',
    share_token TEXT UNIQUE,
    is_drop_frame INTEGER NOT NULL DEFAULT 0,
    director TEXT NOT NULL DEFAULT '',
    dp TEXT NOT NULL DEFAULT '',
    producer TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    custom_template_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sequence_id TEXT REFERENCES sequences(id) ON DELETE SET NULL,
    position INTEGER NOT NULL,
    number TEXT NOT NULL,
    sort_index INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    chapter TEXT NOT NULL DEFAULT '',
    scene TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    performance TEXT NOT NULL DEFAULT '',
    composition TEXT NOT NULL DEFAULT '',
    director_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    duration_frames INTEGER NOT NULL DEFAULT 75,
    locked INTEGER NOT NULL DEFAULT 0,
    handles_head_frames INTEGER NOT NULL DEFAULT 0,
    handles_tail_frames INTEGER NOT NULL DEFAULT 0,
    shot_size TEXT NOT NULL DEFAULT '全景',
    lens TEXT NOT NULL DEFAULT '',
    angle TEXT NOT NULL DEFAULT '',
    height TEXT NOT NULL DEFAULT '',
    movement TEXT NOT NULL DEFAULT '固定',
    equipment TEXT NOT NULL DEFAULT '',
    sensor TEXT NOT NULL DEFAULT '',
    aperture TEXT NOT NULL DEFAULT '',
    shutter TEXT NOT NULL DEFAULT '',
    camera_fps REAL NOT NULL DEFAULT 25.0,
    voiceover TEXT NOT NULL DEFAULT '',
    dialogue TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    music TEXT NOT NULL DEFAULT '',
    sound TEXT NOT NULL DEFAULT '',
    primary_method TEXT NOT NULL DEFAULT 'LIVE',
    secondary_methods TEXT NOT NULL DEFAULT '[]',
    department TEXT NOT NULL DEFAULT 'Camera',
    owner TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Draft',
    approval_version TEXT NOT NULL DEFAULT 'v001',
    transition TEXT NOT NULL DEFAULT '',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    method_data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shots_proj_pos ON shots(project_id, position);
CREATE INDEX IF NOT EXISTS shots_deleted ON shots(is_deleted);

CREATE TABLE IF NOT EXISTS panels (
    id TEXT PRIMARY KEY,
    shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT 'A',
    duration_frames INTEGER NOT NULL DEFAULT 75,
    media_id TEXT,
    drawing_json TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_steps (
    id TEXT PRIMARY KEY,
    shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'Storyboard',
    version TEXT NOT NULL DEFAULT 'v001',
    rights_info TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shot_asset_links (
    id TEXT PRIMARY KEY,
    shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Reference',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shot_versions (
    id TEXT PRIMARY KEY,
    shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    version_num TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    snapshot_json TEXT NOT NULL,
    asset_id TEXT,
    status TEXT NOT NULL DEFAULT 'Draft',
    created_by TEXT NOT NULL DEFAULT 'Admin',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Director',
    text TEXT NOT NULL,
    timecode TEXT NOT NULL DEFAULT '',
    parent_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS share_links (
    token TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_json TEXT NOT NULL,
    is_permanent INTEGER NOT NULL DEFAULT 1,
    allow_download INTEGER NOT NULL DEFAULT 1,
    watermark TEXT NOT NULL DEFAULT '',
    expires_at INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    attempts INTEGER NOT NULL
);
"""


def init_db() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(SCHEMA)
        username = os.environ.get("STORYBOARD_ADMIN_USER", "admin")
        password = os.environ.get("STORYBOARD_ADMIN_PASSWORD", "FrameForge2026!Admin")
        row = db.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
        if not row:
            db.execute(
                "INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), username, password_hash(password), "admin", "系统管理员", now_iso())
            )
        # Check if default demo project exists; if not, seed the 80-shot Tianjin project
        seed_demo_if_empty(db)


def audit(db: sqlite3.Connection, actor: str, action: str, target: str, detail: str = "") -> None:
    db.execute("INSERT INTO audit_log(at, actor, action, target, detail) VALUES (?,?,?,?,?)",
               (now_iso(), actor, action, target, str(detail)[:2000]))


def shot_dict(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["locked"] = bool(data.get("locked", 0))
    data["is_deleted"] = bool(data.get("is_deleted", 0))
    try:
        data["secondary_methods"] = json.loads(data.get("secondary_methods") or "[]")
    except Exception:
        data["secondary_methods"] = []
    try:
        data["method_data_json"] = json.loads(data.get("method_data_json") or "{}")
    except Exception:
        data["method_data_json"] = {}
    return data


def project_bundle(db: sqlite3.Connection, project_id: str, include_deleted: bool = False) -> dict | None:
    p = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not p:
        return None
    proj = dict(p)
    proj["is_drop_frame"] = bool(proj.get("is_drop_frame", 0))
    try:
        proj["custom_template_json"] = json.loads(proj.get("custom_template_json") or "{}")
    except Exception:
        proj["custom_template_json"] = {}

    del_filter = "" if include_deleted else " AND is_deleted=0"
    shot_rows = db.execute(
        f"SELECT * FROM shots WHERE project_id=?{del_filter} ORDER BY position, id", (project_id,)
    ).fetchall()
    shots = [shot_dict(r) for r in shot_rows]

    # Calculate cumulative timecodes
    cursor = tc_to_frames(proj["start_tc"], proj["fps"])
    is_df = proj["is_drop_frame"]
    fps = proj["fps"]

    for s in shots:
        s["tc_in_frames"] = cursor
        s["tc_in"] = frames_to_tc(cursor, fps, is_df)
        cursor += s["duration_frames"]
        s["tc_out_frames"] = cursor
        s["tc_out"] = frames_to_tc(cursor, fps, is_df)
        s["duration_seconds"] = round(s["duration_frames"] / fps, 3)

    # Attach panels, steps, and assets
    shot_ids = [s["id"] for s in shots]
    panels_map: dict[str, list[dict]] = {sid: [] for sid in shot_ids}
    steps_map: dict[str, list[dict]] = {sid: [] for sid in shot_ids}
    links_map: dict[str, list[dict]] = {sid: [] for sid in shot_ids}
    comments_map: dict[str, list[dict]] = {sid: [] for sid in shot_ids}
    versions_map: dict[str, list[dict]] = {sid: [] for sid in shot_ids}

    if shot_ids:
        placeholders = ",".join("?" for _ in shot_ids)
        for r in db.execute(f"SELECT * FROM panels WHERE shot_id IN ({placeholders}) ORDER BY position", shot_ids):
            panels_map[r["shot_id"]].append(dict(r))
        for r in db.execute(f"SELECT * FROM production_steps WHERE shot_id IN ({placeholders}) ORDER BY step_order", shot_ids):
            steps_map[r["shot_id"]].append(dict(r))
        for r in db.execute(f"""
            SELECT l.id as link_id, l.shot_id, l.role, a.* 
            FROM shot_asset_links l JOIN assets a ON l.asset_id=a.id 
            WHERE l.shot_id IN ({placeholders}) ORDER BY a.created_at
        """, shot_ids):
            item = dict(r)
            item.pop("stored_name", None)
            links_map[r["shot_id"]].append(item)
        for r in db.execute(f"SELECT * FROM comments WHERE shot_id IN ({placeholders}) ORDER BY created_at", shot_ids):
            comments_map[r["shot_id"]].append(dict(r))
        for r in db.execute(f"SELECT * FROM shot_versions WHERE shot_id IN ({placeholders}) ORDER BY created_at DESC", shot_ids):
            versions_map[r["shot_id"]].append(dict(r))

    for s in shots:
        s["panels"] = panels_map.get(s["id"], [])
        s["steps"] = steps_map.get(s["id"], [])
        s["assets"] = links_map.get(s["id"], [])
        s["comments"] = comments_map.get(s["id"], [])
        s["versions"] = versions_map.get(s["id"], [])

    # Global project assets
    assets = []
    for r in db.execute("SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC", (project_id,)):
        item = dict(r)
        item.pop("stored_name", None)
        assets.append(item)

    # Sequences / Chapters
    sequences = [dict(r) for r in db.execute("SELECT * FROM sequences WHERE project_id=? ORDER BY position", (project_id,))]

    return {
        "project": proj,
        "shots": shots,
        "assets": assets,
        "sequences": sequences,
        "total_frames": sum(s["duration_frames"] for s in shots),
        "total_seconds": sum(s["duration_frames"] for s in shots) / fps if fps else 0
    }


# ==========================================
# Seed 80-Shot Demo Production
# ==========================================

def seed_demo_if_empty(db: sqlite3.Connection) -> None:
    """Pre-load the 80-shot Tianjin Agricultural Trade Center production."""
    row = db.execute("SELECT id FROM projects WHERE name LIKE '%天津国际农产品交易中心%'").fetchone()
    if row:
        return

    pid = str(uuid.uuid4())
    at = now_iso()
    db.execute("""
        INSERT INTO projects (
            id, name, production_type, fps, start_tc, target_seconds, aspect_ratio, status,
            director, dp, producer, company, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        pid, "天津国际农产品交易中心 · 4分30秒形象宣传片", "promo", 25.0, "01:00:00:00",
        270.0, "16:9", "approved", "张导", "李摄影", "王制片", "北方国际影视传媒", at, at
    ))

    # Check sample files in repo
    sample_js_path = APP_ROOT.parent / "天津国际农产品交易中心_分镜制作网页_V1" / "shots-data.js"
    images_dir = APP_ROOT.parent / "天津国际农产品交易中心_分镜制作网页_V1" / "images"

    shots_data = []
    if sample_js_path.exists():
        content = sample_js_path.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r"window\.STORYBOARD_SHOTS\s*=\s*(\[[\s\S]*?\]);", content)
        if match:
            try:
                shots_data = json.loads(match.group(1))
            except Exception:
                shots_data = []

    if not shots_data:
        # Fallback basic shots if file missing
        for i in range(1, 81):
            shots_data.append({
                "id": i,
                "chapter": f"篇章 {(i-1)//20 + 1}",
                "location": f"场景 {i}",
                "duration": 3.0,
                "shotSize": "全景",
                "method": "实拍" if i % 2 == 0 else "AE包装",
                "voiceover": f"镜头 {i:03d} 旁白解说词内容。",
                "description": f"画面内容描述 {i:03d}。",
                "image": f"images/{i:03d}_image.jpg"
            })

    method_map = {
        "实拍航拍": "LIVE", "实拍/版权": "STOCK", "实拍航拍/版权": "STOCK",
        "实拍航拍/延时": "LIVE", "MG/合成": "MG", "MG/合成 / MG/3D": "MG",
        "MG动画/三维": "3D", "三维渲染": "3D", "AE包装": "AE", "客户供片": "CLIENT"
    }

    pos = 0
    for item in shots_data:
        sid = str(uuid.uuid4())
        num_str = f"{item.get('id', pos+1):03d}"
        dur_sec = float(item.get("duration", 3.0))
        dur_frames = max(1, int(round(dur_sec * 25.0)))
        raw_method = item.get("method", "实拍")
        p_method = "LIVE"
        for k, v in method_map.items():
            if k in raw_method:
                p_method = v
                break
        if "3D" in raw_method or "三维" in raw_method:
            p_method = "3D"
        elif "MG" in raw_method or "动画" in raw_method:
            p_method = "MG"
        elif "AE" in raw_method or "包装" in raw_method:
            p_method = "AE"
        elif "版权" in raw_method or "网络" in raw_method or "购买" in raw_method:
            p_method = "STOCK"
        elif "客户" in raw_method or "资料" in raw_method:
            p_method = "CLIENT"

        db.execute("""
            INSERT INTO shots (
                id, project_id, position, number, sort_index, title, chapter, scene,
                description, voiceover, duration_frames, shot_size, lens, movement,
                primary_method, secondary_methods, department, owner, status, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            sid, pid, pos, num_str, pos, item.get("location", f"镜头 {num_str}"),
            item.get("chapter", "篇章一"), item.get("location", ""),
            item.get("description", ""), item.get("voiceover", ""),
            dur_frames, item.get("shotSize", "全景"), item.get("focal", "35mm"),
            item.get("movement", "固定"), p_method, json.dumps([]),
            "Camera" if p_method == "LIVE" else "Motion" if p_method in ("AE", "MG") else "3D" if p_method == "3D" else "Production",
            "王指导", "Approved" if pos < 20 else "WIP", at, at
        ))

        # Check and copy image asset if exists
        img_name = Path(item.get("image", "")).name
        src_img = images_dir / img_name if images_dir.exists() else None
        if src_img and src_img.exists():
            aid = str(uuid.uuid4())
            stored = f"{aid}_{img_name}"
            dest = MEDIA_ROOT / stored
            try:
                shutil.copyfile(src_img, dest)
                db.execute("""
                    INSERT INTO assets (id, project_id, filename, stored_name, mime, size, category, version, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?)
                """, (aid, pid, img_name, stored, "image/jpeg", src_img.stat().st_size, "Storyboard", "v001", at))
                db.execute("""
                    INSERT INTO shot_asset_links (id, shot_id, asset_id, role, created_at)
                    VALUES (?,?,?,?,?)
                """, (str(uuid.uuid4()), sid, aid, "Reference", at))
                db.execute("""
                    INSERT INTO panels (id, shot_id, position, label, duration_frames, media_id, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (str(uuid.uuid4()), sid, 0, "A", dur_frames, aid, at, at))
            except Exception:
                pass
        else:
            # Create default panel
            db.execute("""
                INSERT INTO panels (id, shot_id, position, label, duration_frames, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?)
            """, (str(uuid.uuid4()), sid, 0, "A", dur_frames, at, at))

        # Create production steps
        steps = ["01 构图设计", "02 制作执行", "03 审片确认"]
        if p_method == "LIVE":
            steps = ["01 勘景与通告", "02 现场拍摄", "03 剪辑回放"]
        elif p_method in ("AE", "MG"):
            steps = ["01 Styleframe", "02 动态包装", "03 合成与文字"]
        elif p_method == "3D":
            steps = ["01 模型材质", "02 动画灯光", "03 渲染合成"]
        elif p_method == "STOCK":
            steps = ["01 搜索初筛", "02 导演确认", "03 版权购买与下载"]

        for s_idx, st in enumerate(steps):
            db.execute("""
                INSERT INTO production_steps (id, shot_id, step_order, name, department, status, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?)
            """, (str(uuid.uuid4()), sid, s_idx, st, "Production", "Done" if pos < 15 else "Pending", at, at))

        pos += 1


# ===============================================
# Excel / CSV Importer (Spec Section 114-117)
# ===============================================

def norm_header(val: str) -> str:
    return re.sub(r"[\s_\-/（）()：:·|]+", "", str(val or "")).lower()


def map_headers(headers: list[str]) -> dict[str, dict]:
    """Score headers with confidence dictionary."""
    result: dict[str, dict] = {}
    normalized = [norm_header(h) for h in headers]

    for field, aliases in ALIASES.items():
        candidates = [norm_header(field)] + [norm_header(a) for a in aliases]
        best_col = -1
        best_score = 0.0
        for idx, header in enumerate(normalized):
            if not header:
                continue
            if header in candidates:
                best_col = idx
                best_score = 0.99
                break
            for c in candidates:
                if c and (c in header or header in c):
                    score = len(c) / max(len(header), 1) * 0.9
                    if score > best_score:
                        best_score = score
                        best_col = idx
        if best_col >= 0 and best_score >= 0.6:
            result[field] = {"col": best_col, "header": headers[best_col], "confidence": round(best_score, 2)}

    return result


def parse_xlsx_rows(payload: bytes) -> list[list[str]]:
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{ns}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{ns}t")))
        sheets = sorted(n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
        if not sheets:
            return []
        root = ET.fromstring(zf.read(sheets[0]))
        output: list[list[str]] = []
        for row in root.iter(f"{ns}row"):
            cells: dict[int, str] = {}
            for cell in row.findall(f"{ns}c"):
                ref = cell.get("r", "A1")
                letters = re.match(r"[A-Z]+", ref)
                col = 0
                for ch in (letters.group(0) if letters else "A"):
                    col = col * 26 + ord(ch) - 64
                col -= 1
                cell_type = cell.get("t")
                if cell_type == "inlineStr":
                    value = "".join(t.text or "" for t in cell.iter(f"{ns}t"))
                else:
                    node = cell.find(f"{ns}v")
                    value = node.text if node is not None and node.text is not None else ""
                    if cell_type == "s" and value.isdigit() and int(value) < len(shared):
                        value = shared[int(value)]
                cells[col] = value
            if cells:
                output.append([cells.get(i, "") for i in range(max(cells) + 1)])
        return output


def parse_table(payload: bytes, filename: str) -> list[list[str]]:
    if filename.lower().endswith(".xlsx"):
        return parse_xlsx_rows(payload)
    text = payload.decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t;") if text.strip() else csv.excel
    return list(csv.reader(io.StringIO(text), dialect))


# ==========================================
# Deliverable Exporters (Spec Section 105-113)
# ==========================================

def generate_cmx3600_edl(bundle: dict) -> str:
    """Generate professional CMX3600 EDL for DaVinci Resolve / Premiere Pro."""
    p = bundle["project"]
    fps = p["fps"]
    title = re.sub(r"[^\w\s-]", "_", p["name"])[:32] or "FRAMEFORGE"
    lines = [f"TITLE: {title}", "FCM: NON-DROP FRAME" if not p["is_drop_frame"] else "FCM: DROP FRAME", ""]

    for i, s in enumerate(bundle["shots"]):
        idx = i + 1
        reel = "AX"
        shot_num = s["number"]
        src_in = "00:00:00:00"
        src_out = frames_to_tc(s["duration_frames"], fps, p["is_drop_frame"])
        rec_in = s["tc_in"]
        rec_out = s["tc_out"]
        lines.append(f"{idx:03d}  {reel:<8} V     C        {src_in} {src_out} {rec_in} {rec_out}")
        lines.append(f"* FROM CLIP NAME: SHOT_{shot_num}_{s['title']}")
        if s.get("voiceover"):
            lines.append(f"* COMMENT: VO: {s['voiceover'][:60]}")
        lines.append("")

    return "\r\n".join(lines)


def generate_otio_json(bundle: dict) -> dict:
    """Generate OpenTimelineIO JSON structure."""
    p = bundle["project"]
    fps = p["fps"]
    total_f = bundle["total_frames"]
    return {
        "OTIO_SCHEMA": "Timeline.1",
        "name": p["name"],
        "global_start_time": {"OTIO_SCHEMA": "RationalTime.1", "rate": fps, "value": tc_to_frames(p["start_tc"], fps)},
        "tracks": {
            "OTIO_SCHEMA": "Stack.1",
            "children": [
                {
                    "OTIO_SCHEMA": "Track.1",
                    "name": "Video Track 1",
                    "kind": "Video",
                    "children": [
                        {
                            "OTIO_SCHEMA": "Clip.1",
                            "name": f"Shot {s['number']} - {s['title']}",
                            "source_range": {
                                "OTIO_SCHEMA": "TimeRange.1",
                                "start_time": {"OTIO_SCHEMA": "RationalTime.1", "rate": fps, "value": 0},
                                "duration": {"OTIO_SCHEMA": "RationalTime.1", "rate": fps, "value": s["duration_frames"]}
                            },
                            "metadata": {
                                "frameforge": {
                                    "shot_id": s["id"],
                                    "primary_method": s["primary_method"],
                                    "shot_size": s["shot_size"],
                                    "lens": s["lens"],
                                    "voiceover": s["voiceover"]
                                }
                            }
                        }
                        for s in bundle["shots"]
                    ]
                }
            ]
        }
    }


def generate_fcpxml(bundle: dict) -> str:
    """Generate FCPXML 1.9 export."""
    p = bundle["project"]
    fps = int(round(p["fps"]))
    total_f = bundle["total_frames"]
    root = ET.Element("fcpxml", version="1.9")
    resources = ET.SubElement(root, "resources")
    fmt = ET.SubElement(resources, "format", id="r1", name=f"FFVideoFormat1080p{fps}", frameDuration=f"1/{fps}s", width="1920", height="1080")

    library = ET.SubElement(root, "library")
    event = ET.SubElement(library, "event", name=p["name"])
    project = ET.SubElement(event, "project", name=p["name"])
    sequence = ET.SubElement(project, "sequence", format="r1", duration=f"{total_f}/{fps}s", tcStart=f"{tc_to_frames(p['start_tc'], fps)}/{fps}s")
    spine = ET.SubElement(sequence, "spine")

    cursor = 0
    for s in bundle["shots"]:
        dur = s["duration_frames"]
        clip = ET.SubElement(spine, "clip", name=f"Shot {s['number']} - {s['title']}", offset=f"{cursor}/{fps}s", duration=f"{dur}/{fps}s", start="0s")
        if s.get("voiceover"):
            note = ET.SubElement(clip, "note")
            note.text = s["voiceover"]
        cursor += dur

    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")


def generate_srt_subtitles(bundle: dict) -> str:
    """Generate standard SRT subtitle file from voiceover."""
    fps = bundle["project"]["fps"]
    lines = []
    idx = 1
    for s in bundle["shots"]:
        vo = s.get("voiceover", "").strip()
        if not vo:
            continue
        start_tc = s["tc_in"].replace(";", ":")
        end_tc = s["tc_out"].replace(";", ":")
        # Format to SRT 00:00:00,000
        # Convert frames to ms
        f_in = s["tc_in_frames"] % int(round(fps))
        f_out = s["tc_out_frames"] % int(round(fps))
        ms_in = int((f_in / fps) * 1000)
        ms_out = int((f_out / fps) * 1000)
        srt_in = f"{start_tc[:8]},{ms_in:03d}"
        srt_out = f"{end_tc[:8]},{ms_out:03d}"

        lines.append(f"{idx}")
        lines.append(f"{srt_in} --> {srt_out}")
        lines.append(vo)
        lines.append("")
        idx += 1
    return "\r\n".join(lines)


# ==========================================
# HTTP Request Handler
# ==========================================

class AppHandler(BaseHTTPRequestHandler):
    server_version = "FrameForge/3.0"

    def log_message(self, fmt, *args):
        print(json_dumps({"at": now_iso(), "remote": self.client_address[0], "req": fmt % args}), flush=True)

    def security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(),microphone=(),geolocation=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        )

    def send_json(self, status: int, data: dict | list):
        body = json_dumps(data).encode("utf-8")
        self.send_response(status)
        self.security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, message: str):
        self.send_json(status, {"error": message})

    def body(self) -> bytes:
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("invalid content length")
        if size < 0 or size > MAX_BODY:
            raise OverflowError("request body exceeds limit")
        return self.rfile.read(size)

    def json_body(self) -> dict:
        raw = self.body()
        return json.loads(raw.decode("utf-8")) if raw else {}

    def query(self) -> dict[str, list[str]]:
        return urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)

    def session(self, db: sqlite3.Connection):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(SESSION_COOKIE)
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode()).hexdigest()
        row = db.execute(
            "SELECT s.*, u.username, u.role, u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?",
            (token_hash, int(time.time()))
        ).fetchone()
        return row

    def require_auth(self, db: sqlite3.Connection, mutation=False):
        row = self.session(db)
        if not row:
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "请登录系统")
            return None
        if mutation and not hmac.compare_digest(self.headers.get("X-CSRF-Token", ""), row["csrf"]):
            self.send_error_json(HTTPStatus.FORBIDDEN, "CSRF 校验失败")
            return None
        return row

    def route(self):
        return urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)

    # ----------------------------------------
    # GET Routes
    # ----------------------------------------
    def do_GET(self):
        try:
            path = self.route()
            if path == "/healthz":
                return self.send_json(200, {"ok": True, "service": "FrameForge V3.0", "storage": "internal", "tunnel": "connected"})

            if path == "/api/session":
                with connect() as db:
                    s = self.session(db)
                    return self.send_json(200, {
                        "authenticated": bool(s),
                        "username": s["username"] if s else None,
                        "display_name": s["display_name"] if s else None,
                        "role": s["role"] if s else None,
                        "csrf": s["csrf"] if s else None
                    })

            if path == "/api/projects":
                with connect() as db:
                    if not self.require_auth(db):
                        return
                    rows = [dict(r) for r in db.execute("""
                        SELECT p.*,
                            (SELECT count(*) FROM shots s WHERE s.project_id=p.id AND s.is_deleted=0) as shot_count,
                            (SELECT coalesce(sum(duration_frames),0) FROM shots s WHERE s.project_id=p.id AND s.is_deleted=0) as total_frames
                        FROM projects p ORDER BY updated_at DESC
                    """)]
                    return self.send_json(200, rows)

            # Single project bundle
            match = re.fullmatch(r"/api/projects/([^/]+)", path)
            if match:
                with connect() as db:
                    if not self.require_auth(db):
                        return
                    bundle = project_bundle(db, match.group(1))
                    return self.send_json(200, bundle) if bundle else self.send_error_json(404, "项目不存在")

            # Deliverables export
            match = re.fullmatch(r"/api/projects/([^/]+)/export/([a-zA-Z0-9_-]+)", path)
            if match:
                with connect() as db:
                    if not self.require_auth(db):
                        return
                    pid, export_type = match.group(1), match.group(2)
                    bundle = project_bundle(db, pid)
                    if not bundle:
                        return self.send_error_json(404, "项目不存在")
                    return self.handle_export(bundle, export_type)

            # Anonymous Share
            match = re.fullmatch(r"/api/shares/([^/]+)", path)
            if match:
                with connect() as db:
                    token = match.group(1)
                    row = db.execute("SELECT * FROM share_links WHERE token=?", (token,)).fetchone()
                    if not row:
                        return self.send_error_json(404, "分享链接不存在或已撤销")
                    if row["expires_at"] and row["expires_at"] < int(time.time()):
                        return self.send_error_json(410, "该审片分享已过期")
                    db.execute("UPDATE share_links SET view_count = view_count + 1 WHERE token=?", (token,))
                    snapshot = json.loads(row["snapshot_json"])
                    return self.send_json(200, {
                        "share": {"token": token, "allow_download": bool(row["allow_download"]), "watermark": row["watermark"]},
                        "bundle": snapshot
                    })

            match = re.fullmatch(r"/api/shares/([^/]+)/download", path)
            if match:
                with connect() as db:
                    token = match.group(1)
                    row = db.execute("SELECT * FROM share_links WHERE token=?", (token,)).fetchone()
                    if not row:
                        return self.send_error_json(404, "分享链接不存在")
                    if not row["allow_download"]:
                        return self.send_error_json(403, "发布者已禁用下载")
                    snapshot = json.loads(row["snapshot_json"])
                    return self.download_share_zip(snapshot)

            # Serve Media
            match = re.fullmatch(r"/media/([^/]+)", path)
            if match:
                return self.serve_media(match.group(1))

            return self.serve_static(path)
        except Exception as exc:
            self.log_error("GET failed: %r", exc)
            return self.send_error_json(500, f"服务器内部错误: {exc}")

    # ----------------------------------------
    # POST Routes
    # ----------------------------------------
    def do_POST(self):
        try:
            path = self.route()
            if path == "/api/login":
                return self.login()

            with connect() as db:
                s = self.require_auth(db, mutation=True)
                if not s:
                    return

                if path == "/api/logout":
                    cookie = SimpleCookie(self.headers.get("Cookie", ""))
                    morsel = cookie.get(SESSION_COOKIE)
                    if morsel:
                        db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(morsel.value.encode()).hexdigest(),))
                    audit(db, s["username"], "logout", "session")
                    self.send_response(204)
                    self.security_headers()
                    self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
                    self.end_headers()
                    return

                # Create Project
                if path == "/api/projects":
                    data = self.json_body()
                    pid = str(uuid.uuid4())
                    at = now_iso()
                    name = str(data.get("name", "未命名制作项目")).strip()[:120] or "未命名制作项目"
                    ptype = str(data.get("production_type", "promo"))[:32]
                    fps = float(data.get("fps", 25.0))
                    fps = fps if fps in FPS_VALUES else 25.0
                    target = max(1.0, min(float(data.get("target_seconds", 60.0)), 86400.0))
                    start_tc = str(data.get("start_tc", "01:00:00:00")).strip()

                    db.execute("""
                        INSERT INTO projects (
                            id, name, production_type, fps, start_tc, target_seconds, aspect_ratio,
                            status, director, dp, producer, created_at, updated_at
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """, (
                        pid, name, ptype, fps, start_tc, target, str(data.get("aspect_ratio", "16:9")),
                        "development", str(data.get("director", "")), str(data.get("dp", "")),
                        str(data.get("producer", "")), at, at
                    ))

                    # Seed 5 initial template shots
                    nominal_fps = int(round(fps))
                    for i in range(1, 6):
                        sid = str(uuid.uuid4())
                        db.execute("""
                            INSERT INTO shots (
                                id, project_id, position, number, sort_index, title, duration_frames,
                                shot_size, primary_method, department, status, created_at, updated_at
                            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """, (sid, pid, i - 1, f"{i:03d}", i - 1, f"镜头 {i:03d}", nominal_fps * 3, "全景", "LIVE", "Camera", "Draft", at, at))
                        db.execute("""
                            INSERT INTO panels (id, shot_id, position, label, duration_frames, created_at, updated_at)
                            VALUES (?,?,?,?,?,?,?)
                        """, (str(uuid.uuid4()), sid, 0, "A", nominal_fps * 3, at, at))

                    audit(db, s["username"], "create_project", pid, name)
                    return self.send_json(201, project_bundle(db, pid))

                # Create Shot
                match = re.fullmatch(r"/api/projects/([^/]+)/shots", path)
                if match:
                    pid = match.group(1)
                    if not db.execute("SELECT 1 FROM projects WHERE id=?", (pid,)).fetchone():
                        return self.send_error_json(404, "项目不存在")
                    data = self.json_body()
                    pos = db.execute("SELECT COALESCE(MAX(position), -1) + 1 as n FROM shots WHERE project_id=?", (pid,)).fetchone()["n"]
                    sid = str(uuid.uuid4())
                    at = now_iso()
                    number = str(data.get("number", f"{pos+1:03d}"))[:32]
                    fps = float(db.execute("SELECT fps FROM projects WHERE id=?", (pid,)).fetchone()["fps"])
                    dur_frames = max(1, int(data.get("duration_frames", round(fps * 3))))

                    db.execute("""
                        INSERT INTO shots (
                            id, project_id, position, number, sort_index, title, chapter, scene,
                            description, voiceover, duration_frames, shot_size, lens, movement,
                            primary_method, secondary_methods, department, owner, status, created_at, updated_at
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """, (
                        sid, pid, pos, number, pos, str(data.get("title", f"镜头 {number}"))[:200],
                        str(data.get("chapter", "")), str(data.get("scene", "")),
                        str(data.get("description", "")), str(data.get("voiceover", "")),
                        dur_frames, str(data.get("shot_size", "全景")), str(data.get("lens", "")),
                        str(data.get("movement", "固定")), str(data.get("primary_method", "LIVE")),
                        json.dumps(data.get("secondary_methods", [])),
                        str(data.get("department", "Camera")), str(data.get("owner", "")),
                        "Draft", at, at
                    ))
                    db.execute("""
                        INSERT INTO panels (id, shot_id, position, label, duration_frames, created_at, updated_at)
                        VALUES (?,?,?,?,?,?,?)
                    """, (str(uuid.uuid4()), sid, 0, "A", dur_frames, at, at))
                    db.execute("UPDATE projects SET updated_at=? WHERE id=?", (at, pid))
                    audit(db, s["username"], "create_shot", sid, f"Project {pid} Shot {number}")
                    return self.send_json(201, project_bundle(db, pid))

                # Auto Timing calculation
                match = re.fullmatch(r"/api/projects/([^/]+)/auto-timing", path)
                if match:
                    pid = match.group(1)
                    bundle = project_bundle(db, pid)
                    if not bundle:
                        return self.send_error_json(404, "项目不存在")
                    p = bundle["project"]
                    shots = bundle["shots"]
                    computed = compute_auto_timing(shots, p["target_seconds"], p["fps"])
                    at = now_iso()
                    for s_item in computed:
                        db.execute("UPDATE shots SET duration_frames=?, updated_at=? WHERE id=?",
                                   (s_item["duration_frames"], at, s_item["id"]))
                    db.execute("UPDATE projects SET updated_at=? WHERE id=?", (at, pid))
                    audit(db, s["username"], "auto_timing", pid, f"Calculated {len(shots)} shots")
                    return self.send_json(200, project_bundle(db, pid))

                # Publish Anonymous Share Snapshot (Spec Section 100-104)
                match = re.fullmatch(r"/api/projects/([^/]+)/share", path)
                if match:
                    pid = match.group(1)
                    bundle = project_bundle(db, pid)
                    if not bundle:
                        return self.send_error_json(404, "项目不存在")
                    data = self.json_body()
                    token = secrets.token_urlsafe(24)
                    is_perm = 1 if data.get("is_permanent", True) else 0
                    allow_dl = 1 if data.get("allow_download", True) else 0
                    watermark = str(data.get("watermark", "")).strip()[:80]
                    expires_at = int(time.time()) + int(data.get("expire_days", 30)) * 86400 if not is_perm else None

                    # Strip sensitive db internals from snapshot
                    bundle["project"].pop("share_token", None)
                    for a in bundle["assets"]:
                        a.pop("stored_name", None)

                    db.execute("""
                        INSERT INTO share_links (token, project_id, snapshot_json, is_permanent, allow_download, watermark, expires_at, created_at)
                        VALUES (?,?,?,?,?,?,?,?)
                    """, (token, pid, json.dumps(bundle, ensure_ascii=False), is_perm, allow_dl, watermark, expires_at, now_iso()))
                    db.execute("UPDATE projects SET share_token=?, updated_at=? WHERE id=?", (token, now_iso(), pid))
                    audit(db, s["username"], "publish_share", pid, f"Token {token}")
                    return self.send_json(200, {"token": token, "url": f"/share/{token}"})

                # Upload Media Asset / Review Proxy
                match = re.fullmatch(r"/api/projects/([^/]+)/media", path)
                if match:
                    return self.upload_media(db, s, match.group(1))

                # Excel Import preview & commit
                match = re.fullmatch(r"/api/projects/([^/]+)/import-preview", path)
                if match:
                    return self.import_preview(db, s, match.group(1))

                match = re.fullmatch(r"/api/projects/([^/]+)/import-commit", path)
                if match:
                    return self.import_commit(db, s, match.group(1))

                # Comments
                match = re.fullmatch(r"/api/shots/([^/]+)/comments", path)
                if match:
                    sid = match.group(1)
                    data = self.json_body()
                    cid = str(uuid.uuid4())
                    at = now_iso()
                    text = str(data.get("text", "")).strip()[:1000]
                    if not text:
                        return self.send_error_json(400, "评论内容不能为空")
                    db.execute("""
                        INSERT INTO comments (id, shot_id, author_name, role, text, timecode, created_at)
                        VALUES (?,?,?,?,?,?,?)
                    """, (cid, sid, s["display_name"] or s["username"], str(data.get("role", "Director")), text, str(data.get("timecode", "")), at))
                    audit(db, s["username"], "add_comment", sid, text[:60])
                    return self.send_json(201, {"id": cid, "text": text, "author_name": s["display_name"] or s["username"], "created_at": at})

                # Version Snapshot
                match = re.fullmatch(r"/api/shots/([^/]+)/versions", path)
                if match:
                    sid = match.group(1)
                    shot_row = db.execute("SELECT * FROM shots WHERE id=?", (sid,)).fetchone()
                    if not shot_row:
                        return self.send_error_json(404, "镜头不存在")
                    data = self.json_body()
                    v_num = f"v{int(time.time())%1000:03d}"
                    vid = str(uuid.uuid4())
                    at = now_iso()
                    db.execute("""
                        INSERT INTO shot_versions (id, shot_id, version_num, name, snapshot_json, status, created_by, created_at)
                        VALUES (?,?,?,?,?,?,?,?)
                    """, (vid, sid, v_num, str(data.get("name", f"快照 {v_num}")), json.dumps(shot_dict(shot_row)), "Draft", s["username"], at))
                    audit(db, s["username"], "create_version", sid, v_num)
                    return self.send_json(201, {"id": vid, "version_num": v_num, "created_at": at})

            return self.send_error_json(404, "接口不存在")
        except OverflowError as exc:
            return self.send_error_json(413, str(exc))
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_error_json(400, f"参数错误: {exc}")
        except Exception as exc:
            self.log_error("POST error: %r", exc)
            return self.send_error_json(500, f"服务器处理失败: {exc}")

    # ----------------------------------------
    # PUT Routes
    # ----------------------------------------
    def do_PUT(self):
        try:
            path = self.route()
            data = self.json_body()
            with connect() as db:
                s = self.require_auth(db, mutation=True)
                if not s:
                    return

                # Project update
                match = re.fullmatch(r"/api/projects/([^/]+)", path)
                if match:
                    pid = match.group(1)
                    row = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
                    if not row:
                        return self.send_error_json(404, "项目不存在")
                    fields = {
                        "name": str(data.get("name", row["name"]))[:120],
                        "production_type": str(data.get("production_type", row["production_type"]))[:32],
                        "fps": float(data.get("fps", row["fps"])) if float(data.get("fps", row["fps"])) in FPS_VALUES else row["fps"],
                        "start_tc": str(data.get("start_tc", row["start_tc"]))[:16],
                        "target_seconds": max(1.0, min(float(data.get("target_seconds", row["target_seconds"])), 86400.0)),
                        "aspect_ratio": str(data.get("aspect_ratio", row["aspect_ratio"]))[:16],
                        "status": str(data.get("status", row["status"]))[:32],
                        "director": str(data.get("director", row["director"]))[:64],
                        "dp": str(data.get("dp", row["dp"]))[:64],
                        "producer": str(data.get("producer", row["producer"]))[:64],
                        "is_drop_frame": 1 if data.get("is_drop_frame", row["is_drop_frame"]) else 0
                    }
                    db.execute("""
                        UPDATE projects SET name=?, production_type=?, fps=?, start_tc=?, target_seconds=?,
                        aspect_ratio=?, status=?, director=?, dp=?, producer=?, is_drop_frame=?, updated_at=?
                        WHERE id=?
                    """, (*fields.values(), now_iso(), pid))
                    audit(db, s["username"], "update_project", pid)
                    return self.send_json(200, project_bundle(db, pid))

                # Batch Shots Update
                match = re.fullmatch(r"/api/projects/([^/]+)/shots", path)
                if match:
                    pid = match.group(1)
                    shots_list = data.get("shots", [])
                    if not isinstance(shots_list, list) or len(shots_list) > 10000:
                        return self.send_error_json(400, "镜头数据列表格式不正确")

                    allowed = [
                        "number", "title", "chapter", "scene", "description", "action", "performance",
                        "composition", "director_notes", "notes", "duration_frames", "locked",
                        "shot_size", "lens", "angle", "height", "movement", "equipment", "sensor",
                        "aperture", "shutter", "voiceover", "dialogue", "subtitle", "music", "sound",
                        "primary_method", "secondary_methods", "department", "owner", "status",
                        "transition", "method_data_json", "is_deleted"
                    ]
                    at = now_iso()
                    for pos, item in enumerate(shots_list):
                        sid = str(item.get("id", ""))
                        if not sid:
                            continue
                        cur = db.execute("SELECT * FROM shots WHERE id=? AND project_id=?", (sid, pid)).fetchone()
                        if not cur:
                            continue

                        vals = []
                        for k in allowed:
                            val = item.get(k, cur[k])
                            if k == "duration_frames":
                                val = max(1, min(int(val), 10_000_000))
                            elif k in ("locked", "is_deleted"):
                                val = 1 if val else 0
                            elif k == "secondary_methods":
                                val = json.dumps(val if isinstance(val, list) else [])
                            elif k == "method_data_json":
                                val = json.dumps(val if isinstance(val, dict) else {})
                            else:
                                val = str(val or "")[:10000]
                            vals.append(val)

                        db.execute(f"""
                            UPDATE shots SET position=?, {','.join(k+'=?' for k in allowed)}, updated_at=?
                            WHERE id=?
                        """, (pos, *vals, at, sid))

                        # If panels are provided inside shot, update them
                        if "panels" in item and isinstance(item["panels"], list):
                            for p_pos, p_data in enumerate(item["panels"]):
                                pid_val = p_data.get("id")
                                if pid_val:
                                    db.execute("""
                                        UPDATE panels SET label=?, duration_frames=?, drawing_json=?, notes=?, updated_at=?
                                        WHERE id=?
                                    """, (str(p_data.get("label", "A")), int(p_data.get("duration_frames", 75)),
                                          json.dumps(p_data.get("drawing_json", {})), str(p_data.get("notes", "")), at, pid_val))

                    db.execute("UPDATE projects SET updated_at=? WHERE id=?", (at, pid))
                    audit(db, s["username"], "bulk_update_shots", pid, f"{len(shots_list)} shots")
                    return self.send_json(200, project_bundle(db, pid))

                # Single Shot Update
                match = re.fullmatch(r"/api/shots/([^/]+)", path)
                if match:
                    sid = match.group(1)
                    cur = db.execute("SELECT * FROM shots WHERE id=?", (sid,)).fetchone()
                    if not cur:
                        return self.send_error_json(404, "镜头不存在")
                    pid = cur["project_id"]
                    at = now_iso()
                    for k, val in data.items():
                        if k in cur.keys() and k not in ("id", "project_id"):
                            if k in ("locked", "is_deleted"):
                                val = 1 if val else 0
                            elif k == "duration_frames":
                                val = max(1, int(val))
                            elif k in ("secondary_methods", "method_data_json") and isinstance(val, (list, dict)):
                                val = json.dumps(val)
                            db.execute(f"UPDATE shots SET {k}=?, updated_at=? WHERE id=?", (val, at, sid))

                    db.execute("UPDATE projects SET updated_at=? WHERE id=?", (at, pid))
                    audit(db, s["username"], "update_shot", sid)
                    return self.send_json(200, shot_dict(db.execute("SELECT * FROM shots WHERE id=?", (sid,)).fetchone()))

            return self.send_error_json(404, "接口不存在")
        except Exception as exc:
            self.log_error("PUT error: %r", exc)
            return self.send_error_json(400, f"更新失败: {exc}")

    # ----------------------------------------
    # DELETE Routes
    # ----------------------------------------
    def do_DELETE(self):
        try:
            path = self.route()
            with connect() as db:
                s = self.require_auth(db, mutation=True)
                if not s:
                    return

                # Soft delete / trash shot (Spec Section 128)
                match = re.fullmatch(r"/api/shots/([^/]+)", path)
                if match:
                    sid = match.group(1)
                    shot = db.execute("SELECT project_id, number FROM shots WHERE id=?", (sid,)).fetchone()
                    if shot:
                        db.execute("UPDATE shots SET is_deleted=1, updated_at=? WHERE id=?", (now_iso(), sid))
                        db.execute("UPDATE projects SET updated_at=? WHERE id=?", (now_iso(), shot["project_id"]))
                        audit(db, s["username"], "trash_shot", sid, f"Shot {shot['number']}")
                    self.send_response(204)
                    self.security_headers()
                    self.end_headers()
                    return

                # Revoke share link (Spec Section 102)
                match = re.fullmatch(r"/api/projects/([^/]+)/share", path)
                if match:
                    pid = match.group(1)
                    db.execute("DELETE FROM share_links WHERE project_id=?", (pid,))
                    db.execute("UPDATE projects SET share_token=NULL, updated_at=? WHERE id=?", (now_iso(), pid))
                    audit(db, s["username"], "revoke_share", pid)
                    self.send_response(204)
                    self.security_headers()
                    self.end_headers()
                    return

            return self.send_error_json(404, "接口不存在")
        except Exception as exc:
            self.log_error("DELETE error: %r", exc)
            return self.send_error_json(500, "删除操作失败")

    # ----------------------------------------
    # Handler Methods
    # ----------------------------------------
    def login(self):
        data = self.json_body()
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        remote = self.client_address[0]
        key = f"{remote}:{username}"
        now = int(time.time())

        with connect() as db:
            attempt = db.execute("SELECT * FROM login_attempts WHERE key=?", (key,)).fetchone()
            if attempt and attempt["window_start"] > now - 300 and attempt["attempts"] >= 5:
                audit(db, username, "login_rate_limited", remote)
                return self.send_error_json(HTTPStatus.TOO_MANY_REQUESTS, "尝试次数过多，请稍后再试")

            user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                attempts = (attempt["attempts"] + 1) if attempt and attempt["window_start"] > now - 300 else 1
                db.execute(
                    "INSERT INTO login_attempts(key, window_start, attempts) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=?, attempts=?",
                    (key, now, attempts, now, attempts)
                )
                audit(db, username, "login_failed", remote)
                return self.send_error_json(HTTPStatus.UNAUTHORIZED, "用户名或密码错误")

            db.execute("DELETE FROM login_attempts WHERE key=?", (key,))
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            csrf = secrets.token_hex(24)
            db.execute(
                "INSERT INTO sessions (token_hash, user_id, csrf, expires_at, created_at) VALUES (?,?,?,?,?)",
                (token_hash, user["id"], csrf, now + SESSION_SECONDS, now_iso())
            )
            audit(db, username, "login_success", remote)

            body = json_dumps({"csrf": csrf, "username": user["username"], "display_name": user["display_name"], "role": user["role"]}).encode()
            self.send_response(200)
            self.security_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_SECONDS}; HttpOnly; SameSite=Lax")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def upload_media(self, db: sqlite3.Connection, s: sqlite3.Row, pid: str):
        q = self.query()
        filename = clean_name(q.get("filename", ["review_proxy.webp"])[0])
        shot_id = q.get("shot_id", [None])[0]
        category = q.get("category", ["Storyboard"])[0]
        mime = self.headers.get("Content-Type", "image/webp").split(";")[0]

        payload = self.body()
        if not payload:
            return self.send_error_json(400, "文件内容为空")

        aid = str(uuid.uuid4())
        stored_name = f"{aid}_{filename}"
        target = MEDIA_ROOT / stored_name
        target.write_bytes(payload)

        db.execute("""
            INSERT INTO assets (id, project_id, filename, stored_name, mime, size, category, version, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (aid, pid, filename, stored_name, mime, len(payload), category, "v001", now_iso()))

        if shot_id and db.execute("SELECT 1 FROM shots WHERE id=?", (shot_id,)).fetchone():
            db.execute("INSERT INTO shot_asset_links (id, shot_id, asset_id, role, created_at) VALUES (?,?,?,?,?)",
                       (str(uuid.uuid4()), shot_id, aid, "Reference", now_iso()))
            # Update default panel
            db.execute("UPDATE panels SET media_id=? WHERE shot_id=? AND position=0", (aid, shot_id))

        audit(db, s["username"], "upload_media", pid, f"{filename} ({len(payload)} bytes)")
        return self.send_json(201, {"id": aid, "filename": filename, "size": len(payload), "mime": mime})

    def import_preview(self, db: sqlite3.Connection, s: sqlite3.Row, pid: str):
        q = self.query()
        filename = q.get("filename", ["import.xlsx"])[0]
        payload = self.body()
        rows = parse_table(payload, filename)
        if not rows:
            return self.send_error_json(400, "无法解析表格内容或表格为空")

        headers = [str(c).strip() for c in rows[0]]
        mapping = map_headers(headers)
        data_rows = rows[1:]

        preview_shots = []
        for r in data_rows[:10]:
            shot_sample = {}
            for f, info in mapping.items():
                col = info["col"]
                shot_sample[f] = r[col] if col < len(r) else ""
            preview_shots.append(shot_sample)

        return self.send_json(200, {
            "total_rows": len(data_rows),
            "headers": headers,
            "mapping": mapping,
            "sample_preview": preview_shots
        })

    def import_commit(self, db: sqlite3.Connection, s: sqlite3.Row, pid: str):
        data = self.json_body()
        rows = data.get("rows", [])
        mapping = data.get("mapping", {})
        fps = float(db.execute("SELECT fps FROM projects WHERE id=?", (pid,)).fetchone()["fps"])
        nominal_fps = int(round(fps))

        at = now_iso()
        imported = 0
        pos = db.execute("SELECT COALESCE(MAX(position), -1) + 1 as n FROM shots WHERE project_id=?", (pid,)).fetchone()["n"]

        for r in rows:
            if not any(str(c).strip() for c in r):
                continue
            values = {}
            for f, info in mapping.items():
                col = info.get("col", -1)
                values[f] = str(r[col]).strip() if 0 <= col < len(r) else ""

            num = values.get("number") or f"{pos+1:03d}"
            dur_raw = values.get("duration", "")
            try:
                dur_sec = float(re.sub(r"[^\d.]", "", dur_raw)) if dur_raw else 3.0
            except ValueError:
                dur_sec = 3.0
            dur_frames = max(1, int(round(dur_sec * fps)))

            sid = str(uuid.uuid4())
            p_method = values.get("primary_method", "LIVE").upper()
            if p_method not in PRODUCTION_METHODS:
                p_method = "LIVE"

            db.execute("""
                INSERT INTO shots (
                    id, project_id, position, number, sort_index, title, chapter, scene,
                    description, voiceover, duration_frames, shot_size, lens, movement,
                    primary_method, secondary_methods, department, owner, status, created_at, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                sid, pid, pos, num, pos, values.get("title", f"镜头 {num}"),
                values.get("chapter", ""), values.get("scene", ""),
                values.get("description", ""), values.get("voiceover", ""),
                dur_frames, values.get("shot_size", "全景"), values.get("lens", ""),
                values.get("movement", "固定"), p_method, json.dumps([]),
                values.get("department", "Camera"), values.get("owner", ""),
                "Draft", at, at
            ))
            db.execute("""
                INSERT INTO panels (id, shot_id, position, label, duration_frames, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?)
            """, (str(uuid.uuid4()), sid, 0, "A", dur_frames, at, at))
            pos += 1
            imported += 1

        db.execute("UPDATE projects SET updated_at=? WHERE id=?", (at, pid))
        audit(db, s["username"], "import_shots", pid, f"Imported {imported} shots")
        return self.send_json(200, {"imported": imported, "bundle": project_bundle(db, pid)})

    def handle_export(self, bundle: dict, export_type: str):
        p = bundle["project"]
        safe_name = clean_name(p["name"])

        if export_type == "edl":
            body = generate_cmx3600_edl(bundle).encode("utf-8")
            self.send_file(body, f"{safe_name}.edl", "text/plain; charset=utf-8")
        elif export_type == "otio":
            body = json_dumps(generate_otio_json(bundle)).encode("utf-8")
            self.send_file(body, f"{safe_name}.otio", "application/json; charset=utf-8")
        elif export_type == "fcpxml":
            body = generate_fcpxml(bundle).encode("utf-8")
            self.send_file(body, f"{safe_name}.fcpxml", "application/xml; charset=utf-8")
        elif export_type == "srt":
            body = generate_srt_subtitles(bundle).encode("utf-8-sig")
            self.send_file(body, f"{safe_name}.srt", "text/plain; charset=utf-8")
        elif export_type in ("shooting_list", "stock_list", "motion_list", "vfx_list", "csv"):
            body = self.generate_csv_export(bundle, export_type).encode("utf-8-sig")
            self.send_file(body, f"{safe_name}_{export_type}.csv", "text/csv; charset=utf-8")
        elif export_type == "json":
            body = json_dumps(bundle).encode("utf-8")
            self.send_file(body, f"{safe_name}_backup.json", "application/json; charset=utf-8")
        else:
            self.send_error_json(400, f"不支持的导出格式: {export_type}")

    def generate_csv_export(self, bundle: dict, kind: str) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        if kind == "shooting_list":
            writer.writerow(["镜号", "场景", "景别", "焦段", "机位/运镜", "画面描述", "制作方式", "责任人", "状态"])
            for s in bundle["shots"]:
                writer.writerow([s["number"], s["scene"], s["shot_size"], s["lens"], s["movement"], s["description"], s["primary_method"], s["owner"], s["status"]])
        elif kind == "stock_list":
            writer.writerow(["镜号", "标题", "制作方式", "画面描述", "旁白", "状态"])
            for s in bundle["shots"]:
                if s["primary_method"] == "STOCK" or "STOCK" in s.get("secondary_methods", []):
                    writer.writerow([s["number"], s["title"], s["primary_method"], s["description"], s["voiceover"], s["status"]])
        elif kind in ("motion_list", "vfx_list"):
            writer.writerow(["镜号", "标题", "制作方式", "画面描述", "责任部门", "责任人", "状态"])
            for s in bundle["shots"]:
                if s["primary_method"] in ("AE", "MG", "3D", "VFX") or any(m in ("AE", "MG", "3D", "VFX") for m in s.get("secondary_methods", [])):
                    writer.writerow([s["number"], s["title"], s["primary_method"], s["description"], s["department"], s["owner"], s["status"]])
        else:
            # Full CSV
            writer.writerow(["镜号", "篇章", "场景", "TC IN", "TC OUT", "时长(秒)", "帧数", "景别", "焦段", "运镜", "制作方式", "画面描述", "旁白", "部门", "状态"])
            for s in bundle["shots"]:
                writer.writerow([
                    s["number"], s["chapter"], s["scene"], s["tc_in"], s["tc_out"],
                    s["duration_seconds"], s["duration_frames"], s["shot_size"], s["lens"], s["movement"],
                    s["primary_method"], s["description"], s["voiceover"], s["department"], s["status"]
                ])

        return output.getvalue()

    def download_share_zip(self, snapshot: dict):
        p = snapshot["project"]
        safe_name = clean_name(p["name"])
        zip_buf = io.BytesIO()

        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("project.json", json_dumps(snapshot))
            zf.writestr(f"{safe_name}.edl", generate_cmx3600_edl(snapshot))
            zf.writestr(f"{safe_name}.srt", generate_srt_subtitles(snapshot))
            zf.writestr(f"{safe_name}_shots.csv", self.generate_csv_export(snapshot, "csv").encode("utf-8-sig"))

        zip_bytes = zip_buf.getvalue()
        self.send_file(zip_bytes, f"{safe_name}_Package.zip", "application/zip")

    def send_file(self, body: bytes, filename: str, content_type: str):
        self.send_response(200)
        self.security_headers()
        self.send_header("Content-Type", content_type)
        encoded_name = urllib.parse.quote(filename)
        self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{encoded_name}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_media(self, filename: str):
        target = (MEDIA_ROOT / clean_name(filename)).resolve()
        if not target.exists() or not str(target).startswith(str(MEDIA_ROOT)):
            return self.send_error_json(404, "媒体文件不存在")
        mime, _ = mimetypes.guess_type(target.name)
        payload = target.read_bytes()
        self.send_response(200)
        self.security_headers()
        self.send_header("Content-Type", mime or "application/octet-stream")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def serve_static(self, path: str):
        rel = "index.html" if path in ("/", "") or path.startswith("/share/") else path.lstrip("/")
        target = (STATIC_ROOT / rel).resolve()
        if not target.exists() or not str(target).startswith(str(STATIC_ROOT)):
            target = STATIC_ROOT / "index.html"

        mime, _ = mimetypes.guess_type(target.name)
        if target.name.endswith(".css"):
            mime = "text/css; charset=utf-8"
        elif target.name.endswith(".js"):
            mime = "application/javascript; charset=utf-8"
        elif target.name.endswith(".html"):
            mime = "text/html; charset=utf-8"

        payload = target.read_bytes()
        self.send_response(200)
        self.security_headers()
        self.send_header("Content-Type", mime or "text/plain")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def clean_name(value: str) -> str:
    value = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "_", value).strip(" .")
    return value[:160] or "file"


def run_server(port: int = 8080):
    init_db()
    httpd = ThreadingHTTPServer(("0.0.0.0", port), AppHandler)
    print(f"[FrameForge V3.0] Production server listening on http://0.0.0.0:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    run_server(port)
