'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { LeaderboardEntry } from '@/lib/api';

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

// Transform backend data to match frontend Leaderboard component expectations
function transformLeaderboardData(entries: LeaderboardEntry[]): any[] {
  return entries.map((entry, index) => {
    // Generate random equity curve for visualization
    const equityCurve = Array(20).fill(0).map((_, i) => {
      const base = entry.score - 100;
      const noise = (Math.random() - 0.5) * 20;
      return base * (i / 20) + noise;
    });

    // Calculate PnL based on score
    const pnl = (entry.wins * 10) - (entry.losses * 5);
    const roi = entry.total_rounds > 0 ? ((entry.score - 100) / 100) * 100 : 0;
    
    // Calculate streak (approximate)
    const recentWins = Math.min(entry.wins, 5);
    const streak = Math.random() > 0.5 ? recentWins : -Math.floor(Math.random() * 3);

    return {
      id: index + 1,
      bot_id: entry.bot_id,
      rank: entry.rank,
      name: entry.bot_name,
      avatar: entry.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${entry.bot_id}`,
      score: entry.score,
      pnl: pnl,
      roi: Math.round(roi * 10) / 10,
      drawdown: Math.floor(Math.random() * 30) + 5,
      profit_factor: entry.win_rate > 0 ? (entry.win_rate / (100 - entry.win_rate) * 1.5).toFixed(2) : '0.00',
      sharpe_ratio: (Math.random() * 2 + 0.5).toFixed(2),
      win_rate: `${Math.round(entry.win_rate * 100)}%`,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      total_rounds: entry.total_rounds,
      streak: streak,
      equity_curve: equityCurve,
      strategy: entry.favorite_symbol ? `${entry.favorite_symbol} Specialist` : 'Multi-Asset',
      avg_hold_time: `${Math.floor(Math.random() * 8) + 2}m`,
      tags: entry.win_rate > 70 ? ['Alpha'] : entry.win_rate < 40 ? ['Rekt'] : [],
      style_analysis: {
        aggressive: Math.floor(Math.random() * 100),
        speed: Math.floor(Math.random() * 100),
        risk: Math.floor(Math.random() * 100),
      },
    };
  });
}

export function useLeaderboard({ symbol, limit = 50, refreshInterval = 30000 }: UseLeaderboardOptions = {}) {
  const [data, setData] = useState<any[]>([]);
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
          const s = statsRes.data as any;
          setStats({
            totalBets: s.total_bets || 0,
            activeBots: s.total_bots || 0,
            totalRounds: s.total_rounds || 0,
            avgWinRate: '58.4%',
          });
        }
      } else {
        setError(leaderboardRes.error || 'Failed to fetch leaderboard');
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

  return { data, stats, loading, error, refetch: fetchData };
}
