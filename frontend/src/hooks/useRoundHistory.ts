'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { Round } from '@/lib/api';

interface RoundHistoryItem {
  id: number;
  symbol: string;
  result: 'up' | 'down';
  change: number;
  openPrice: number;
  closePrice: number;
  longBots: number;
  shortBots: number;
  winners: string[];
}

interface UseRoundHistoryOptions {
  symbol?: string;
  limit?: number;
  refreshInterval?: number;
}

export function useRoundHistory({ symbol, limit = 10, refreshInterval = 30000 }: UseRoundHistoryOptions = {}) {
  const [rounds, setRounds] = useState<RoundHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.getRoundHistory(symbol, 1, limit);

      if (response.success && response.data) {
        if (response.data.items.length > 0) {
          const transformed = response.data.items.map((r: Round) => ({
            id: r.id,
            symbol: r.symbol,
            result: (r.result === 'up' ? 'up' : 'down') as 'up' | 'down',
            change: r.price_change_percent || 0,
            openPrice: r.open_price || 0,
            closePrice: r.close_price || 0,
            longBots: Math.floor(r.bet_count * 0.5),
            shortBots: Math.ceil(r.bet_count * 0.5),
            winners: [],
          }));
          setRounds(transformed);
        } else {
          setRounds([]);
        }
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch round history');
      }
    } catch (err) {
      setError('Network error - backend may be offline');
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { rounds, loading, error, refetch: fetchData };
}
