"""
In-memory cache for round price history.
Stores price snapshots for active rounds without modifying the database.
"""
from typing import Dict, List
from dataclasses import dataclass, field
import time
import threading


@dataclass
class PriceSnapshot:
    timestamp: int  # Unix timestamp in milliseconds
    price: float


@dataclass
class RoundPriceCache:
    round_id: int
    snapshots: List[PriceSnapshot] = field(default_factory=list)
    last_snapshot_time: int = 0


class PriceCacheService:
    """Service for caching price history in memory"""
    
    # Minimum interval between price snapshots (in milliseconds)
    SNAPSHOT_INTERVAL_MS = 5000  # 5 seconds
    
    def __init__(self):
        # Key: symbol, Value: RoundPriceCache
        self._cache: Dict[str, RoundPriceCache] = {}
        self._lock = threading.Lock()
    
    def record_price(self, symbol: str, round_id: int, price: float) -> List[dict]:
        """
        Record a price snapshot for the current round.
        Returns the current price history for this round.
        """
        now_ms = int(time.time() * 1000)
        
        with self._lock:
            # Check if we need to create or reset cache for this symbol
            cache = self._cache.get(symbol)
            
            if cache is None or cache.round_id != round_id:
                # New round started, create fresh cache
                cache = RoundPriceCache(round_id=round_id)
                self._cache[symbol] = cache
            
            # Check if enough time has passed since last snapshot
            if now_ms - cache.last_snapshot_time >= self.SNAPSHOT_INTERVAL_MS:
                cache.snapshots.append(PriceSnapshot(timestamp=now_ms, price=price))
                cache.last_snapshot_time = now_ms
            
            # Return current history as list of dicts
            return [{"timestamp": s.timestamp, "price": s.price} for s in cache.snapshots]
    
    def get_price_history(self, symbol: str, round_id: int) -> List[dict]:
        """Get price history for a specific round"""
        with self._lock:
            cache = self._cache.get(symbol)
            if cache is None or cache.round_id != round_id:
                return []
            return [{"timestamp": s.timestamp, "price": s.price} for s in cache.snapshots]
    
    def clear_round(self, symbol: str, round_id: int) -> None:
        """Clear cache for a specific round (called when round ends)"""
        with self._lock:
            cache = self._cache.get(symbol)
            if cache is not None and cache.round_id == round_id:
                del self._cache[symbol]


# Singleton instance
price_cache = PriceCacheService()
