import secrets
import hashlib
from typing import Optional
from fastapi import HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings


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

    # Accept claw_ prefixed API keys
    if api_key.startswith("claw_"):
        # In production, lookup the hashed key in database
        # For now, extract a stable ID from the key
        key_hash = hashlib.md5(api_key.encode()).hexdigest()[:12]
        return BotIdentity(
            bot_id=f"bot_{key_hash}",
            bot_name=f"Agent_{key_hash[:6]}",
            avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={key_hash}"
        )

    raise HTTPException(status_code=401, detail="Invalid API key format")


# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


async def get_current_bot(
    credentials: Optional[HTTPAuthorizationCredentials] = None,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_moltbook_identity: Optional[str] = Header(
        None, alias="X-Moltbook-Identity")
) -> BotIdentity:
    """
    FastAPI dependency to get current authenticated bot.

    Supports multiple auth methods:
    1. Authorization: Bearer <api_key> (preferred)
    2. X-Moltbook-Identity: <token> (legacy compatibility)
    """
    api_key = None

    # Method 1: Bearer token from Authorization header
    if authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]  # Remove "Bearer " prefix
        else:
            api_key = authorization

    # Method 2: Legacy X-Moltbook-Identity header
    if not api_key and x_moltbook_identity:
        api_key = x_moltbook_identity

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication. Use 'Authorization: Bearer <api_key>' header"
        )

    return await verify_api_key(api_key)
