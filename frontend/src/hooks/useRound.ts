'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { CurrentRound, LeaderboardResponse, Round } from '@/lib/api';

interface UseRoundOptions {
  symbol: string;
  refreshInterval?: number; // ms
}

interface RoundData {
  id: number;
  symbol: string;
  displayName: string;
  price: number;
  openPrice: number;
  change: number;
  remainingSeconds: number;
  status: string;
}

interface BetData {
  long: BotBet[];
  short: BotBet[];
}

interface BotBet {
  id: number;
  name: string;
  avatar: string;
  score: number;
  winRate: number;
  streak: number;
}

export function useCurrentRound({ symbol, refreshInterval = 1000 }: UseRoundOptions) {
  const [round, setRound] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRound = useCallback(async () => {
    try {
      const response = await api.getCurrentRound(symbol);
      
      if (response.success && response.data) {
        const data = response.data;
        setRound({
          id: data.id,
          symbol: data.symbol,
          displayName: data.display_name,
          price: data.current_price,
          openPrice: data.open_price,
          change: data.price_change_percent,
          remainingSeconds: data.remaining_seconds,
          status: data.status,
        });
        setError(null);
      } else {
        setRound(null);
        setError(response.hint || 'No active round');
      }
    } catch (err) {
      setError('Failed to fetch round data');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchRound();
    
    const interval = setInterval(fetchRound, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchRound, refreshInterval]);

  return { round, loading, error, refetch: fetchRound };
}

export function useLeaderboard(symbol?: string, limit: number = 50) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await api.getLeaderboard(symbol, limit);
      
      if (response.success && response.data) {
        setLeaderboard(response.data);
        setError(null);
      } else {
        setError(response.hint || 'Failed to fetch leaderboard');
      }
    } catch (err) {
      setError('Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => {
    fetchLeaderboard();
    
    // Refresh leaderboard every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return { leaderboard, loading, error, refetch: fetchLeaderboard };
}

export function useMarketPrice(symbol: string, refreshInterval: number = 1000) {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const response = await api.getMarketData(symbol);
      
      if (response.success && response.data) {
        setPrice(response.data.mark_price);
        setChange24h(response.data.change_24h * 100);
        setError(null);
      } else {
        setError('Failed to fetch market data');
      }
    } catch (err) {
      setError('Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchPrice();
    
    const interval = setInterval(fetchPrice, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrice, refreshInterval]);

  return { price, change24h, loading, error };
}

export function useRoundHistory(symbol?: string, page: number = 1, limit: number = 10) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.getRoundHistory(symbol, page, limit);
      
      if (response.success && response.data) {
        setRounds(response.data.items);
        setTotal(response.data.total);
        setError(null);
      } else {
        setError(response.hint || 'Failed to fetch history');
      }
    } catch (err) {
      setError('Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, [symbol, page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { rounds, total, loading, error, refetch: fetchHistory };
}
