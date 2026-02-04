"""
WebSocket Connection Hub - Manages WebSocket connections with symbol-based subscriptions.

Design:
- Clients subscribe by symbol (e.g., "BTCUSDT")
- Server broadcasts events organized by round lifecycle (round_start, price_tick, round_end)
- Supports switching symbols without reconnecting
- Auto-cleans dead connections
"""

from fastapi import WebSocket
from typing import Dict, Set, Any
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionHub:
    """
    Manages WebSocket connections with symbol-based pub/sub.
    
    Thread-safe via asyncio.Lock for subscription operations.
    """
    
    def __init__(self) -> None:
        # symbol -> set of WebSocket connections
        self._subscriptions: Dict[str, Set[WebSocket]] = {}
        # ws -> symbol (for fast lookup on disconnect)
        self._ws_to_symbol: Dict[WebSocket, str] = {}
        self._lock = asyncio.Lock()
        self._stats = {"total_connections": 0, "total_broadcasts": 0}
    
    async def subscribe(self, ws: WebSocket, symbol: str) -> None:
        """
        Subscribe a WebSocket connection to a symbol.
        
        Args:
            ws: WebSocket connection
            symbol: Symbol to subscribe to (e.g., "BTCUSDT")
        """
        async with self._lock:
            # Remove from old subscription if exists
            old_symbol = self._ws_to_symbol.get(ws)
            if old_symbol and old_symbol != symbol:
                self._subscriptions.get(old_symbol, set()).discard(ws)
                logger.debug(f"WS switched from {old_symbol} to {symbol}")
            
            # Add to new subscription
            if symbol not in self._subscriptions:
                self._subscriptions[symbol] = set()
            self._subscriptions[symbol].add(ws)
            self._ws_to_symbol[ws] = symbol
            
            if old_symbol != symbol:
                self._stats["total_connections"] += 1
                logger.info(f"WS subscribed to {symbol} (total: {len(self._subscriptions[symbol])})")
    
    async def unsubscribe(self, ws: WebSocket) -> None:
        """
        Remove a WebSocket from all subscriptions.
        
        Args:
            ws: WebSocket connection to remove
        """
        async with self._lock:
            symbol = self._ws_to_symbol.pop(ws, None)
            if symbol and symbol in self._subscriptions:
                self._subscriptions[symbol].discard(ws)
                logger.debug(f"WS unsubscribed from {symbol} (remaining: {len(self._subscriptions[symbol])})")
    
    async def broadcast(self, symbol: str, message: Dict[str, Any]) -> int:
        """
        Broadcast a message to all connections subscribed to a symbol.
        
        Args:
            symbol: Target symbol
            message: JSON-serializable message dict
        
        Returns:
            Number of connections that received the message
        """
        # Get snapshot of connections (avoid holding lock during I/O)
        async with self._lock:
            connections = list(self._subscriptions.get(symbol, set()))
        
        if not connections:
            return 0
        
        self._stats["total_broadcasts"] += 1
        
        # Send to all connections, collect dead ones
        dead_connections: list[WebSocket] = []
        sent_count = 0
        
        # Use gather for concurrent sending
        async def send_to_ws(ws: WebSocket) -> bool:
            try:
                await ws.send_json(message)
                return True
            except Exception:
                return False
        
        results = await asyncio.gather(
            *[send_to_ws(ws) for ws in connections],
            return_exceptions=True
        )
        
        for ws, success in zip(connections, results):
            if success is True:
                sent_count += 1
            else:
                dead_connections.append(ws)
        
        # Clean up dead connections
        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    self._subscriptions.get(symbol, set()).discard(ws)
                    self._ws_to_symbol.pop(ws, None)
            logger.debug(f"Cleaned {len(dead_connections)} dead connections for {symbol}")
        
        return sent_count
    
    async def broadcast_all(self, message: Dict[str, Any]) -> int:
        """
        Broadcast a message to ALL connected clients regardless of symbol.
        
        Args:
            message: JSON-serializable message dict
        
        Returns:
            Total number of connections that received the message
        """
        async with self._lock:
            all_symbols = list(self._subscriptions.keys())
        
        total_sent = 0
        for symbol in all_symbols:
            total_sent += await self.broadcast(symbol, message)
        
        return total_sent
    
    def get_subscriber_count(self, symbol: str) -> int:
        """Get number of subscribers for a symbol (sync, approximate)."""
        return len(self._subscriptions.get(symbol, set()))
    
    def get_all_subscriber_counts(self) -> Dict[str, int]:
        """Get subscriber counts for all symbols."""
        return {
            symbol: len(subs) 
            for symbol, subs in self._subscriptions.items()
            if subs  # Only include non-empty
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get hub statistics."""
        return {
            **self._stats,
            "active_symbols": len([s for s, c in self._subscriptions.items() if c]),
            "subscribers_by_symbol": self.get_all_subscriber_counts()
        }


# Global singleton instance
ws_hub = ConnectionHub()
