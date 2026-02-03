'use client'

import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Avatar, Button, Modal, ModalContent, ModalHeader, ModalBody } from "@nextui-org/react";
import { Flame, Snowflake, Activity, BarChart2, Clock, Zap, X } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";

const columns = [
  {name: "#", uid: "rank"},
  {name: "AGENT", uid: "bot"},
  {name: "EQUITY CURVE", uid: "equity"}, // New Visual
  {name: "TOTAL PNL", uid: "pnl"},
  {name: "ROI", uid: "roi"},
  {name: "PF", uid: "pf"}, // Profit Factor
  {name: "STATUS", uid: "status"}, // Streak/Active
];

interface LeaderboardProps {
  data: any[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agent: any) => void;
}

export default function Leaderboard({ data, selectedAgentId, onSelectAgent }: LeaderboardProps) {
  const [modalBotId, setModalBotId] = React.useState<number | null>(null);

  const renderCell = (user: any, columnKey: React.Key) => {
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
        return (
          <div className="flex items-center gap-4">
            <div className="relative">
                <Avatar 
                src={user.avatar} 
                size="md"
                className={user.rank <= 3 ? 'ring-2 ring-white/20 dark:ring-white/20 ring-slate-200' : ''}
                />
                {user.rank === 1 && (
                    <div className="absolute -top-2 -right-2 bg-[#eab308] dark:bg-[#FFD700] text-black text-[10px] px-1.5 rounded-full font-bold border border-black/10">
                        KING
                    </div>
                )}
            </div>
            <div>
               <div className="flex items-center gap-2">
                   <p className="font-bold text-slate-900 dark:text-white text-base">{user.name}</p>
                   {user.tags && user.tags.map((tag: string, i: number) => (
                       <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${
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
            {isPositive ? '+' : ''}${Math.abs(user.pnl).toLocaleString()}
          </div>
        );
      case "roi":
        const isRoiPositive = user.roi >= 0;
        return (
          <div className="flex flex-col">
              <span className={`font-mono font-bold ${isRoiPositive ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-[#dc2626] dark:text-[#FF4D4D]'}`}>
                {isRoiPositive ? '+' : ''}{user.roi.toLocaleString()}%
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono">MaxDD: {user.drawdown}%</span>
          </div>
        );
      case "pf":
        return (
          <div className="font-mono font-medium text-slate-700 dark:text-zinc-300">
            {user.profit_factor}
          </div>
        );
      case "status":
        const streak = user.streak || 0;
        return (
          <div className="flex items-center gap-2">
            {streak > 0 ? (
                <div className="flex items-center gap-1 text-[#EA4C1F] dark:text-[#FF5722] font-mono font-bold bg-[#EA4C1F]/10 dark:bg-[#FF5722]/10 px-2 py-1 rounded-full border border-[#EA4C1F]/20 dark:border-[#FF5722]/20">
                    <Flame size={14} className="fill-current" />
                    {streak}
                </div>
            ) : streak < 0 ? (
                <div className="flex items-center gap-1 text-[#dc2626] dark:text-[#FF4D4D] font-mono font-bold bg-[#dc2626]/10 dark:bg-[#FF4D4D]/10 px-2 py-1 rounded-full border border-[#dc2626]/20 dark:border-[#FF4D4D]/20">
                    <Snowflake size={14} className="fill-current" />
                    {Math.abs(streak)}
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

  const handleRowClick = (item: any) => {
    if (onSelectAgent) {
      onSelectAgent(item);
    }
  };

  return (
    <div className="fintech-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-sm relative h-[500px] flex flex-col">
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
        <Table 
          aria-label="Leaderboard table" 
          removeWrapper
          classNames={{
            base: "bg-transparent min-w-[800px]",
            th: "bg-slate-100/50 dark:bg-white/5 text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider py-5 border-b border-slate-200 dark:border-white/5 sticky top-0 z-10",
            td: "py-4 border-b border-slate-200/50 dark:border-white/5 last:border-0 transition-colors cursor-pointer text-slate-900 dark:text-white",
            tbody: "divide-y divide-slate-100 dark:divide-white/5",
            tr: "data-[selected=true]:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5"
          }}
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.uid} align="start">
                {column.name}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={data}>
            {(item) => {
              const isSelected = selectedAgentId === item.bot_id;
              return (
                <TableRow 
                  key={item.id} 
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                  style={isSelected ? {
                    backgroundColor: 'rgba(32, 230, 150, 0.1)',
                    borderLeft: '3px solid #EA4C1F',
                  } : undefined}
                  onClick={() => handleRowClick(item)}
                >
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
