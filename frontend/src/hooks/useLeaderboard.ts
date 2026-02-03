'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { LeaderboardEntry, StatsResponse } from '@/lib/api';

interface UseLeaderboardOptions {
  symbol?: string;
  limit?: number;
  refreshInterval?: number;
}

interface Stats {
  totalBets: number | string;
  activeBots: number | string;
  totalRounds: number | string;
  avgWinRate: string;
}

export interface LeaderboardRow {
  id: number;
  bot_id: string;
  rank: number;
  name: string;
  avatar: string;
  score: number;
  pnl: number;
  roi: number;
  drawdown: number;
  profit_factor: string;
  win_rate: string;
  win_rate_num: number;  // Raw win rate 0-100 for calculations
  wins: number;
  losses: number;
  draws: number;
  total_rounds: number;
  streak: number;
  equity_curve: number[];
  strategy: string;
  tags: string[];
  battle_history: string[];  // Recent results: "win", "loss", "draw"
}

function formatProfitFactor(pf: number | null | undefined): string {
  if (pf === null) return '∞';
  if (pf === undefined) return '-';
  if (!Number.isFinite(pf)) return '-';
  return pf.toFixed(2);
}

// Transform backend data to match Leaderboard component expectations (no mock).
function transformLeaderboardData(entries: LeaderboardEntry[]): LeaderboardRow[] {
  return entries.map((entry, index) => ({
    id: index + 1,
    bot_id: entry.bot_id,
    rank: entry.rank,
    name: entry.bot_name,
    avatar: entry.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${entry.bot_id}`,
    score: entry.score,
    pnl: entry.pnl ?? 0,
    roi: entry.roi ?? 0,
    drawdown: entry.drawdown ?? 0,
    profit_factor: formatProfitFactor(entry.profit_factor),
    win_rate: `${Math.round(entry.win_rate * 100)}%`,
    win_rate_num: Math.round(entry.win_rate * 100),
    wins: entry.wins,
    losses: entry.losses,
    draws: entry.draws,
    total_rounds: entry.total_rounds,
    streak: entry.streak ?? 0,
    equity_curve: entry.equity_curve ?? [],
    strategy: entry.strategy ?? (entry.favorite_symbol ? `${entry.favorite_symbol} Specialist` : 'Multi-Asset'),
    tags: entry.tags ?? [],
    battle_history: entry.battle_history ?? [],
  }));
}

export function useLeaderboard({ symbol, limit = 50, refreshInterval = 30000 }: UseLeaderboardOptions = {}) {
  const [data, setData] = useState<LeaderboardRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBets: '-',
    activeBots: '-',
    totalRounds: '-',
    avgWinRate: '-',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch leaderboard
      const leaderboardRes = await api.getLeaderboard(symbol, limit);
      
      // Fetch stats
      const statsRes = await api.getStats();

      if (leaderboardRes.success && leaderboardRes.data) {
        const transformed = transformLeaderboardData(leaderboardRes.data.items);
        setData(transformed);
        setError(null);

        // Update stats
        if (statsRes.success && statsRes.data) {
          const s: StatsResponse = statsRes.data;
          const avgWinRate = transformed.length
            ? (transformed.reduce((acc, row) => acc + (row.wins + row.losses + row.draws > 0 ? row.wins / (row.wins + row.losses + row.draws) : 0), 0) / transformed.length) * 100
            : 0;
          setStats({
            totalBets: s.total_bets || 0,
            activeBots: s.total_bots || 0,
            totalRounds: s.total_rounds || 0,
            avgWinRate: `${avgWinRate.toFixed(1)}%`,
          });
        }
      } else {
        setError(leaderboardRes.error || 'Failed to fetch leaderboard');
      }
    } catch {
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

  return { data, stats, loading, error, refetch: fetchData };
}
