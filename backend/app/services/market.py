import httpx
from decimal import Decimal
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


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

    async def get_historical_fills(
        self,
        symbol: str,
        product_type: str = "USDT-FUTURES",
        start_time: int | None = None,
        end_time: int | None = None,
        limit: int = 1000
    ) -> list[dict]:
        """
        Get historical transaction/fill data from Bitget (tick-level).
        
        Endpoint: GET /api/v2/mix/market/fills-history
        Rate limit: 10 requests/second
        
        Args:
            symbol: Trading pair (e.g., "BTCUSDT")
            product_type: Product type (default "USDT-FUTURES")
            start_time: Start timestamp in milliseconds
            end_time: End timestamp in milliseconds
            limit: Max records (default 1000)
        
        Returns:
            List of trade records with tradeId, price, size, side, ts, symbol
        """
        async with httpx.AsyncClient() as client:
            params = {
                "symbol": symbol,
                "productType": product_type.lower().replace("_", "-"),
                "limit": str(limit)
            }
            if start_time:
                params["startTime"] = str(start_time)
            if end_time:
                params["endTime"] = str(end_time)
            
            response = await client.get(
                f"{self.base_url}/api/v2/mix/market/fills-history",
                params=params,
                timeout=15.0
            )
            data = response.json()

            if data.get("code") != "00000":
                raise Exception(
                    f"Bitget API error: {data.get('msg', 'Unknown error')}")

            trades = []
            for item in data.get("data", []):
                trades.append({
                    "tradeId": item.get("tradeId"),
                    "price": float(item.get("price", 0)),
                    "size": float(item.get("size", 0)),
                    "side": item.get("side"),
                    "timestamp": int(item.get("ts", 0)),
                    "symbol": item.get("symbol")
                })
            
            # Sort by timestamp ascending
            trades.sort(key=lambda x: x["timestamp"])
            return trades

    async def get_historical_prices_aggregated(
        self,
        symbol: str,
        product_type: str = "USDT-FUTURES",
        start_time: int | None = None,
        end_time: int | None = None,
        interval_ms: int = 1000
    ) -> list[dict]:
        """
        Get historical price data from Bitget fills-history API,
        aggregated into fixed time intervals.
        
        This provides second-level granularity for chart display.
        
        Args:
            symbol: Trading pair (e.g., "BTCUSDT")
            product_type: Product type (default "USDT-FUTURES")
            start_time: Start timestamp in milliseconds
            end_time: End timestamp in milliseconds
            interval_ms: Aggregation interval in milliseconds (default 1000 = 1 second)
        
        Returns:
            List of {timestamp, price} dicts, one per interval
        """
        try:
            # Fetch tick-level data
            trades = await self.get_historical_fills(
                symbol=symbol,
                product_type=product_type,
                start_time=start_time,
                end_time=end_time,
                limit=1000
            )
            
            if not trades:
                return []
            
            # Aggregate trades into fixed intervals
            price_map: dict[int, list[float]] = {}
            
            for trade in trades:
                ts = trade["timestamp"]
                price = trade["price"]
                
                # Round timestamp to interval
                interval_ts = (ts // interval_ms) * interval_ms
                
                if interval_ts not in price_map:
                    price_map[interval_ts] = []
                price_map[interval_ts].append(price)
            
            # Convert to list with last price per interval
            result = []
            for ts in sorted(price_map.keys()):
                prices = price_map[ts]
                # Use last price in interval (most recent)
                result.append({
                    "timestamp": ts,
                    "price": prices[-1]
                })
            
            logger.info(f"Fetched {len(result)} price points from Bitget fills for {symbol}")
            return result
            
        except Exception as e:
            logger.warning(f"Failed to fetch Bitget fills for {symbol}: {e}")
            return []


# Singleton instance
market_service = MarketService()
