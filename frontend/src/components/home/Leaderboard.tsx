'use client'

import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Avatar, Tooltip } from "@nextui-org/react";
import { Flame, Snowflake } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import type { LeaderboardRow } from "@/hooks/useLeaderboard";
import { getStreakInfo } from "@/lib/streak";

const columns = [
  {name: "#", uid: "rank", tooltip: "Rank"},
  {name: "AGENT", uid: "bot", tooltip: "AI agent name"},
  {name: "EQUITY CURVE", uid: "equity", tooltip: "Historical equity trend"},
  {name: "TOTAL PNL", uid: "pnl", tooltip: "Cumulative profit & loss"},
  {name: "ROI", uid: "roi", tooltip: "Return on investment"},
  {name: "PF", uid: "pf", tooltip: "Profit Factor = Total Gains / Total Losses"},
  {name: "STATUS", uid: "status", tooltip: "Win streak 🔥 or loss streak ❄️"},
];

interface LeaderboardProps {
  data: LeaderboardRow[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agent: LeaderboardRow) => void;
}

export default function Leaderboard({ data, selectedAgentId, onSelectAgent }: LeaderboardProps) {
  const [modalBotId, setModalBotId] = React.useState<number | null>(null);

  // Convert selectedAgentId to Set for NextUI's controlled selection
  const selectedKeys = React.useMemo(() => {
    return selectedAgentId ? new Set([selectedAgentId]) : new Set<string>();
  }, [selectedAgentId]);

  // Handle selection change from NextUI Table
  const handleSelectionChange = React.useCallback((keys: "all" | Set<React.Key>) => {
    if (keys === "all" || keys.size === 0) return;
    const selectedKey = Array.from(keys)[0] as string;
    const selectedItem = data.find(item => item.bot_id === selectedKey);
    if (selectedItem && onSelectAgent) {
      onSelectAgent(selectedItem);
    }
  }, [data, onSelectAgent]);

  const renderCell = (user: LeaderboardRow, columnKey: React.Key) => {
    switch (columnKey) {
      case "rank":
        return (
          <div className="pl-4">
            <span className={`font-mono text-lg font-bold ${
              user.rank === 1 ? 'text-[#eab308] dark:text-[#FFD700]' : 
              user.rank === 2 ? 'text-slate-400 dark:text-[#C0C0C0]' : 
              user.rank === 3 ? 'text-amber-700 dark:text-[#CD7F32]' : 
              'text-slate-500 dark:text-zinc-600'
            }`}>
              {String(user.rank).padStart(2, '0')}
            </span>
          </div>
        );
      case "bot":
        const streakInfo = getStreakInfo(user.streak || 0);
        const hasStreakStyle = streakInfo.style !== null;
        
        // 头像框样式
        const avatarRingClass = hasStreakStyle 
          ? streakInfo.style!.avatarRing 
          : (user.rank <= 3 ? 'ring-2 ring-white/20 dark:ring-white/20 ring-slate-200' : '');
        
        // 头像动画类
        const avatarAnimationClass = hasStreakStyle ? streakInfo.style!.animationClass : '';
        
        return (
          <div className="flex items-center gap-4">
            <div className="relative">
                <div 
                  className={`rounded-full ${avatarAnimationClass}`}
                  style={hasStreakStyle ? { boxShadow: streakInfo.style!.avatarGlow } : undefined}
                >
                  <Avatar 
                    src={user.avatar} 
                    size="md"
                    className={avatarRingClass}
                  />
                </div>
                {/* KING 徽章 */}
                {user.rank === 1 && (
                    <div className="absolute -top-2 -right-2 bg-[#eab308] dark:bg-[#FFD700] text-black text-[10px] px-1.5 rounded-full font-bold border border-black/10 z-10">
                        KING
                    </div>
                )}
                {/* Streak 称号徽章 */}
                {streakInfo.title && streakInfo.tier >= 5 && (
                    <Tooltip 
                      content={streakInfo.title.description}
                      placement="top"
                      delay={200}
                      classNames={{ content: "text-xs bg-zinc-900 text-white px-2 py-1" }}
                    >
                      <div className={`absolute -bottom-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-black/20 z-10 cursor-help ${
                        streakInfo.isWinning 
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' 
                          : 'bg-gradient-to-r from-violet-500 to-gray-600 text-white'
                      }`}>
                        {streakInfo.title.emoji}
                      </div>
                    </Tooltip>
                )}
            </div>
            <div>
               <div className="flex items-center gap-2 flex-nowrap">
                   {/* 名字发光效果 */}
                   <p 
                     className={`font-bold text-base max-w-[140px] truncate ${
                       hasStreakStyle 
                         ? (streakInfo.tier >= 7 ? 'animate-streak-rainbow-text' : streakInfo.style!.textColorClass)
                         : 'text-slate-900 dark:text-white'
                     }`}
                     style={hasStreakStyle && streakInfo.tier < 7 ? { textShadow: streakInfo.style!.textGlow } : undefined}
                     title={user.name}
                   >
                     {user.name}
                   </p>
                   {/* Streak 称号文字 */}
                   {streakInfo.title && (
                     <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${
                       streakInfo.isWinning
                         ? 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10'
                         : 'border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/10'
                     }`}>
                       {streakInfo.title.emoji} {streakInfo.title.titleEn}
                     </span>
                   )}
                   {user.tags && user.tags.map((tag: string, i: number) => (
                       <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                           tag === 'Whale' ? 'border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10' :
                           tag === 'Degen' ? 'border-pink-500/30 text-pink-600 dark:text-pink-400 bg-pink-500/10' :
                           tag === 'Rekt' ? 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10' :
                           'border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800'
                       }`}>
                           {tag}
                       </span>
                   ))}
               </div>
               <p className="text-xs text-zinc-500 font-mono mt-1 flex items-center gap-1">
                 {user.strategy}
               </p>
            </div>
          </div>
        );
      case "equity":
        return (
          <div className="w-[120px] opacity-80 hover:opacity-100 transition-opacity">
            <Sparkline data={user.equity_curve || []} width={100} height={30} color="auto" />
          </div>
        );
      case "pnl":
        const isPositive = user.pnl >= 0;
        return (
          <div className={`font-mono font-bold text-base ${isPositive ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-[#dc2626] dark:text-[#FF4D4D]'}`}>
            {isPositive ? '+' : '-'}${Math.abs(user.pnl).toLocaleString()}
          </div>
        );
      case "roi":
        const isRoiPositive = user.roi >= 0;
        return (
          <div className="flex flex-col">
              <span className={`font-mono font-bold ${isRoiPositive ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-[#dc2626] dark:text-[#FF4D4D]'}`}>
                {isRoiPositive ? '+' : ''}{user.roi.toLocaleString()}%
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono whitespace-nowrap">MaxDD: {user.drawdown}%</span>
          </div>
        );
      case "pf":
        return (
          <div className="font-mono font-medium text-slate-700 dark:text-zinc-300">
            {user.profit_factor || "-"}
          </div>
        );
      case "status":
        const statusStreak = user.streak || 0;
        const statusStreakInfo = getStreakInfo(statusStreak);
        return (
          <div className="flex items-center gap-2">
            {statusStreak > 0 ? (
                <div className={`flex items-center gap-1 font-mono font-bold px-2 py-1 rounded-full border ${
                  statusStreakInfo.tier >= 5
                    ? 'text-yellow-500 dark:text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
                    : statusStreakInfo.tier >= 3
                    ? 'text-orange-500 dark:text-orange-400 bg-orange-500/15 border-orange-500/30'
                    : 'text-[#EA4C1F] dark:text-[#FF5722] bg-[#EA4C1F]/10 border-[#EA4C1F]/20'
                }`}>
                    <Flame size={14} className={`fill-current ${statusStreakInfo.tier >= 5 ? 'animate-pulse' : ''}`} />
                    {statusStreak}
                </div>
            ) : statusStreak < 0 ? (
                <div className={`flex items-center gap-1 font-mono font-bold px-2 py-1 rounded-full border ${
                  statusStreakInfo.tier >= 5
                    ? 'text-violet-500 dark:text-violet-400 bg-violet-500/15 border-violet-500/30'
                    : statusStreakInfo.tier >= 3
                    ? 'text-sky-500 dark:text-sky-400 bg-sky-500/15 border-sky-500/30'
                    : 'text-[#dc2626] dark:text-[#FF4D4D] bg-[#dc2626]/10 border-[#dc2626]/20'
                }`}>
                    <Snowflake size={14} className="fill-current" />
                    {Math.abs(statusStreak)}
                </div>
            ) : (
                <span className="text-slate-400 dark:text-zinc-600 font-mono">-</span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fintech-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-sm relative h-[500px] flex flex-col">
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
        <Table 
          aria-label="Leaderboard table" 
          removeWrapper
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={selectedKeys}
          onSelectionChange={handleSelectionChange}
          classNames={{
            base: "bg-transparent min-w-[800px]",
            th: "bg-slate-100/50 dark:bg-white/5 text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider py-5 border-b border-slate-200 dark:border-white/5 sticky top-0 z-10",
            td: "py-4 border-b border-slate-200/50 dark:border-white/5 last:border-0 transition-colors cursor-pointer text-slate-900 dark:text-white",
            tbody: "divide-y divide-slate-100 dark:divide-white/5",
            tr: "hover:bg-slate-50 dark:hover:bg-white/5 data-[selected=true]:bg-white/5 data-[selected=true]:border-l-3 data-[selected=true]:border-l-[#EA4C1F]"
          }}
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.uid} align="start">
                <Tooltip 
                  content={column.tooltip}
                  placement="top"
                  delay={300}
                  classNames={{
                    content: "text-xs bg-zinc-900 text-white px-2 py-1"
                  }}
                >
                  <span className="cursor-help">{column.name}</span>
                </Tooltip>
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={data}>
            {(item) => (
              <TableRow 
                key={item.bot_id}
                className="cursor-pointer transition-colors"
              >
                {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
