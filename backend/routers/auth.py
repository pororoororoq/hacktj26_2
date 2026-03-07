"""
Authentication endpoints.

POST /api/register  – create account, returns token
POST /api/login     – verify credentials, returns token
GET  /api/me        – return current user info

Token format:  "<user_id>:<HMAC-SHA256>"
No external JWT library needed – uses Python built-ins only.
"""

import hashlib
import hmac
import os
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from database import get_db

SECRET_KEY = os.environ.get("SECRET_KEY", "vr-dev-secret-2026")

router = APIRouter()


# ── Password hashing (PBKDF2-HMAC, built-in) ─────────────────────────────────

def _hash_password(password: str) -> str:
    salt = hashlib.sha256(os.urandom(32)).hexdigest()[:16]
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}:{h}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
        return hmac.compare_digest(expected, h)
    except Exception:
        return False


# ── Token ────────────────────────────────────────────────────────────────────

def _make_token(user_id: int) -> str:
    payload = str(user_id)
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{user_id}:{sig}"


def verify_token(token: str) -> int | None:
    try:
        user_id_str, sig = token.split(":", 1)
        expected = hmac.new(SECRET_KEY.encode(), user_id_str.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(sig, expected):
            return int(user_id_str)
    except Exception:
        pass
    return None


def get_current_user(authorization: str = Header(None)) -> int:
    """FastAPI dependency: extracts and validates Bearer token, returns user_id."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    user_id = verify_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


# ── Request models ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/register")
def register(req: RegisterRequest):
    """Create a new patient account."""
    if len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)",
            (req.username.lower().strip(), _hash_password(req.password), req.name.strip()),
        )
        db.commit()
        user_id = cursor.lastrowid
        return {"token": _make_token(user_id), "user_id": user_id, "name": req.name.strip()}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already taken")


@router.post("/api/login")
def login(req: LoginRequest):
    """Authenticate and return a token."""
    db = get_db()
    row = db.execute(
        "SELECT id, name, password_hash FROM users WHERE username = ?",
        (req.username.lower().strip(),),
    ).fetchone()
    if not row or not _verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"token": _make_token(row["id"]), "user_id": row["id"], "name": row["name"]}


@router.get("/api/me")
def get_me(user_id: int = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    db = get_db()
    row = db.execute(
        "SELECT id, username, name FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": row["id"], "username": row["username"], "name": row["name"]}
