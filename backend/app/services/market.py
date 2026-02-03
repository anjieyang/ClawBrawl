import httpx
from decimal import Decimal
from typing import Optional
from app.core.config import settings


class MarketService:
    """Service for fetching market data from external APIs"""

    def __init__(self):
        self.base_url = settings.BITGET_API_BASE

    async def get_mark_price(self, symbol: str, product_type: str = "USDT-FUTURES") -> float:
        """Get mark price for a symbol"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/symbol-price",
                params={"symbol": symbol, "productType": product_type},
                timeout=10.0
            )
            data = response.json()

            if data.get("code") != "00000":
                raise Exception(
                    f"Bitget API error: {data.get('msg', 'Unknown error')}")

            if not data.get("data"):
                raise Exception(f"No data returned for {symbol}")

            return float(data["data"][0]["markPrice"])

    async def get_ticker(self, symbol: str, product_type: str = "USDT-FUTURES") -> dict:
        """Get full ticker data for a symbol"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/ticker",
                params={"symbol": symbol, "productType": product_type},
                timeout=10.0
            )
            data = response.json()

            if data.get("code") != "00000":
                raise Exception(
                    f"Bitget API error: {data.get('msg', 'Unknown error')}")

            if not data.get("data"):
                raise Exception(f"No data returned for {symbol}")

            ticker = data["data"][0]
            return {
                "symbol": symbol,
                "last_price": float(ticker["lastPr"]),
                "mark_price": float(ticker["markPrice"]),
                "index_price": float(ticker.get("indexPrice", ticker["markPrice"])),
                "high_24h": float(ticker["high24h"]),
                "low_24h": float(ticker["low24h"]),
                "change_24h": float(ticker["change24h"]),
                "timestamp": int(ticker["ts"])
            }

    async def get_price_by_source(
        self,
        symbol: str,
        api_source: str,
        product_type: str
    ) -> float:
        """Get price based on API source type"""
        if api_source == "futures":
            return await self.get_mark_price(symbol, product_type)
        elif api_source == "tradfi":
            # TODO: Implement TradFi API
            raise NotImplementedError("TradFi API not implemented yet")
        elif api_source == "uex":
            # TODO: Implement UEX API
            raise NotImplementedError("UEX API not implemented yet")
        else:
            raise ValueError(f"Unknown API source: {api_source}")

    async def get_candles(
        self,
        symbol: str,
        product_type: str = "USDT-FUTURES",
        granularity: str = "1m",
        start_time: int | None = None,
        end_time: int | None = None,
        limit: int = 100
    ) -> list[dict]:
        """
        Get historical candlestick data from Bitget.
        
        Returns list of dicts with: timestamp, open, high, low, close, volume
        """
        async with httpx.AsyncClient() as client:
            params = {
                "symbol": symbol,
                "productType": product_type.lower().replace("_", "-"),
                "granularity": granularity,
                "limit": str(limit)
            }
            if start_time:
                params["startTime"] = str(start_time)
            if end_time:
                params["endTime"] = str(end_time)
            
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/candles",
                params=params,
                timeout=10.0
            )
            data = response.json()

            if data.get("code") != "00000":
                raise Exception(
                    f"Bitget API error: {data.get('msg', 'Unknown error')}")

            candles = []
            for item in data.get("data", []):
                candles.append({
                    "timestamp": int(item[0]),
                    "open": float(item[1]),
                    "high": float(item[2]),
                    "low": float(item[3]),
                    "close": float(item[4]),
                    "volume": float(item[5])
                })
            
            # Sort by timestamp ascending
            candles.sort(key=lambda x: x["timestamp"])
            return candles


# Singleton instance
market_service = MarketService()
