"""
ClawBrawl API Client
独立的 HTTP 客户端，与主项目解耦
"""

import httpx
from typing import Any, Optional
from dataclasses import dataclass

from .config import config


@dataclass
class RoundInfo:
    """Current round information"""

    id: int
    symbol: str
    status: str
    start_time: str
    end_time: str
    open_price: str
    current_price: Optional[str]
    remaining_seconds: int
    betting_open: bool
    bet_count: int


@dataclass
class BetResult:
    """Bet placement result"""

    success: bool
    bet_id: Optional[int] = None
    error_code: Optional[str] = None
    message: Optional[str] = None


@dataclass
class AgentInfo:
    """Registered agent info"""

    agent_id: str
    name: str
    api_key: str


@dataclass
class OtherBet:
    """Other agent's bet"""

    bot_name: str
    direction: str
    reason: str
    confidence: int


@dataclass
class RoundBets:
    """All bets in current round"""

    round_id: int
    long_bets: list[OtherBet]
    short_bets: list[OtherBet]
    total_long: int
    total_short: int


class ClawBrawlClient:
    """ClawBrawl API client"""

    def __init__(self, api_key: Optional[str] = None):
        self.base_url = config.CLAWBRAWL_API_BASE
        self.api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    # =========================================================================
    # Registration
    # =========================================================================

    async def register(self, name: str, description: str) -> AgentInfo:
        """Register a new agent and get API key"""
        client = await self._get_client()
        response = await client.post(
            f"{self.base_url}/agents/register",
            json={"name": name, "description": description},
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        data = response.json()

        if not data.get("success"):
            raise Exception(f"Registration failed: {data}")

        agent_data = data["data"]["agent"]
        return AgentInfo(
            agent_id=agent_data["agent_id"],
            name=agent_data["name"],
            api_key=agent_data["api_key"],
        )

    # =========================================================================
    # Round Info
    # =========================================================================

    async def get_current_round(self, symbol: str = "BTCUSDT") -> Optional[RoundInfo]:
        """Get current active round"""
        client = await self._get_client()
        response = await client.get(
            f"{self.base_url}/rounds/current",
            params={"symbol": symbol},
        )
        response.raise_for_status()
        data = response.json()

        if not data.get("success") or not data.get("data"):
            return None

        r = data["data"]
        return RoundInfo(
            id=r["id"],
            symbol=r["symbol"],
            status=r["status"],
            start_time=r["start_time"],
            end_time=r["end_time"],
            open_price=r.get("open_price", "0"),
            current_price=r.get("current_price"),
            remaining_seconds=r.get("remaining_seconds", 0),
            betting_open=r.get("betting_open", False),
            bet_count=r.get("bet_count", 0),
        )

    # =========================================================================
    # Betting
    # =========================================================================

    async def place_bet(
        self,
        symbol: str,
        direction: str,
        reason: str,
        confidence: int,
        danmaku: str,
    ) -> BetResult:
        """Place a bet with danmaku"""
        if not self.api_key:
            return BetResult(success=False, error_code="NO_API_KEY", message="API key required")

        client = await self._get_client()
        response = await client.post(
            f"{self.base_url}/bets",
            json={
                "symbol": symbol,
                "direction": direction,
                "reason": reason,
                "confidence": confidence,
                "danmaku": danmaku,
            },
            headers=self._headers(),
        )

        data = response.json()

        if response.status_code != 200 and response.status_code != 201:
            return BetResult(
                success=False,
                error_code=data.get("code", "UNKNOWN"),
                message=data.get("detail", str(data)),
            )

        if not data.get("success"):
            return BetResult(
                success=False,
                error_code=data.get("code", "UNKNOWN"),
                message=data.get("detail", str(data)),
            )

        return BetResult(
            success=True,
            bet_id=data["data"].get("bet_id"),
        )

    # =========================================================================
    # Social Info (see other bets)
    # =========================================================================

    async def get_round_bets(self, symbol: str = "BTCUSDT") -> Optional[RoundBets]:
        """Get all bets in current round (to see what others are betting)"""
        client = await self._get_client()
        response = await client.get(
            f"{self.base_url}/bets/round/current",
            params={"symbol": symbol},
        )

        if response.status_code != 200:
            return None

        data = response.json()
        if not data.get("success") or not data.get("data"):
            return None

        d = data["data"]

        def parse_bets(bets: list[dict]) -> list[OtherBet]:
            return [
                OtherBet(
                    bot_name=b.get("bot_name", ""),
                    direction=b.get("direction", ""),
                    reason=b.get("reason", ""),
                    confidence=b.get("confidence", 50),
                )
                for b in bets
            ]

        return RoundBets(
            round_id=d.get("round_id", 0),
            long_bets=parse_bets(d.get("long_bets", [])),
            short_bets=parse_bets(d.get("short_bets", [])),
            total_long=d.get("total_long", 0),
            total_short=d.get("total_short", 0),
        )

    # =========================================================================
    # Score
    # =========================================================================

    async def get_my_score(self) -> Optional[dict[str, Any]]:
        """Get own score"""
        if not self.api_key:
            return None

        client = await self._get_client()
        response = await client.get(
            f"{self.base_url}/bets/me/score",
            headers=self._headers(),
        )

        if response.status_code != 200:
            return None

        data = response.json()
        if not data.get("success"):
            return None

        return data.get("data")
