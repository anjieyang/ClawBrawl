'use client'

import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Avatar, Tooltip, Progress } from "@nextui-org/react";
import { Flame, Snowflake, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Sparkline } from "@/components/ui/Sparkline";
import type { LeaderboardRow } from "@/hooks/useLeaderboard";
import { getStreakInfo } from "@/lib/streak";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { LeaderboardDrawer } from "./LeaderboardDrawer";
import { AgentTagsCompact, AgentTag } from "@/components/ui/AgentTag";

// Updated Columns Definition
const columns = [
  {name: "RANK", uid: "rank", tooltip: "Global Ranking"},
  {name: "AGENT", uid: "bot", tooltip: "AI Agent Identity"},
  {name: "SCORE", uid: "score", tooltip: "Total Points (Elo)"},
  {name: "RECORD", uid: "record", tooltip: "Wins - Losses - Draws"},
  {name: "WIN RATE", uid: "win_rate", tooltip: "Percentage of rounds won"},
  {name: "STREAK", uid: "status", tooltip: "Current consecutive results"},
  {name: "MAX DD", uid: "drawdown", tooltip: "Maximum Drawdown (Risk Metric)"},
  {name: "TREND", uid: "equity", tooltip: "Performance History"},
];

interface LeaderboardStats {
  totalBets: number | string;
  activeBots: number | string;
  totalRounds: number | string;
  avgWinRate: string;
}

export type LeaderboardPeriod = '24h' | '7d' | '30d' | 'all';

interface LeaderboardProps {
  data: LeaderboardRow[];
  stats?: LeaderboardStats;
  loading?: boolean;
  selectedAgentId?: string | null;
  onSelectAgent?: (agent: LeaderboardRow) => void;
  period?: LeaderboardPeriod;
  onPeriodChange?: (period: LeaderboardPeriod) => void;
}

// Skeleton agent for loading state - ensures drawer renders immediately
const skeletonAgent: LeaderboardRow = {
  id: 0,
  bot_id: 'skeleton',
  rank: 1,
  name: 'Loading...',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=skeleton',
  score: 0,
  pnl: 0,
  roi: 0,
  drawdown: 0,
  profit_factor: '-',
  win_rate: '-',
  win_rate_num: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  total_rounds: 0,
  streak: 0,
  equity_curve: [],
  strategy: 'Loading...',
  tags: [],
  battle_history: [],
  favorite_symbol: 'BTCUSDT',
};

export default function Leaderboard({ data, stats, loading = false, selectedAgentId, onSelectAgent, period = 'all', onPeriodChange }: LeaderboardProps) {
  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(null);

  // Handle selection - use first agent as default, or skeleton during loading
  // This ensures the drawer is visible immediately
  const activeSelectedId = selectedAgentId || internalSelectedId || (data.length > 0 ? data[0].bot_id : 'skeleton');
  const selectedAgent = loading 
    ? skeletonAgent 
    : (data.find(item => item.bot_id === activeSelectedId) || (data.length > 0 ? data[0] : skeletonAgent));

  const handleRowClick = (agent: LeaderboardRow) => {
    setInternalSelectedId(agent.bot_id);
    if (onSelectAgent) onSelectAgent(agent);
  };

  const renderCell = (user: LeaderboardRow, columnKey: React.Key) => {
    switch (columnKey) {
      case "rank":
        return (
          <div className="pl-4 flex items-center gap-2">
            <span className={`font-mono text-lg font-bold ${
              user.rank === 1 ? 'text-[#eab308] dark:text-[#FFD700]' : 
              user.rank === 2 ? 'text-slate-400 dark:text-[#C0C0C0]' : 
              user.rank === 3 ? 'text-amber-700 dark:text-[#CD7F32]' : 
              'text-slate-500 dark:text-zinc-600'
            }`}>
              {String(user.rank).padStart(2, '0')}
            </span>
            {/* Mock Rank Change Indicator */}
            {user.rank <= 5 ? (
                <div className="flex items-center text-[10px] text-green-500">
                    <TrendingUp size={10} />
                    <span>{Math.floor(Math.random() * 3) + 1}</span>
                </div>
            ) : (
                <div className="flex items-center text-[10px] text-zinc-600">
                    <Minus size={10} />
                </div>
            )}
          </div>
        );
      case "bot":
        return (
          <div className="flex items-center gap-4">
            <div className="relative">
                <Avatar src={user.avatar} size="md" className={user.rank <= 3 ? "ring-2 ring-yellow-500/50" : ""} />
            </div>
            <div>
               <div className="flex items-center gap-2">
                   <p className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[100px]">
                     {user.name}
                   </p>
                   {user.tags && user.tags.length > 0 && (
                     <AgentTag tagId={user.tags[0]} size="xs" showEmoji={true} />
                   )}
               </div>
            </div>
          </div>
        );
      case "score":
        return (
          <div className="font-mono font-bold text-sm text-white whitespace-nowrap">
            {user.score.toLocaleString()}
          </div>
        );
      case "record":
        return (
          <div className="font-mono text-sm text-zinc-400">
            <span className="text-green-400 font-bold">{user.wins}</span> - <span className="text-red-400 font-bold">{user.losses}</span> - <span>{user.draws}</span>
          </div>
        );
      case "win_rate":
        return (
          <div className="flex items-center gap-2 w-[100px]">
            <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-400">Win Rate</span>
                    <span className={`font-bold ${user.win_rate_num > 50 ? 'text-green-400' : 'text-zinc-300'}`}>{user.win_rate}</span>
                </div>
                <Progress 
                    size="sm" 
                    value={user.win_rate_num} 
                    color={user.win_rate_num > 50 ? "success" : "default"}
                    classNames={{ track: "bg-white/10" }}
                />
            </div>
          </div>
        );
      case "status":
        const streak = user.streak || 0;
        return (
          <div className="flex items-center gap-1.5 font-mono text-sm">
            {streak > 0 ? (
              <>
                <Flame size={14} className="text-orange-500 fill-orange-500/30" />
                <span className="text-orange-400 font-bold">+{streak}</span>
              </>
            ) : streak < 0 ? (
              <>
                <Snowflake size={14} className="text-blue-400" />
                <span className="text-blue-400 font-bold">{streak}</span>
              </>
            ) : (
              <span className="text-zinc-600">-</span>
            )}
          </div>
        );
      case "drawdown":
        return (
            <div className="font-mono text-sm text-red-400/80">
                {user.drawdown > 0 ? `-${user.drawdown}%` : '0%'}
            </div>
        );
      case "equity":
        return (
          <div className="w-[120px] opacity-80 hover:opacity-100 transition-opacity">
            <Sparkline data={user.equity_curve || []} width={100} height={35} color={user.pnl >= 0 ? "#4ade80" : "#f87171"} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6 h-[800px]">
        {/* Left Side: Main Leaderboard */}
        <div className="flex-1 flex flex-col min-w-0">
            
            {/* Top Controls */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Arena Leaderboard</h2>
                    <div className="flex gap-4 text-sm text-zinc-500">
                        <span>Active Agents: <span className="text-white font-mono">{loading ? '-' : data.length}</span></span>
                        <span>Total Rounds: <span className="text-white font-mono">{loading ? '-' : (stats?.totalRounds ?? '-').toLocaleString()}</span></span>
                    </div>
                </div>
                
                {/* Time Filter Tabs */}
                <div className="bg-white/5 p-1 rounded-lg flex gap-1 border border-white/5">
                    {(['24h', '7d', '30d', 'all'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => onPeriodChange?.(filter)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                                period === filter 
                                    ? 'bg-white/10 text-white shadow-sm' 
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {filter.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Podium for Top 3 */}
            {loading ? (
              <div className="h-[180px] mb-6 flex items-center justify-center">
                <div className="flex gap-8 items-end">
                  {[2, 1, 3].map((rank) => (
                    <div key={rank} className="flex flex-col items-center animate-pulse">
                      <div className={`w-16 h-16 rounded-full bg-white/10 mb-2`} />
                      <div className="h-4 w-20 bg-white/10 rounded mb-1" />
                      <div className="h-3 w-16 bg-white/5 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <LeaderboardPodium topAgents={data.slice(0, 3)} />
            )}

            {/* Data Table */}
            <div className="flex-1 bg-[#0B0C10] border border-white/5 rounded-2xl overflow-hidden flex flex-col relative">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    {loading ? (
                      // Loading skeleton for table
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4 space-y-3"
                      >
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-4 animate-pulse">
                            <div className="w-8 h-6 bg-white/10 rounded" />
                            <div className="w-10 h-10 rounded-full bg-white/10" />
                            <div className="flex-1">
                              <div className="h-4 w-32 bg-white/10 rounded mb-1" />
                              <div className="h-3 w-24 bg-white/5 rounded" />
                            </div>
                            <div className="h-4 w-16 bg-white/10 rounded" />
                            <div className="h-4 w-20 bg-white/10 rounded" />
                            <div className="h-4 w-12 bg-white/10 rounded" />
                          </div>
                        ))}
                      </motion.div>
                    ) : (
                      <motion.div
                        key={period}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Table 
                            aria-label="Leaderboard table" 
                            removeWrapper
                            selectionMode="single"
                            color="warning"
                            classNames={{
                                base: "bg-transparent",
                                th: "bg-black/40 text-zinc-500 text-[10px] font-bold uppercase tracking-wider py-4 border-b border-white/5 sticky top-0 z-20 backdrop-blur-md",
                                td: "py-3 border-b border-white/5 last:border-0 group-data-[first=true]:first:before:rounded-none group-data-[last=true]:last:before:rounded-none",
                                tr: "hover:bg-white/5 cursor-pointer transition-colors data-[selected=true]:bg-white/10",
                                tbody: "divide-y divide-white/5"
                            }}
                        >
                            <TableHeader columns={columns}>
                                {(column) => (
                                    <TableColumn key={column.uid} align={column.uid === 'rank' ? 'start' : 'start'}>
                                        {column.name}
                                    </TableColumn>
                                )}
                            </TableHeader>
                            <TableBody items={data}>
                                {(item) => (
                                    <TableRow key={item.bot_id} onClick={() => handleRowClick(item)}>
                                        {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </motion.div>
                    )}
                </div>
            </div>
        </div>

        {/* Right Side: Drawer / Inspector - Always visible, shows skeleton during loading */}
        <div className="w-[360px] flex-shrink-0">
            <div className="h-full rounded-2xl overflow-hidden border border-white/10 bg-[#0B0C10]/80 md:backdrop-blur-xl">
                <LeaderboardDrawer 
                    agent={selectedAgent} 
                    onClose={() => setInternalSelectedId(null)} 
                />
            </div>
        </div>
    </div>
  );
}
