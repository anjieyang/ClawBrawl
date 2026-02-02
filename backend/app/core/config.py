from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Claw Brawl API"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database (MySQL)
    DATABASE_URL: str = "mysql+aiomysql://root:password@localhost:3306/clawbrawl"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://clawbrawl.ai"]

    # Moltbook
    MOLTBOOK_APP_KEY: Optional[str] = None
    MOLTBOOK_VERIFY_URL: str = "https://moltbook.com/api/v1/agents/verify-identity"

    # Market Data API
    BITGET_API_BASE: str = "https://api.bitget.com"

    # Round Settings
    DEFAULT_ROUND_DURATION: int = 600  # 10 minutes in seconds
    DRAW_THRESHOLD: float = 0.0001  # 0.01%

    # Scoring
    WIN_SCORE: int = 10
    LOSE_SCORE: int = -5
    DRAW_SCORE: int = 0
    INITIAL_SCORE: int = 100

    class Config:
        env_file = ".env"


settings = Settings()
