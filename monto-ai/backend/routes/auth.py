"""
Auth Route — /auth
Real parent accounts, backed by Supabase Auth (not just local storage).

Flow:
  1. Parent app calls POST /auth/signup with name/email/password → account is
     created (pre-confirmed, no email-verification step) and a session is
     returned immediately.
  2. Parent app calls POST /auth/login on subsequent app opens to exchange
     email/password for a fresh session.

The service-role key (already used elsewhere in this backend) is required for
the admin.create_user call, so this must stay server-side — the parent app
never talks to Supabase directly.
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthUser(BaseModel):
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    access_token: str
    user: AuthUser


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    db = get_supabase()

    try:
        db.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
            "user_metadata": {"name": req.name},
        })
    except Exception as exc:
        message = str(exc)
        # Supabase's admin.create_user returns a generic 403 "User not allowed"
        # for a duplicate email rather than a specific "already registered"
        # error, so treat that as the duplicate-account case here.
        if "already" in message.lower() or "not allowed" in message.lower():
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        logger.warning(f"[Auth] signup failed: {exc}")
        raise HTTPException(status_code=400, detail="Couldn't create account — try again.")

    return await _sign_in(db, req.email, req.password)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    db = get_supabase()
    return await _sign_in(db, req.email, req.password)


async def _sign_in(db, email: str, password: str) -> AuthResponse:
    try:
        result = db.auth.sign_in_with_password({"email": email, "password": password})
    except Exception as exc:
        logger.warning(f"[Auth] login failed for {email}: {exc}")
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    session = result.session
    user = result.user
    if not session or not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    name = (user.user_metadata or {}).get("name", "") if user.user_metadata else ""
    return AuthResponse(
        access_token=session.access_token,
        user=AuthUser(id=user.id, name=name, email=user.email or email),
    )
