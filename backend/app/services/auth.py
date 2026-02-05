import logging
import secrets
import hashlib
from typing import Optional
from fastapi import HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.database import get_db

logger = logging.getLogger(__name__)


class BotIdentity:
    """Bot identity from API key verification"""

    def __init__(self, bot_id: str, bot_name: str, avatar_url: Optional[str] = None):
        self.bot_id = bot_id
        self.bot_name = bot_name
        self.avatar_url = avatar_url


def generate_api_key() -> str:
    """Generate a new API key with claw_ prefix"""
    return f"claw_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    """Hash API key for storage"""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def verify_api_key(api_key: str) -> BotIdentity:
    """
    Verify API key and return bot identity.

    For MVP/development, we'll use a mock verification.
    In production, this should lookup the key in the database.
    """
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    # Development mode: accept dev_ prefixed tokens
    if settings.DEBUG and api_key.startswith("dev_"):
        # Format: dev_botid_botname
        parts = api_key.split("_", 2)
        if len(parts) >= 3:
            return BotIdentity(
                bot_id=parts[1],
                bot_name=parts[2],
                avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={parts[1]}"
            )
        return BotIdentity(
            bot_id="dev_bot_001",
            bot_name="DevBot",
            avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=dev"
        )

    # claw_ tokens must be registered and looked up in DB (handled in get_current_bot)
    if api_key.startswith("claw_"):
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")

    raise HTTPException(status_code=401, detail="Invalid API key format")


# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


async def get_current_bot(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_moltbook_identity: Optional[str] = Header(
        None, alias="X-Moltbook-Identity"),
    db: AsyncSession = Depends(get_db)
) -> BotIdentity:
    """
    FastAPI dependency to get current authenticated bot.

    Supports multiple auth methods:
    1. Authorization: Bearer <api_key> (preferred)
    2. X-Moltbook-Identity: <token> (legacy compatibility)
    """
    # Import here to avoid circular imports
    from app.models import BotScore

    api_key = None

    # Method 1: Authorization header (manual parsing, supports non-Bearer too)
    if authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]  # Remove "Bearer " prefix
        else:
            api_key = authorization

    # Method 1b: Standard HTTPBearer dependency
    if not api_key and credentials and credentials.credentials:
        api_key = credentials.credentials

    # Method 2: Legacy X-Moltbook-Identity header
    if not api_key and x_moltbook_identity:
        api_key = x_moltbook_identity

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication. Use 'Authorization: Bearer <api_key>' header"
        )

    # For claw_ API keys, lookup in database first to get registered identity
    if api_key.startswith("claw_"):
        api_key_hash = hash_api_key(api_key)
        result = await db.execute(
            select(BotScore).where(BotScore.api_key_hash == api_key_hash)
        )
        bot_score = result.scalar_one_or_none()

        if bot_score:
            # Return registered identity from database
            return BotIdentity(
                bot_id=bot_score.bot_id,
                bot_name=bot_score.bot_name,
                avatar_url=bot_score.avatar_url
            )
        logger.warning(
            "Rejected unregistered claw_ API key",
            extra={"api_key_hash_prefix": api_key_hash[:16]},
        )
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")

    return await verify_api_key(api_key)


async def get_optional_bot(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_moltbook_identity: Optional[str] = Header(
        None, alias="X-Moltbook-Identity"),
    db: AsyncSession = Depends(get_db)
) -> Optional[BotIdentity]:
    """
    Like get_current_bot but returns None instead of raising if no auth.
    Useful for endpoints that work both authenticated and unauthenticated.
    """
    from app.models import BotScore

    api_key = None

    if authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]
        else:
            api_key = authorization

    if not api_key and credentials and credentials.credentials:
        api_key = credentials.credentials

    if not api_key and x_moltbook_identity:
        api_key = x_moltbook_identity

    if not api_key:
        return None

    # For claw_ API keys, lookup in database
    if api_key.startswith("claw_"):
        api_key_hash = hash_api_key(api_key)
        result = await db.execute(
            select(BotScore).where(BotScore.api_key_hash == api_key_hash)
        )
        bot_score = result.scalar_one_or_none()

        if bot_score:
            return BotIdentity(
                bot_id=bot_score.bot_id,
                bot_name=bot_score.bot_name,
                avatar_url=bot_score.avatar_url
            )
        return None

    # Dev tokens
    if settings.DEBUG and api_key.startswith("dev_"):
        parts = api_key.split("_", 2)
        if len(parts) >= 3:
            return BotIdentity(
                bot_id=parts[1],
                bot_name=parts[2],
                avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={parts[1]}"
            )
        return BotIdentity(
            bot_id="dev_bot_001",
            bot_name="DevBot",
            avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=dev"
        )

    return None
