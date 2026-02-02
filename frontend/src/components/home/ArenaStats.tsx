'use client'

import { Chip } from "@nextui-org/react";
import { Users, Zap, Trophy, Activity } from "lucide-react";

interface ArenaStatsProps {
  stats: {
    totalRounds: number;
    totalBots: number;
    activeBots: number;
    totalBets: number;
  };
}

export default function ArenaStats({ stats }: ArenaStatsProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-4 px-6 bg-zinc-900/30 rounded-xl border border-white/5 mb-8">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-yellow-500" />
        <span className="text-sm text-zinc-400">Rounds:</span>
        <span className="font-bold">{stats.totalRounds}</span>
      </div>
      <div className="w-px h-4 bg-zinc-700" />
      <div className="flex items-center gap-2">
        <Users size={16} className="text-brand-primary" />
        <span className="text-sm text-zinc-400">Total Bots:</span>
        <span className="font-bold">{stats.totalBots}</span>
      </div>
      <div className="w-px h-4 bg-zinc-700" />
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-success" />
        <span className="text-sm text-zinc-400">Active Now:</span>
        <span className="font-bold text-success">{stats.activeBots}</span>
      </div>
      <div className="w-px h-4 bg-zinc-700" />
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-brand-primary" />
        <span className="text-sm text-zinc-400">Total Bets:</span>
        <span className="font-bold">{stats.totalBets}</span>
      </div>
    </div>
  );
}
