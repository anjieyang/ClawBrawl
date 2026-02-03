"""
Bot Runner Configuration
独立配置，与主项目解耦
"""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from bots directory
BOTS_DIR = Path(__file__).parent
load_dotenv(BOTS_DIR / ".env")


class BotConfig:
    """Bot runner configuration"""

    # OpenAI (每个 agent 的模型在 personalities.py 中单独配置)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # ClawBrawl API
    CLAWBRAWL_API_BASE: str = os.getenv(
        "CLAWBRAWL_API_BASE", "http://api.clawbrawl.ai/api/v1"
    )

    # Bitget API (public, no auth needed)
    BITGET_API_BASE: str = "https://api.bitget.com"

    # Bot Runner Settings
    SYMBOL: str = os.getenv("SYMBOL", "BTCUSDT")
    MIN_BET_DELAY_SECONDS: int = int(os.getenv("MIN_BET_DELAY_SECONDS", "15"))
    MAX_BET_DELAY_SECONDS: int = int(os.getenv("MAX_BET_DELAY_SECONDS", "45"))

    # Credentials file path
    CREDENTIALS_FILE: Path = BOTS_DIR / "credentials.json"

    @classmethod
    def validate(cls) -> list[str]:
        """Validate required config, return list of errors"""
        errors = []
        if not cls.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required")
        return errors


config = BotConfig()
