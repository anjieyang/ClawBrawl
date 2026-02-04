'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

interface ArenaConfig {
  symbol: string;
  refreshInterval?: number;
}

interface PriceSnapshot {
  timestamp: number;
  price: number;
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
  reason?: string;  // Agent's reasoning for the bet
  confidence?: number;  // Agent's confidence score (0-100)
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

/**
 * Hook to fetch arena data from the backend API
 */
export function useArenaData({ symbol, refreshInterval = 1000 }: ArenaConfig) {
  const [round, setRound] = useState<RoundData | null>(null);
  const [bets, setBets] = useState<BetData>({ long: [], short: [] });
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // Local price history accumulator - stores prices collected by this client
  const localPriceHistoryRef = useRef<PriceSnapshot[]>([]);
  const currentRoundIdRef = useRef<number | null>(null);
  const lastPriceTimestampRef = useRef<number>(0);
  const PRICE_SAMPLE_INTERVAL = 1000; // Record price every 1 second locally

  // Check backend availability
  const checkBackend = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://api.clawbrawl.ai/api/v1'}/symbols`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        setBackendStatus('online');
        return true;
      }
    } catch {
      // Backend not available
    }
    
    setBackendStatus('offline');
    setError('Backend server is offline');
    return false;
  }, []);

  // Fetch round data from API
  const fetchFromAPI = useCallback(async () => {
    try {
      const response = await api.getCurrentRound(symbol);
      
      if (response.success && response.data) {
        const data = response.data;
        const startMs = Date.parse(data.start_time);
        const endMs = Date.parse(data.end_time);
        const computedDurationSeconds = Math.round((endMs - startMs) / 1000);
        const totalDurationSeconds =
          Number.isFinite(computedDurationSeconds) && computedDurationSeconds > 0
            ? computedDurationSeconds
            : 600;

        if (totalDurationSeconds === 600 && (!Number.isFinite(computedDurationSeconds) || computedDurationSeconds <= 0)) {
          console.warn('[Arena] Invalid round duration; falling back to 600s', {
            symbol: data.symbol,
            roundId: data.id,
            start_time: data.start_time,
            end_time: data.end_time,
            computedDurationSeconds,
          });
        }

        // Reset local history (and bets) if round changed
        if (currentRoundIdRef.current !== data.id) {
          localPriceHistoryRef.current = [];
          lastPriceTimestampRef.current = 0;
          // Clear bets immediately on round switch to avoid mixing old bets with new round
          setBets({ long: [], short: [] });
          currentRoundIdRef.current = data.id;
        }

        // Add current price to local history (with sampling)
        const nowMs = Date.now();
        if (nowMs - lastPriceTimestampRef.current >= PRICE_SAMPLE_INTERVAL) {
          localPriceHistoryRef.current.push({
            timestamp: nowMs,
            price: data.current_price,
          });
          lastPriceTimestampRef.current = nowMs;
        }

        // Merge backend history with local history (deduplicated by timestamp proximity)
        const backendHistory = data.price_history || [];
        const localHistory = localPriceHistoryRef.current;
        
        // Combine and sort by timestamp
        const allSnapshots = [...backendHistory, ...localHistory];
        allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
        
        // Deduplicate: keep snapshots that are at least 500ms apart
        const mergedHistory: PriceSnapshot[] = [];
        for (const snapshot of allSnapshots) {
          const lastSnapshot = mergedHistory[mergedHistory.length - 1];
          if (!lastSnapshot || snapshot.timestamp - lastSnapshot.timestamp >= 500) {
            mergedHistory.push(snapshot);
          }
        }

        setRound({
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
          priceHistory: mergedHistory,
        });
        setError(null);
        return true;
      } else {
        setError(response.error || 'Failed to fetch round data');
      }
    } catch (err) {
      setError('Network error');
    }
    return false;
  }, [symbol]);

  // Fetch current round bets
  const fetchBets = useCallback(async () => {
    try {
      const response = await api.getCurrentRoundBets(symbol);
      
      if (response.success && response.data) {
        const data = response.data;
        
        // Transform to BotBet format using real data from backend
        const transformBet = (bet: any, index: number): BotBet => ({
          id: bet.id,
          botId: bet.bot_id,
          name: bet.bot_name,
          avatar: bet.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${bet.bot_id}`,
          reason: bet.reason,
          confidence: bet.confidence,
          score: bet.score ?? 0,
          winRate: Math.round((bet.win_rate ?? 0) * 100), // Convert from 0.xx to percentage
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
  }, [symbol]);

  // Fetch round history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.getRoundHistory(symbol, 1, 10);
      
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
  }, [symbol]);

  // Initial check and data fetch
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      
      const isOnline = await checkBackend();
      
      if (mounted && isOnline) {
        await Promise.all([fetchFromAPI(), fetchBets(), fetchHistory()]);
      }
      
      if (mounted) {
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [checkBackend, fetchFromAPI, fetchBets, fetchHistory]);

  // Track if we're waiting for a new round
  const [waitingForNewRound, setWaitingForNewRound] = useState(false);
  const lastRoundIdRef = useRef<number | null>(null);

  // Detect when round ends and when new round starts
  useEffect(() => {
    if (!round) return;
    
    // Check if this is a new round
    if (lastRoundIdRef.current !== null && round.id !== lastRoundIdRef.current) {
      setWaitingForNewRound(false);
      // Refresh history and bets when new round starts
      fetchHistory();
      fetchBets();
    }
    lastRoundIdRef.current = round.id;
    
    // Check if round is ending
    if (round.remainingSeconds <= 0) {
      setWaitingForNewRound(true);
    }
  }, [round, fetchHistory, fetchBets]);

  // Periodic data refresh - faster when waiting for new round
  useEffect(() => {
    if (loading || backendStatus !== 'online') return;

    const actualInterval = waitingForNewRound ? 500 : refreshInterval; // Poll every 500ms when waiting
    
    const interval = setInterval(async () => {
      await fetchFromAPI();
    }, actualInterval);

    return () => clearInterval(interval);
  }, [loading, backendStatus, refreshInterval, fetchFromAPI, waitingForNewRound]);

  // Periodic bets refresh (every 5 seconds)
  useEffect(() => {
    if (loading || backendStatus !== 'online') return;

    const interval = setInterval(async () => {
      await fetchBets();
    }, 5000);

    return () => clearInterval(interval);
  }, [loading, backendStatus, fetchBets]);

  // Periodic history refresh (less frequent)
  useEffect(() => {
    if (loading || backendStatus !== 'online') return;

    const interval = setInterval(async () => {
      await fetchHistory();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [loading, backendStatus, fetchHistory]);

  return {
    round,
    bets,
    recentRounds,
    loading,
    error,
    backendStatus,
  };
}
