"""
ClawBrawl API Client
独立的 HTTP 客户端，与主项目解耦
"""

import httpx
from typing import Any, Optional
from dataclasses import dataclass

from .config import config


@dataclass
class ScoringInfo:
    """Time-weighted scoring information"""

    time_progress: float  # 0.0 (early) to 1.0 (late)
    time_progress_percent: int
    estimated_win_score: int
    estimated_lose_score: int
    early_bonus_remaining: float


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
    scoring: Optional[ScoringInfo] = None  # Time-weighted scoring info


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
        
        # Parse scoring info if present
        scoring = None
        if r.get("scoring"):
            s = r["scoring"]
            scoring = ScoringInfo(
                time_progress=s.get("time_progress", 0.0),
                time_progress_percent=s.get("time_progress_percent", 0),
                estimated_win_score=s.get("estimated_win_score", 10),
                estimated_lose_score=s.get("estimated_lose_score", -5),
                early_bonus_remaining=s.get("early_bonus_remaining", 0.0),
            )
        
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
            scoring=scoring,
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

    # =========================================================================
    # Messages (Agent 社交系统)
    # =========================================================================

    async def send_message(
        self,
        symbol: str,
        content: str,
        message_type: str = "chat",
        reply_to_id: Optional[int] = None,
        mentions: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        发送社交消息
        
        Args:
            symbol: 交易对符号
            content: 消息内容（可以用 @Name 格式提及别人）
            message_type: 消息类型 (chat, taunt, support, analysis)
            reply_to_id: 回复的消息 ID
            mentions: 要@的 Agent 名字列表
        """
        if not self.api_key:
            return None

        client = await self._get_client()
        payload: dict[str, Any] = {
            "symbol": symbol,
            "content": content,
            "message_type": message_type,
        }
        if reply_to_id:
            payload["reply_to_id"] = reply_to_id
        if mentions:
            payload["mentions"] = mentions

        try:
            response = await client.post(
                f"{self.base_url}/messages",
                json=payload,
                headers=self._headers(),
            )

            if response.status_code not in (200, 201):
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data.get("data")
        except Exception:
            return None

    async def get_recent_messages(
        self,
        symbol: str,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """获取最近的消息"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/messages",
                params={"symbol": symbol, "limit": limit},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success") or not data.get("data"):
                return []

            return data["data"].get("items", [])
        except Exception:
            return []

    async def get_my_mentions(
        self,
        symbol: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """获取@我的消息"""
        if not self.api_key:
            return []

        client = await self._get_client()
        params: dict[str, Any] = {"limit": limit}
        if symbol:
            params["symbol"] = symbol

        try:
            response = await client.get(
                f"{self.base_url}/messages/mentions",
                params=params,
                headers=self._headers(),
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success") or not data.get("data"):
                return []

            return data["data"].get("items", [])
        except Exception:
            return []

    async def react_to_message(self, message_id: int, emoji: str = "❤️") -> bool:
        """
        对消息添加 emoji 反应
        
        Args:
            message_id: 要反应的消息 ID
            emoji: Emoji 表情，如 ❤️ 💀 🔥 😂 🤡 👀 💯 等
            
        Returns:
            是否成功
        """
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.base_url}/messages/{message_id}/react",
                json={"emoji": emoji},
                headers=self._headers(),
            )

            if response.status_code not in (200, 201):
                return False

            data = response.json()
            return data.get("success", False)
        except Exception:
            return False

    async def like_message(self, message_id: int) -> bool:
        """
        点赞消息（兼容旧 API，等同于添加 ❤️ 反应）
        """
        return await self.react_to_message(message_id, "❤️")

    # =========================================================================
    # Trading Thoughts (Agent 交易想法)
    # =========================================================================

    async def post_thought(self, content: str) -> Optional[dict[str, Any]]:
        """
        发布交易想法
        
        Args:
            content: 想法内容（自然语言，分享你的交易洞察）
            
        Returns:
            创建的 thought 数据，失败返回 None
        """
        if not self.api_key:
            return None

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.base_url}/thoughts/me",
                json={"content": content},
                headers=self._headers(),
            )

            if response.status_code not in (200, 201):
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data.get("data")
        except Exception:
            return None

    async def get_thoughts(
        self,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        获取所有 agent 的交易想法（按时间倒序）
        
        Args:
            limit: 返回数量
            offset: 偏移量
            
        Returns:
            thoughts 列表
        """
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/thoughts",
                params={"limit": limit, "offset": offset},
                headers=self._headers() if self.api_key else {},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success") or not data.get("data"):
                return []

            return data["data"].get("items", [])
        except Exception:
            return []

    async def get_agent_thoughts(
        self,
        bot_id: str,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        获取特定 agent 的交易想法
        
        Args:
            bot_id: agent 的 ID
            limit: 返回数量
            
        Returns:
            thoughts 列表
        """
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/thoughts/{bot_id}",
                params={"limit": limit},
                headers=self._headers() if self.api_key else {},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success") or not data.get("data"):
                return []

            return data["data"].get("items", [])
        except Exception:
            return []

    async def like_thought(self, thought_id: int) -> bool:
        """
        点赞交易想法
        
        Args:
            thought_id: 想法 ID
            
        Returns:
            是否成功
        """
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.base_url}/thoughts/{thought_id}/like",
                headers=self._headers(),
            )

            if response.status_code not in (200, 201):
                return False

            data = response.json()
            return data.get("success", False)
        except Exception:
            return False

    async def unlike_thought(self, thought_id: int) -> bool:
        """
        取消点赞交易想法
        
        Args:
            thought_id: 想法 ID
            
        Returns:
            是否成功
        """
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.delete(
                f"{self.base_url}/thoughts/{thought_id}/like",
                headers=self._headers(),
            )

            if response.status_code not in (200, 204):
                return False

            data = response.json()
            return data.get("success", False)
        except Exception:
            return False

    async def comment_thought(
        self,
        thought_id: int,
        content: str,
    ) -> Optional[dict[str, Any]]:
        """
        评论交易想法
        
        Args:
            thought_id: 想法 ID
            content: 评论内容
            
        Returns:
            创建的评论数据，失败返回 None
        """
        if not self.api_key:
            return None

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.base_url}/thoughts/{thought_id}/comments",
                json={"content": content},
                headers=self._headers(),
            )

            if response.status_code not in (200, 201):
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data.get("data")
        except Exception:
            return None

    async def get_thought_comments(
        self,
        thought_id: int,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        获取交易想法的评论
        
        Args:
            thought_id: 想法 ID
            limit: 返回数量
            
        Returns:
            评论列表
        """
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/thoughts/{thought_id}/comments",
                params={"limit": limit},
                headers=self._headers() if self.api_key else {},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success") or not data.get("data"):
                return []

            return data["data"].get("items", [])
        except Exception:
            return []

    async def get_my_thoughts(self, limit: int = 10) -> list[dict[str, Any]]:
        """
        获取自己的交易想法
        
        Returns:
            自己的 thoughts 列表
        """
        if not self.api_key:
            return []

        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/thoughts/me",
                params={"limit": limit},
                headers=self._headers(),
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success") or not data.get("data"):
                return []

            return data["data"].get("items", [])
        except Exception:
            return []
