import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from app.core.config import settings
try:
    from jose import jwt
    HAS_JOSE = True
except ImportError:
    HAS_JOSE = False

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["argon2", "pbkdf2_sha256"], deprecated="auto")
    HAS_PASSLIB = True
except ImportError:
    HAS_PASSLIB = False


def get_password_hash(password: str) -> str:
    """Hash password using Argon2id or standard PBKDF2."""
    if HAS_PASSLIB:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass
    salt = secrets.token_bytes(16)
    rounds = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return f"pbkdf2_sha256${rounds}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    if HAS_PASSLIB and not hashed_password.startswith("pbkdf2_sha256$"):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass
    if hashed_password.startswith("pbkdf2_sha256$"):
        try:
            _, rounds, salt, expected = hashed_password.split("$", 3)
            salt_b = base64.urlsafe_b64decode(salt)
            actual = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt_b, int(rounds))
            return hmac.compare_digest(actual, base64.urlsafe_b64decode(expected))
        except Exception:
            return False
    return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s.encode('ascii'))


def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(datetime.now(timezone.utc).timestamp())})

    if HAS_JOSE:
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Standard library fallback JWT
    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = _b64url_encode(json.dumps(header).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(to_encode).encode("utf-8"))
    msg = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).digest()
    s_b64 = _b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{s_b64}"


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate signed JWT token."""
    if HAS_JOSE:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except Exception:
            pass

    # Standard library fallback JWT verification
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h_b64, p_b64, s_b64 = parts
        msg = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).digest()
        actual_sig = _b64url_decode(s_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
        # Check exp
        if "exp" in payload and payload["exp"] < int(datetime.now(timezone.utc).timestamp()):
            return None
        return payload
    except Exception:
        return None
