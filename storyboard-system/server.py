#!/usr/bin/env python3
"""Private storyboard production system: stdlib-only HTTP + SQLite service."""
from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
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
SESSION_SECONDS = 12 * 3600
FPS_VALUES = {23.976, 24, 25, 29.97, 30, 50, 59.94, 60}
SESSION_COOKIE = "storyboard_session"

ALIASES = {
    "number": ["镜号", "镜头编号", "编号", "shot", "shot no", "shot number", "序号"],
    "title": ["镜头标题", "标题", "内容", "镜头内容", "shot title"],
    "scene": ["场景", "地点", "场景/地点", "scene", "location"],
    "description": ["画面描述", "画面内容", "画面", "description", "visual"],
    "voiceover": ["对应旁白", "旁白", "解说词", "voiceover", "vo"],
    "duration": ["时长", "时长(秒)", "时长（秒）", "duration", "seconds"],
    "shot_size": ["景别", "shot size", "framing"],
    "lens": ["焦段", "建议焦段", "镜头焦段", "lens"],
    "movement": ["机位/运镜", "运镜", "镜头运动", "movement", "camera movement"],
    "execution": ["执行方式", "制作方式", "拍摄方式", "execution"],
    "transition": ["剪辑/转场", "转场", "transition"],
    "department": ["责任部门", "责任组", "部门", "department"],
    "notes": ["备注", "制作备注", "notes"],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


class Database(sqlite3.Connection):
    """Transaction context that also closes the SQLite handle."""
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
    db = sqlite3.connect(DB_PATH, timeout=20, factory=Database)
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


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, production_type TEXT NOT NULL,
 fps REAL NOT NULL DEFAULT 25, start_tc TEXT NOT NULL DEFAULT '01:00:00:00',
 target_seconds REAL NOT NULL DEFAULT 60, aspect_ratio TEXT NOT NULL DEFAULT '16:9',
 status TEXT NOT NULL DEFAULT 'development', share_token TEXT UNIQUE,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shots (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 position INTEGER NOT NULL, number TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
 scene TEXT NOT NULL DEFAULT '', shot_size TEXT NOT NULL DEFAULT '', lens TEXT NOT NULL DEFAULT '',
 movement TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', voiceover TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', duration_frames INTEGER NOT NULL DEFAULT 75,
 locked INTEGER NOT NULL DEFAULT 0, department TEXT NOT NULL DEFAULT '', transition TEXT NOT NULL DEFAULT '',
 execution TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shots_project_position ON shots(project_id, position);
CREATE TABLE IF NOT EXISTS media (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 shot_id TEXT REFERENCES shots(id) ON DELETE SET NULL, filename TEXT NOT NULL,
 stored_name TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
 kind TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
 key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL,
 action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
);
"""


def init_db() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(SCHEMA)
        username = os.environ.get("STORYBOARD_ADMIN_USER", "admin")
        password = os.environ.get("STORYBOARD_ADMIN_PASSWORD")
        row = db.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
        if not row:
            if not password or len(password) < 12:
                raise RuntimeError("STORYBOARD_ADMIN_PASSWORD must be set and at least 12 characters")
            db.execute("INSERT INTO users VALUES(?,?,?,?,?)", (str(uuid.uuid4()), username, password_hash(password), "admin", now_iso()))


def clean_name(value: str) -> str:
    value = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "_", value).strip(" .")
    return value[:160] or "file"


def audit(db: sqlite3.Connection, actor: str, action: str, target: str, detail: str = "") -> None:
    db.execute("INSERT INTO audit_log(at,actor,action,target,detail) VALUES(?,?,?,?,?)", (now_iso(), actor, action, target, detail[:1000]))


def shot_dict(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["locked"] = bool(data["locked"])
    return data


def project_bundle(db: sqlite3.Connection, project_id: str) -> dict | None:
    p = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not p:
        return None
    shots = [shot_dict(r) for r in db.execute("SELECT * FROM shots WHERE project_id=? ORDER BY position,id", (project_id,))]
    media = [dict(r) for r in db.execute("SELECT * FROM media WHERE project_id=? ORDER BY created_at", (project_id,))]
    return {"project": dict(p), "shots": shots, "media": media}


def norm_header(value) -> str:
    return re.sub(r"[\s_\-/（）()：:]+", "", str(value or "")).lower()


def map_headers(headers: list[str]) -> dict[str, int]:
    result: dict[str, int] = {}
    normalized = [norm_header(h) for h in headers]
    for field, aliases in ALIASES.items():
        candidates = [norm_header(field)] + [norm_header(a) for a in aliases]
        for idx, header in enumerate(normalized):
            if header in candidates or any(c and (c in header or header in c) for c in candidates):
                result[field] = idx
                break
    return result


def parse_xlsx(payload: bytes) -> list[list[str]]:
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
        return parse_xlsx(payload)
    text = payload.decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t;") if text.strip() else csv.excel
    return list(csv.reader(io.StringIO(text), dialect))


class AppHandler(BaseHTTPRequestHandler):
    server_version = "StoryboardSystem/1.0"

    def log_message(self, fmt, *args):
        print(json_dumps({"at": now_iso(), "remote": self.client_address[0], "request": fmt % args}), flush=True)

    def security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(),microphone=(),geolocation=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")

    def send_json(self, status: int, data: dict | list):
        body = json_dumps(data).encode()
        self.send_response(status)
        self.security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
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
            raise OverflowError("request body too large")
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
        row = db.execute("SELECT s.*,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?", (token_hash, int(time.time()))).fetchone()
        return row

    def require_auth(self, db: sqlite3.Connection, mutation=False):
        row = self.session(db)
        if not row:
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "请登录")
            return None
        if mutation and not hmac.compare_digest(self.headers.get("X-CSRF-Token", ""), row["csrf"]):
            self.send_error_json(HTTPStatus.FORBIDDEN, "CSRF 校验失败")
            return None
        return row

    def route(self):
        return urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)

    def do_GET(self):
        try:
            path = self.route()
            if path == "/healthz":
                return self.send_json(200, {"ok": True, "storage": "internal"})
            if path == "/api/session":
                with connect() as db:
                    s = self.session(db)
                    return self.send_json(200, {"authenticated": bool(s), "username": s["username"] if s else None, "csrf": s["csrf"] if s else None})
            if path == "/api/projects":
                with connect() as db:
                    if not self.require_auth(db): return
                    rows = [dict(r) for r in db.execute("SELECT p.*,(SELECT count(*) FROM shots s WHERE s.project_id=p.id) shot_count FROM projects p ORDER BY updated_at DESC")]
                    return self.send_json(200, rows)
            match = re.fullmatch(r"/api/projects/([^/]+)", path)
            if match:
                with connect() as db:
                    if not self.require_auth(db): return
                    bundle = project_bundle(db, match.group(1))
                    return self.send_json(200, bundle) if bundle else self.send_error_json(404, "项目不存在")
            match = re.fullmatch(r"/api/shares/([^/]+)", path)
            if match:
                with connect() as db:
                    row = db.execute("SELECT id FROM projects WHERE share_token=?", (match.group(1),)).fetchone()
                    bundle = project_bundle(db, row["id"]) if row else None
                    if not bundle: return self.send_error_json(404, "分享链接不存在")
                    bundle["project"].pop("share_token", None)
                    for m in bundle["media"]:
                        m.pop("stored_name", None)
                    return self.send_json(200, bundle)
            match = re.fullmatch(r"/api/shares/([^/]+)/download", path)
            if match:
                return self.download_share(match.group(1))
            match = re.fullmatch(r"/media/([^/]+)", path)
            if match:
                return self.serve_media(match.group(1))
            return self.serve_static(path)
        except Exception as exc:
            self.log_error("GET failure: %r", exc)
            return self.send_error_json(500, "服务器内部错误")

    def do_POST(self):
        try:
            path = self.route()
            if path == "/api/login": return self.login()
            with connect() as db:
                s = self.require_auth(db, mutation=True)
                if not s: return
                if path == "/api/logout":
                    cookie = SimpleCookie(self.headers.get("Cookie", "")); morsel = cookie.get(SESSION_COOKIE)
                    if morsel: db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(morsel.value.encode()).hexdigest(),))
                    audit(db, s["username"], "logout", "session")
                    self.send_response(204); self.security_headers(); self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"); self.end_headers(); return
                if path == "/api/projects":
                    data = self.json_body(); pid = str(uuid.uuid4()); at = now_iso()
                    name = str(data.get("name", "未命名项目")).strip()[:120] or "未命名项目"
                    ptype = str(data.get("production_type", "film"))[:32]
                    fps = float(data.get("fps", 25)); fps = fps if fps in FPS_VALUES else 25
                    target = max(1, min(float(data.get("target_seconds", 60)), 86400))
                    db.execute("INSERT INTO projects(id,name,production_type,fps,start_tc,target_seconds,aspect_ratio,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (pid,name,ptype,fps,"01:00:00:00",target,str(data.get("aspect_ratio","16:9"))[:16],"development",at,at))
                    audit(db,s["username"],"create_project",pid,name)
                    return self.send_json(201, project_bundle(db,pid))
                match = re.fullmatch(r"/api/projects/([^/]+)/shots", path)
                if match:
                    data=self.json_body(); pid=match.group(1)
                    if not db.execute("SELECT 1 FROM projects WHERE id=?",(pid,)).fetchone(): return self.send_error_json(404,"项目不存在")
                    pos=db.execute("SELECT COALESCE(MAX(position),-1)+1 n FROM shots WHERE project_id=?",(pid,)).fetchone()["n"]
                    sid=str(uuid.uuid4()); at=now_iso(); number=str(data.get("number",pos+1))[:32]
                    db.execute("INSERT INTO shots(id,project_id,position,number,title,duration_frames,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",(sid,pid,pos,number,str(data.get("title","新镜头"))[:200],max(1,int(data.get("duration_frames",round(float(db.execute('SELECT fps FROM projects WHERE id=?',(pid,)).fetchone()[0])*3)))),at,at))
                    db.execute("UPDATE projects SET updated_at=? WHERE id=?",(at,pid)); audit(db,s["username"],"create_shot",sid,pid)
                    return self.send_json(201,shot_dict(db.execute("SELECT * FROM shots WHERE id=?",(sid,)).fetchone()))
                match = re.fullmatch(r"/api/projects/([^/]+)/share", path)
                if match:
                    token=secrets.token_urlsafe(24); db.execute("UPDATE projects SET share_token=?,updated_at=? WHERE id=?",(token,now_iso(),match.group(1)))
                    if db.total_changes == 0: return self.send_error_json(404,"项目不存在")
                    audit(db,s["username"],"create_share",match.group(1)); return self.send_json(200,{"token":token,"url":f"/share/{token}"})
                match = re.fullmatch(r"/api/projects/([^/]+)/import", path)
                if match: return self.import_sheet(db,s,match.group(1))
                match = re.fullmatch(r"/api/projects/([^/]+)/media", path)
                if match: return self.upload_media(db,s,match.group(1))
            return self.send_error_json(404,"接口不存在")
        except OverflowError as exc: return self.send_error_json(413,str(exc))
        except (ValueError, json.JSONDecodeError) as exc: return self.send_error_json(400,f"输入无效：{exc}")
        except Exception as exc:
            self.log_error("POST failure: %r",exc); return self.send_error_json(500,"服务器内部错误")

    def do_PUT(self):
        try:
            path=self.route(); data=self.json_body()
            with connect() as db:
                s=self.require_auth(db,mutation=True)
                if not s:return
                match=re.fullmatch(r"/api/projects/([^/]+)",path)
                if match:
                    pid=match.group(1); row=db.execute("SELECT * FROM projects WHERE id=?",(pid,)).fetchone()
                    if not row:return self.send_error_json(404,"项目不存在")
                    fields={k:data.get(k,row[k]) for k in ("name","production_type","fps","start_tc","target_seconds","aspect_ratio","status")}
                    fields["fps"]=float(fields["fps"]); fields["fps"]=fields["fps"] if fields["fps"] in FPS_VALUES else row["fps"]
                    fields["target_seconds"]=max(1,min(float(fields["target_seconds"]),86400)); fields["name"]=str(fields["name"])[:120]
                    db.execute("UPDATE projects SET name=?,production_type=?,fps=?,start_tc=?,target_seconds=?,aspect_ratio=?,status=?,updated_at=? WHERE id=?",(*fields.values(),now_iso(),pid))
                    audit(db,s["username"],"update_project",pid); return self.send_json(200,project_bundle(db,pid))
                match=re.fullmatch(r"/api/projects/([^/]+)/shots",path)
                if match:
                    pid=match.group(1); shots=data.get("shots",[])
                    if not isinstance(shots,list) or len(shots)>10000:return self.send_error_json(400,"镜头数据无效")
                    allowed=("number","title","scene","shot_size","lens","movement","description","voiceover","notes","duration_frames","locked","department","transition","execution","status")
                    at=now_iso()
                    for pos,item in enumerate(shots):
                        sid=str(item.get("id","")); row=db.execute("SELECT * FROM shots WHERE id=? AND project_id=?",(sid,pid)).fetchone()
                        if not row: continue
                        vals=[]
                        for key in allowed:
                            value=item.get(key,row[key])
                            if key=="duration_frames": value=max(1,min(int(value),10_000_000))
                            elif key=="locked": value=1 if value else 0
                            else: value=str(value)[:10000]
                            vals.append(value)
                        db.execute(f"UPDATE shots SET position=?,{','.join(k+'=?' for k in allowed)},updated_at=? WHERE id=?",(pos,*vals,at,sid))
                    db.execute("UPDATE projects SET updated_at=? WHERE id=?",(at,pid)); audit(db,s["username"],"bulk_update_shots",pid,str(len(shots)))
                    return self.send_json(200,project_bundle(db,pid))
            return self.send_error_json(404,"接口不存在")
        except Exception as exc:
            self.log_error("PUT failure: %r",exc); return self.send_error_json(400,f"保存失败：{exc}")

    def do_DELETE(self):
        try:
            path=self.route()
            with connect() as db:
                s=self.require_auth(db,mutation=True)
                if not s:return
                match=re.fullmatch(r"/api/shots/([^/]+)",path)
                if match:
                    sid=match.group(1); db.execute("DELETE FROM shots WHERE id=?",(sid,)); audit(db,s["username"],"delete_shot",sid)
                    self.send_response(204); self.security_headers(); self.end_headers(); return
                match=re.fullmatch(r"/api/projects/([^/]+)/share",path)
                if match:
                    db.execute("UPDATE projects SET share_token=NULL,updated_at=? WHERE id=?",(now_iso(),match.group(1))); audit(db,s["username"],"revoke_share",match.group(1))
                    self.send_response(204); self.security_headers(); self.end_headers(); return
            return self.send_error_json(404,"接口不存在")
        except Exception as exc:
            self.log_error("DELETE failure: %r",exc); return self.send_error_json(500,"删除失败")

    def login(self):
        data=self.json_body(); username=str(data.get("username","")); password=str(data.get("password","")); remote=self.client_address[0]; key=f"{remote}:{username}"; now=int(time.time())
        with connect() as db:
            attempt=db.execute("SELECT * FROM login_attempts WHERE key=?",(key,)).fetchone()
            if attempt and now-attempt["window_start"]<900 and attempt["attempts"]>=8:return self.send_error_json(429,"尝试次数过多，请稍后再试")
            user=db.execute("SELECT * FROM users WHERE username=?",(username,)).fetchone()
            if not user or not verify_password(password,user["password_hash"]):
                if not attempt or now-attempt["window_start"]>=900: db.execute("INSERT OR REPLACE INTO login_attempts VALUES(?,?,1)",(key,now))
                else: db.execute("UPDATE login_attempts SET attempts=attempts+1 WHERE key=?",(key,))
                audit(db,username or "anonymous","login_failed","session",remote); time.sleep(0.35); return self.send_error_json(401,"用户名或密码错误")
            db.execute("DELETE FROM login_attempts WHERE key=?",(key,)); token=secrets.token_urlsafe(32); csrf=secrets.token_urlsafe(24)
            db.execute("DELETE FROM sessions WHERE expires_at<?",(now,)); db.execute("INSERT INTO sessions VALUES(?,?,?,?,?)",(hashlib.sha256(token.encode()).hexdigest(),user["id"],csrf,now+SESSION_SECONDS,now_iso()))
            audit(db,username,"login","session",remote)
            body=json_dumps({"authenticated":True,"username":username,"csrf":csrf}).encode(); self.send_response(200); self.security_headers(); self.send_header("Content-Type","application/json; charset=utf-8"); self.send_header("Cache-Control","no-store"); self.send_header("Set-Cookie",f"{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_SECONDS}; HttpOnly; SameSite=Lax"); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)

    def import_sheet(self,db,s,pid):
        if not db.execute("SELECT 1 FROM projects WHERE id=?",(pid,)).fetchone():return self.send_error_json(404,"项目不存在")
        filename=clean_name(self.query().get("filename",["import.xlsx"])[0]); rows=parse_table(self.body(),filename)
        if not rows:return self.send_error_json(400,"表格为空")
        header_idx=next((i for i,r in enumerate(rows[:20]) if len(map_headers(r))>=2),0); headers=rows[header_idx]; mapping=map_headers(headers)
        if not mapping:return self.send_error_json(400,"未识别到可导入列")
        project=db.execute("SELECT fps FROM projects WHERE id=?",(pid,)).fetchone(); fps=float(project["fps"]); pos=db.execute("SELECT COALESCE(MAX(position),-1)+1 n FROM shots WHERE project_id=?",(pid,)).fetchone()["n"]; imported=0; at=now_iso()
        for row in rows[header_idx+1:]:
            if not any(str(x).strip() for x in row):continue
            def get(field,default=""):
                idx=mapping.get(field); return str(row[idx]).strip() if idx is not None and idx<len(row) else default
            duration_raw=get("duration","3"); duration_match=re.search(r"\d+(?:\.\d+)?",duration_raw); frames=max(1,round(float(duration_match.group())*fps)) if duration_match else round(3*fps)
            sid=str(uuid.uuid4()); number=get("number",str(pos+1))[:32]; title=get("title",get("description","新镜头")[:80])
            db.execute("INSERT INTO shots(id,project_id,position,number,title,scene,shot_size,lens,movement,description,voiceover,notes,duration_frames,department,transition,execution,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(sid,pid,pos,number,title,get("scene"),get("shot_size"),get("lens"),get("movement"),get("description"),get("voiceover"),get("notes"),frames,get("department"),get("transition"),get("execution"),at,at)); pos+=1; imported+=1
        db.execute("UPDATE projects SET updated_at=? WHERE id=?",(at,pid)); audit(db,s["username"],"import_sheet",pid,f"{filename}:{imported}")
        return self.send_json(200,{"imported":imported,"headers":headers,"mapping":mapping,"bundle":project_bundle(db,pid)})

    def upload_media(self,db,s,pid):
        if not db.execute("SELECT 1 FROM projects WHERE id=?",(pid,)).fetchone():return self.send_error_json(404,"项目不存在")
        query=self.query(); filename=clean_name(query.get("filename",["media.bin"])[0]); mime=self.headers.get("Content-Type","application/octet-stream").split(";",1)[0].lower(); allowed=(mime.startswith("image/") or mime.startswith("video/"))
        if not allowed:return self.send_error_json(415,"仅支持浏览器压缩后的图片或视频")
        payload=self.body(); mid=str(uuid.uuid4()); ext=Path(filename).suffix.lower()[:10]; stored=f"{mid}{ext}"; folder=MEDIA_ROOT/pid; folder.mkdir(parents=True,exist_ok=True); (folder/stored).write_bytes(payload)
        shot_id=query.get("shot_id",[None])[0]; kind="image" if mime.startswith("image/") else "video"; db.execute("INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?)",(mid,pid,shot_id,filename,stored,mime,len(payload),kind,now_iso())); audit(db,s["username"],"upload_media",mid,f"{filename}:{len(payload)}")
        return self.send_json(201,dict(db.execute("SELECT * FROM media WHERE id=?",(mid,)).fetchone()))

    def serve_media(self,mid):
        with connect() as db:
            row=db.execute("SELECT m.*,p.share_token FROM media m JOIN projects p ON p.id=m.project_id WHERE m.id=?",(mid,)).fetchone()
            if not row:return self.send_error_json(404,"素材不存在")
            share=self.query().get("share",[None])[0]
            if not (share and row["share_token"] and hmac.compare_digest(share,row["share_token"])) and not self.session(db):return self.send_error_json(401,"请登录")
            file=MEDIA_ROOT/row["project_id"]/row["stored_name"]
            if not file.is_file():return self.send_error_json(404,"素材文件不存在")
            size=file.stat().st_size; self.send_response(200); self.security_headers(); self.send_header("Content-Type",row["mime"]); self.send_header("Content-Length",str(size)); self.send_header("Content-Disposition",f"inline; filename*=UTF-8''{urllib.parse.quote(row['filename'])}"); self.send_header("Cache-Control","private, max-age=3600"); self.end_headers()
            with file.open("rb") as fh:
                while chunk:=fh.read(1024*1024):self.wfile.write(chunk)

    def download_share(self,token):
        with connect() as db:
            row=db.execute("SELECT id,name FROM projects WHERE share_token=?",(token,)).fetchone()
            if not row:return self.send_error_json(404,"分享链接不存在")
            bundle=project_bundle(db,row["id"]); out=io.BytesIO()
            with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("project.json",json.dumps(bundle,ensure_ascii=False,indent=2))
                csv_out=io.StringIO(); writer=csv.writer(csv_out); writer.writerow(["镜号","标题","场景","景别","焦段","运镜","画面描述","旁白","时长帧","锁定","执行方式","转场","备注"])
                for shot in bundle["shots"]:writer.writerow([shot[k] for k in ("number","title","scene","shot_size","lens","movement","description","voiceover","duration_frames","locked","execution","transition","notes")])
                zf.writestr("shots.csv",csv_out.getvalue().encode("utf-8-sig"))
                for media in bundle["media"]:
                    file=MEDIA_ROOT/row["id"]/media["stored_name"]
                    if file.is_file():zf.write(file,f"media/{clean_name(media['filename'])}")
            body=out.getvalue(); self.send_response(200); self.security_headers(); self.send_header("Content-Type","application/zip"); self.send_header("Content-Length",str(len(body))); self.send_header("Content-Disposition",f"attachment; filename*=UTF-8''{urllib.parse.quote(clean_name(row['name'])+'.zip')}"); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(body)

    def serve_static(self,path):
        if path.startswith("/share/"): path="/index.html"
        if path=="/":path="/index.html"
        rel=Path(path.lstrip("/")); file=(STATIC_ROOT/rel).resolve()
        if STATIC_ROOT not in file.parents and file!=STATIC_ROOT:return self.send_error_json(403,"禁止访问")
        if not file.is_file():file=STATIC_ROOT/"index.html"
        body=file.read_bytes(); self.send_response(200); self.security_headers(); self.send_header("Content-Type",mimetypes.guess_type(file.name)[0] or "application/octet-stream"); self.send_header("Content-Length",str(len(body))); self.send_header("Cache-Control","public, max-age=300" if file.name!="index.html" else "no-cache"); self.end_headers(); self.wfile.write(body)


def main():
    init_db(); host=os.environ.get("STORYBOARD_HOST","127.0.0.1"); port=int(os.environ.get("STORYBOARD_PORT","18765")); server=ThreadingHTTPServer((host,port),AppHandler); print(json_dumps({"at":now_iso(),"event":"startup","host":host,"port":port,"data":str(DATA_ROOT)}),flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__=="__main__":main()
