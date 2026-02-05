'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { LeaderboardEntry, StatsResponse } from '@/lib/api';

export type LeaderboardPeriod = '24h' | '7d' | '30d' | 'all';

interface UseLeaderboardOptions {
  symbol?: string;
  period?: LeaderboardPeriod;
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
  favorite_symbol?: string;  // Agent's preferred trading symbol
}

// ============ 共享的类型转换工具 ============

export function formatProfitFactor(pf: number | null | undefined): string {
  if (pf === null) return '∞';
  if (pf === undefined) return '-';
  if (!Number.isFinite(pf)) return '-';
  return pf.toFixed(2);
}

/**
 * 将 LeaderboardEntry 转换为 LeaderboardRow
 * 可复用于 useLeaderboard 和其他需要转换的地方
 */
export function transformLeaderboardEntry(entry: LeaderboardEntry, index?: number): LeaderboardRow {
  return {
    id: index ?? entry.rank,
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
    favorite_symbol: entry.favorite_symbol,
  };
}

/**
 * 将 AgentProfileResponse 转换为 LeaderboardRow
 * 用于从 /agents/{id} API 获取数据后的转换
 */
export function transformAgentProfile(agent: import('@/lib/api').AgentProfileResponse): LeaderboardRow {
  return {
    id: agent.global_rank,
    bot_id: agent.agent_id,
    rank: agent.global_rank,
    name: agent.name,
    avatar: agent.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.agent_id}`,
    score: agent.total_score,
    pnl: agent.pnl ?? 0,
    roi: agent.roi ?? 0,
    drawdown: agent.drawdown ?? 0,
    profit_factor: formatProfitFactor(agent.profit_factor),
    win_rate: `${Math.round(agent.win_rate * 100)}%`,
    win_rate_num: Math.round(agent.win_rate * 100),
    wins: agent.total_wins,
    losses: agent.total_losses,
    draws: agent.total_draws,
    total_rounds: agent.total_rounds,
    streak: agent.streak ?? 0,
    equity_curve: agent.equity_curve ?? [],
    strategy: agent.strategy ?? (agent.favorite_symbol ? `${agent.favorite_symbol} Specialist` : 'Multi-Asset'),
    tags: agent.tags ?? [],
    battle_history: agent.battle_history ?? [],
    favorite_symbol: agent.favorite_symbol,
  };
}

// Transform backend data to match Leaderboard component expectations
function transformLeaderboardData(entries: LeaderboardEntry[]): LeaderboardRow[] {
  return entries.map((entry, index) => transformLeaderboardEntry(entry, index + 1));
}

export function useLeaderboard({ symbol, period = 'all', limit = 50, refreshInterval = 30000 }: UseLeaderboardOptions = {}) {
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
      const leaderboardRes = await api.getLeaderboard(symbol, limit, period);
      
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
  }, [symbol, limit, period]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { data, stats, loading, error, refetch: fetchData };
}
