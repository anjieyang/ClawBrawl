"""
WebSocket API endpoints for real-time arena data streaming.

Protocol:
- Connect: GET /ws/arena?symbol=BTCUSDT
- Server sends: round_start, price_tick, round_end, bets_update
- Client sends: {"action": "switch", "symbol": "..."} or {"action": "ping"}
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import logging
import json

from app.db.database import AsyncSessionLocal
from app.models import Symbol, Round
from app.services.ws_hub import ws_hub
from app.services.market import market_service
from app.services.price_history import price_history_service
from app.services.scoring import scoring_service
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_current_round_data(symbol: str) -> dict | None:
    """
    Fetch current round data for WebSocket initial push.
    
    Returns full round data or None if no active round.
    """
    async with AsyncSessionLocal() as db:
        # Get symbol config
        sym_result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
        sym = sym_result.scalar_one_or_none()
        
        if not sym or not sym.enabled:
            return None
        
        # Get active round
        result = await db.execute(
            select(Round)
            .where(Round.symbol == symbol, Round.status == "active")
            .order_by(Round.start_time.desc())
            .limit(1)
        )
        current_round = result.scalar_one_or_none()
        
        if not current_round:
            return None
        
        # Get current price
        try:
            current_price = await market_service.get_price_by_source(
                sym.symbol, sym.api_source, sym.product_type
            )
        except Exception:
            current_price = current_round.open_price
        
        # Calculate timing
        now = datetime.utcnow()
        remaining = max(0, int((current_round.end_time - now).total_seconds()))
        price_change = ((current_price - current_round.open_price) / 
                        current_round.open_price) * 100 if current_round.open_price else 0
        
        # Get price history
        price_history = []
        try:
            history_data = await price_history_service.ensure_round_history(
                db=db,
                round=current_round,
                symbol_product_type=sym.product_type,
                min_coverage=0.5
            )
            price_history = [
                {"timestamp": p["timestamp"], "price": float(p["price"])}
                for p in history_data
            ]
        except Exception as e:
            logger.warning(f"Failed to get price history: {e}")
        
        # Betting window
        betting_open = remaining >= settings.BETTING_CUTOFF_REMAINING
        
        # Scoring info
        scoring = None
        if betting_open:
            betting_window = settings.BETTING_WINDOW
            time_progress = scoring_service.calculate_time_progress(
                now, current_round.start_time, betting_window
            )
            decay = scoring_service.calculate_decay(time_progress)
            win_score, lose_score = scoring_service.estimate_scores(time_progress, win_streak=0)
            
            scoring = {
                "time_progress": round(time_progress, 3),
                "time_progress_percent": int(time_progress * 100),
                "estimated_win_score": win_score,
                "estimated_lose_score": lose_score,
                "early_bonus_remaining": round(decay, 3)
            }
        
        return {
            "id": current_round.id,
            "symbol": current_round.symbol,
            "display_name": sym.display_name,
            "category": sym.category,
            "emoji": sym.emoji,
            "start_time": current_round.start_time.isoformat() + "Z",
            "end_time": current_round.end_time.isoformat() + "Z",
            "open_price": float(current_round.open_price),
            "current_price": float(current_price),
            "price_change_percent": round(price_change, 4),
            "status": current_round.status,
            "remaining_seconds": remaining,
            "betting_open": betting_open,
            "bet_count": current_round.bet_count,
            "price_history": price_history,
            "scoring": scoring
        }


@router.websocket("/arena")
async def arena_websocket(
    websocket: WebSocket,
    symbol: str = Query(default="BTCUSDT")
):
    """
    WebSocket endpoint for real-time arena updates.
    
    Connect: ws://host/api/v1/ws/arena?symbol=BTCUSDT
    
    Server messages:
    - {"type": "round_start", "data": {...}}  - New round started
    - {"type": "price_tick", "data": {...}}   - Price update (every second)
    - {"type": "round_end", "data": {...}}    - Round ended with result
    - {"type": "bets_update", "data": {...}}  - Bets changed (optional)
    - {"type": "pong"}                        - Response to ping
    - {"type": "error", "message": "..."}     - Error message
    
    Client messages:
    - {"action": "switch", "symbol": "ETHUSDT"}  - Switch subscription
    - {"action": "ping"}                          - Keep-alive ping
    """
    await websocket.accept()
    logger.info(f"WS connection accepted for {symbol}")
    
    try:
        # Subscribe to initial symbol
        await ws_hub.subscribe(websocket, symbol)
        
        # Send current round data
        round_data = await get_current_round_data(symbol)
        if round_data:
            await websocket.send_json({
                "type": "round_start",
                "data": round_data
            })
        else:
            await websocket.send_json({
                "type": "no_round",
                "message": f"No active round for {symbol}. Waiting for next round..."
            })
        
        # Listen for client messages
        while True:
            try:
                # Receive with timeout for keepalive detection
                raw_data = await websocket.receive_text()
                
                try:
                    data = json.loads(raw_data)
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid JSON"
                    })
                    continue
                
                action = data.get("action")
                
                if action == "switch":
                    new_symbol = data.get("symbol")
                    if new_symbol and new_symbol != symbol:
                        # Switch subscription
                        await ws_hub.subscribe(websocket, new_symbol)
                        symbol = new_symbol
                        logger.info(f"WS switched to {symbol}")
                        
                        # Send new round data
                        round_data = await get_current_round_data(symbol)
                        if round_data:
                            await websocket.send_json({
                                "type": "round_start",
                                "data": round_data
                            })
                        else:
                            await websocket.send_json({
                                "type": "no_round",
                                "message": f"No active round for {symbol}"
                            })
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid or same symbol"
                        })
                
                elif action == "ping":
                    await websocket.send_json({"type": "pong"})
                
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Unknown action: {action}"
                    })
                    
            except WebSocketDisconnect:
                raise
            except Exception as e:
                logger.warning(f"WS receive error: {e}")
                # Continue listening, don't break on parse errors
                
    except WebSocketDisconnect:
        logger.info(f"WS disconnected from {symbol}")
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        await ws_hub.unsubscribe(websocket)


@router.get("/stats")
async def get_ws_stats():
    """Get WebSocket connection statistics."""
    return {
        "success": True,
        "data": ws_hub.get_stats()
    }
