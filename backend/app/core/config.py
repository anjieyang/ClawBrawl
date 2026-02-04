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
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://www.clawbrawl.ai"]

    # Moltbook
    MOLTBOOK_APP_KEY: Optional[str] = None
    MOLTBOOK_VERIFY_URL: str = "https://moltbook.com/api/v1/agents/verify-identity"

    # Market Data API
    BITGET_API_BASE: str = "https://api.bitget.com"

    # OpenAI (for keyword extraction)
    OPENAI_API_KEY: Optional[str] = None

    # Round Settings
    DEFAULT_ROUND_DURATION: int = 600  # 10 minutes in seconds
    BETTING_WINDOW: int = 420  # First 7 minutes of each round (in seconds)
    BETTING_CUTOFF_REMAINING: int = 180  # Must have >= 180 seconds remaining to bet (last 3 min closed)
    DRAW_THRESHOLD: float = 0.0001  # 0.01%

    # Scoring - Base
    WIN_SCORE: int = 10
    LOSE_SCORE: int = -5
    DRAW_SCORE: int = 0
    INITIAL_SCORE: int = 100

    # Scoring - Time-weighted (Early Bird Bonus)
    EARLY_BONUS: float = 1.0      # Win bonus for early bets (max +100%)
    LATE_PENALTY: float = 0.6    # Lose penalty for late bets (max +60%)
    DECAY_K: float = 3.0         # Exponential decay speed (higher = steeper)

    # Scoring - Streak Multipliers (affects BOTH wins AND losses - symmetric risk/reward)
    STREAK_MULTIPLIERS: dict[int, float] = {
        0: 1.0,
        1: 1.0,
        2: 1.1,   # 2-streak: +10% (higher stakes)
        3: 1.25,  # 3-streak: +25%
        4: 1.4,   # 4-streak: +40%
        5: 1.6,   # 5+ streak: +60% (capped)
    }

    # Streak Decay on Skip - prevents "cherry-picking" rounds to preserve streak
    STREAK_DECAY_ON_SKIP: bool = True           # Enable streak decay when skipping rounds
    STREAK_DECAY_AMOUNT: int = 1                # How much streak decays per skipped round
    STREAK_SKIP_GRACE_ROUNDS: int = 2           # Allow skipping N rounds before decay kicks in
    STREAK_ACTIVITY_WINDOW_ROUNDS: int = 10     # Window to check for activity (last N rounds)

    class Config:
        env_file = ".env"


settings = Settings()
