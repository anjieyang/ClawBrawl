"""
Market Data Client (Bitget Public API)
获取实时市场数据供 bot 分析
"""

import httpx
from typing import Optional
from dataclasses import dataclass

from .config import config


@dataclass
class TickerData:
    """Ticker data from Bitget"""

    symbol: str
    last_price: float
    mark_price: float
    high_24h: float
    low_24h: float
    change_24h: float  # Percentage as decimal (0.01 = 1%)
    funding_rate: float
    volume_24h: float


@dataclass
class OrderBookSummary:
    """Simplified order book data"""

    bid_volume: float  # Total bid volume
    ask_volume: float  # Total ask volume
    bid_ask_ratio: float  # bid/ask, >1 means more buyers


class MarketClient:
    """Bitget public API client"""

    def __init__(self):
        self.base_url = config.BITGET_API_BASE
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_ticker(self, symbol: str = "BTCUSDT") -> Optional[TickerData]:
        """Get full ticker data"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/ticker",
                params={"symbol": symbol, "productType": "USDT-FUTURES"},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("code") != "00000" or not data.get("data"):
                return None

            t = data["data"][0]
            return TickerData(
                symbol=symbol,
                last_price=float(t.get("lastPr", 0)),
                mark_price=float(t.get("markPrice", 0)),
                high_24h=float(t.get("high24h", 0)),
                low_24h=float(t.get("low24h", 0)),
                change_24h=float(t.get("change24h", 0)),
                funding_rate=float(t.get("fundingRate", 0)),
                volume_24h=float(t.get("baseVolume", 0)),
            )
        except Exception:
            return None

    async def get_funding_rate(self, symbol: str = "BTCUSDT") -> Optional[float]:
        """Get current funding rate"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/current-fund-rate",
                params={"symbol": symbol, "productType": "USDT-FUTURES"},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("code") != "00000" or not data.get("data"):
                return None

            return float(data["data"][0].get("fundingRate", 0))
        except Exception:
            return None

    async def get_orderbook_summary(
        self, symbol: str = "BTCUSDT", depth: int = 5
    ) -> Optional[OrderBookSummary]:
        """Get order book summary (bid/ask volume ratio)"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/merge-depth",
                params={
                    "symbol": symbol,
                    "productType": "USDT-FUTURES",
                    "limit": depth,
                },
            )
            response.raise_for_status()
            data = response.json()

            if data.get("code") != "00000" or not data.get("data"):
                return None

            book = data["data"]
            bids = book.get("bids", [])
            asks = book.get("asks", [])

            bid_volume = sum(float(b[1]) for b in bids)
            ask_volume = sum(float(a[1]) for a in asks)

            return OrderBookSummary(
                bid_volume=bid_volume,
                ask_volume=ask_volume,
                bid_ask_ratio=bid_volume / ask_volume if ask_volume > 0 else 1.0,
            )
        except Exception:
            return None


@dataclass
class MarketContext:
    """Full market context for decision making"""

    ticker: Optional[TickerData]
    funding_rate: Optional[float]
    orderbook: Optional[OrderBookSummary]

    def to_prompt_text(self) -> str:
        """Convert to text for GPT prompt"""
        lines = ["## Current Market Data"]

        if self.ticker:
            lines.append(f"- Price: ${self.ticker.last_price:,.2f}")
            lines.append(f"- 24h Change: {self.ticker.change_24h * 100:+.2f}%")
            lines.append(f"- 24h High: ${self.ticker.high_24h:,.2f}")
            lines.append(f"- 24h Low: ${self.ticker.low_24h:,.2f}")
            lines.append(f"- Funding Rate: {self.ticker.funding_rate:.4f}")
        else:
            lines.append("- Price data unavailable")

        if self.funding_rate is not None:
            lines.append(f"- Current Funding: {self.funding_rate:.6f}")

        if self.orderbook:
            lines.append(f"- Order Book: Bids {self.orderbook.bid_volume:.2f} / Asks {self.orderbook.ask_volume:.2f}")
            lines.append(f"- Bid/Ask Ratio: {self.orderbook.bid_ask_ratio:.2f}")

        return "\n".join(lines)


async def get_market_context(symbol: str = "BTCUSDT") -> MarketContext:
    """Get full market context"""
    client = MarketClient()
    try:
        ticker = await client.get_ticker(symbol)
        funding = await client.get_funding_rate(symbol)
        orderbook = await client.get_orderbook_summary(symbol)

        return MarketContext(
            ticker=ticker,
            funding_rate=funding,
            orderbook=orderbook,
        )
    finally:
        await client.close()
