'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

interface ArenaConfig {
  symbol: string;
}

interface PriceSnapshot {
  timestamp: number;
  price: number;
}

interface ScoringInfo {
  timeProgress: number;
  timeProgressPercent: number;
  estimatedWinScore: number;
  estimatedLoseScore: number;
  earlyBonusRemaining: number;
}

// Scoring formula constants (must match backend & ScoringPanel)
const WIN_BASE = 10;
const LOSE_BASE = -5;
const EARLY_BONUS = 1.0;
const LATE_PENALTY = 0.6;
const DECAY_K = 3.0;
const BETTING_WINDOW_SECONDS = 7 * 60; // 7 minutes

function calculateScoring(remainingSeconds: number): ScoringInfo {
  // Calculate elapsed time in betting window
  const elapsedSeconds = BETTING_WINDOW_SECONDS - remainingSeconds;
  const timeProgress = Math.max(0, Math.min(1, elapsedSeconds / BETTING_WINDOW_SECONDS));
  
  // Exponential decay
  const decay = Math.exp(-DECAY_K * timeProgress);
  
  // Calculate scores
  const estimatedWinScore = Math.round(WIN_BASE * (1 + EARLY_BONUS * decay));
  const estimatedLoseScore = Math.round(LOSE_BASE * (1 + LATE_PENALTY * (1 - decay)));
  
  return {
    timeProgress,
    timeProgressPercent: Math.round(timeProgress * 100),
    estimatedWinScore,
    estimatedLoseScore,
    earlyBonusRemaining: decay,
  };
}

interface RoundData {
  id: number;
  symbol: string;
  displayName: string;
  price: number;
  openPrice: number;
  change: number;
  remainingSeconds: number;
  totalDurationSeconds: number;
  status: string;
  betCount: number;
  priceHistory: PriceSnapshot[];
  scoring: ScoringInfo | null;
  /** Round start time as Unix timestamp in milliseconds */
  startTimeMs: number;
}

interface BetData {
  long: BotBet[];
  short: BotBet[];
}

interface BotBet {
  id: number;
  botId: string;
  name: string;
  avatar: string;
  reason?: string;
  confidence?: number;
  score: number;
  winRate: number;
  streak: number;
}

interface RecentRound {
  id: number;
  symbol: string;
  result: 'up' | 'down';
  change: number;
  closePrice: number;
  longCount: number;
  shortCount: number;
}

// WebSocket message types
interface WsRoundStartData {
  id: number;
  symbol: string;
  display_name: string;
  category: string;
  emoji: string;
  start_time: string;
  end_time: string;
  open_price: number;
  current_price: number;
  price_change_percent: number;
  status: string;
  remaining_seconds: number;
  betting_open: boolean;
  bet_count: number;
  price_history: Array<{ timestamp: number; price: number }>;
  scoring: {
    time_progress: number;
    time_progress_percent: number;
    estimated_win_score: number;
    estimated_lose_score: number;
    early_bonus_remaining: number;
  } | null;
}

interface WsPriceTickData {
  price: number;
  timestamp: number;
  change_percent: number;
  remaining_seconds: number;
}

interface WsRoundEndData {
  id: number;
  result: 'up' | 'down' | 'draw';
  close_price: number;
  price_change_percent: number;
}

type WsMessage =
  | { type: 'round_start'; data: WsRoundStartData }
  | { type: 'price_tick'; data: WsPriceTickData }
  | { type: 'round_end'; data: WsRoundEndData }
  | { type: 'no_round'; message: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

// Build WebSocket URL from API URL
const getWsUrl = (symbol: string): string => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://api.clawbrawl.ai/api/v1';
  // Convert http(s) to ws(s)
  const wsBase = apiBase.replace(/^http/, 'ws');
  return `${wsBase}/ws/arena?symbol=${symbol}`;
};

/**
 * Hook to fetch arena data via WebSocket (price data is WS-only)
 */
export function useArenaData({ symbol }: ArenaConfig) {
  const [round, setRound] = useState<RoundData | null>(null);
  const [bets, setBets] = useState<BetData>({ long: [], short: [] });
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [wsConnected, setWsConnected] = useState(false);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const currentRoundIdRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const symbolRef = useRef(symbol);
  const mountedRef = useRef(true);

  // Update symbol ref when it changes
  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  // Transform WS round_start data to RoundData
  const transformRoundData = useCallback((data: WsRoundStartData): RoundData => {
    // Ensure UTC parsing by adding 'Z' suffix if not present
    const startTimeUtc = data.start_time.endsWith('Z') ? data.start_time : data.start_time + 'Z';
    const endTimeUtc = data.end_time.endsWith('Z') ? data.end_time : data.end_time + 'Z';
    const startMs = Date.parse(startTimeUtc);
    const endMs = Date.parse(endTimeUtc);
    const computedDurationSeconds = Math.round((endMs - startMs) / 1000);
    const totalDurationSeconds =
      Number.isFinite(computedDurationSeconds) && computedDurationSeconds > 0
        ? computedDurationSeconds
        : 600;

    const scoring: ScoringInfo | null = data.scoring ? {
      timeProgress: data.scoring.time_progress,
      timeProgressPercent: data.scoring.time_progress_percent,
      estimatedWinScore: data.scoring.estimated_win_score,
      estimatedLoseScore: data.scoring.estimated_lose_score,
      earlyBonusRemaining: data.scoring.early_bonus_remaining,
    } : null;

    return {
      id: data.id,
      symbol: data.symbol,
      displayName: data.display_name,
      price: data.current_price,
      openPrice: data.open_price,
      change: data.price_change_percent,
      remainingSeconds: data.remaining_seconds,
      totalDurationSeconds,
      status: data.status,
      betCount: data.bet_count,
      priceHistory: data.price_history || [],
      scoring,
      startTimeMs: startMs,
    };
  }, []);

  // Fetch bets
  const fetchBets = useCallback(async () => {
    try {
      const response = await api.getCurrentRoundBets(symbolRef.current);
      
      if (response.success && response.data) {
        const data = response.data;
        
        const transformBet = (bet: { id: number; bot_id: string; bot_name: string; avatar_url?: string; reason?: string; confidence?: number; score?: number; win_rate?: number; streak?: number }): BotBet => ({
          id: bet.id,
          botId: bet.bot_id,
          name: bet.bot_name,
          avatar: bet.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${bet.bot_id}`,
          reason: bet.reason,
          confidence: bet.confidence,
          score: bet.score ?? 0,
          winRate: Math.round((bet.win_rate ?? 0) * 100),
          streak: bet.streak ?? 0,
        });

        setBets({
          long: data.long_bets.map(transformBet),
          short: data.short_bets.map(transformBet),
        });
      }
    } catch {
      // Ignore bet fetch errors
    }
  }, []);

  // WebSocket message handler
  const handleWsMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'round_start': {
        const roundData = transformRoundData(msg.data);
        
        // Reset bets on round change
        const isNewRound = currentRoundIdRef.current !== roundData.id;
        if (isNewRound) {
          currentRoundIdRef.current = roundData.id;
          setBets({ long: [], short: [] });
        }
        
        setRound(roundData);
        setError(null);
        
        // Always fetch bets immediately when receiving round_start
        // This ensures bets load alongside K-line data on page refresh
        fetchBets();
        break;
      }
      
      case 'price_tick': {
        const { price, timestamp, change_percent, remaining_seconds } = msg.data;
        
        // Append new price point to existing history
        // Don't truncate - backend controls data volume, we need full round history
        setRound(prev => {
          if (!prev) return null;
          
          // Recalculate scoring based on remaining time
          const scoring = remaining_seconds > 0 ? calculateScoring(remaining_seconds) : null;
          
          return {
            ...prev,
            price,
            change: change_percent,
            remainingSeconds: remaining_seconds,
            priceHistory: [...prev.priceHistory, { timestamp, price }],
            scoring,
          };
        });
        break;
      }
      
      case 'round_end': {
        setRound(prev => {
          if (!prev) return null;
          return {
            ...prev,
            status: 'settled',
          };
        });
        // Refresh history after round ends
        fetchHistory();
        break;
      }
      
      case 'no_round': {
        setRound(null);
        setError(msg.message);
        break;
      }
      
      case 'error': {
        console.warn('[WS] Server error:', msg.message);
        break;
      }
      
      case 'pong': {
        // Heartbeat response, ignore
        break;
      }
    }
  }, [transformRoundData, fetchBets]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = getWsUrl(symbolRef.current);
    console.log('[WS] Connecting to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setWsConnected(true);
        setBackendStatus('online');
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          handleWsMessage(msg);
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.warn('[WS] Error:', event);
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setWsConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect with exponential backoff
        if (mountedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connectWebSocket();
            }
          }, delay);
        }
      };
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      setWsConnected(false);
    }
  }, [handleWsMessage]);

  // Switch symbol via WebSocket
  const switchSymbol = useCallback((newSymbol: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'switch', symbol: newSymbol }));
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.getRoundHistory(symbolRef.current, 1, 10);
      
      if (response.success && response.data && response.data.items.length > 0) {
        const transformed = response.data.items.map((r) => ({
          id: r.id,
          symbol: r.symbol,
          result: (r.result === 'up' ? 'up' : 'down') as 'up' | 'down',
          change: r.price_change_percent || 0,
          closePrice: r.close_price || 0,
          longCount: Math.floor(r.bet_count * 0.5),
          shortCount: Math.ceil(r.bet_count * 0.5),
        }));
        setRecentRounds(transformed);
      }
    } catch {
      // Ignore history errors
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    
    // Connect WebSocket for price data
    connectWebSocket();
    
    // Fetch bets and history via HTTP (non-price data)
    Promise.all([fetchBets(), fetchHistory()]).finally(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      
      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only run on mount

  // Handle symbol change - switch via WebSocket or reconnect
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      switchSymbol(symbol);
    } else {
      // Reconnect with new symbol
      if (wsRef.current) {
        wsRef.current.close();
      }
      connectWebSocket();
    }
    
    // Also refresh bets and history
    fetchBets();
    fetchHistory();
  }, [symbol, switchSymbol, connectWebSocket, fetchBets, fetchHistory]);

  // Periodic bets refresh (every 5 seconds)
  useEffect(() => {
    if (loading || backendStatus !== 'online') return;

    const interval = setInterval(fetchBets, 5000);
    return () => clearInterval(interval);
  }, [loading, backendStatus, fetchBets]);

  // Periodic history refresh (every 30 seconds)
  useEffect(() => {
    if (loading || backendStatus !== 'online') return;

    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [loading, backendStatus, fetchHistory]);

  // WebSocket heartbeat (every 30 seconds)
  useEffect(() => {
    if (!wsConnected) return;
    
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [wsConnected]);

  return {
    round,
    bets,
    recentRounds,
    loading,
    error,
    backendStatus,
    wsConnected,
  };
}
