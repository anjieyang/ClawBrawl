'use client';

import { useMemo } from 'react';
import { Avatar, Tooltip } from "@nextui-org/react";
import { Trophy, Target, Flame, Snowflake, Zap, Shield, Swords } from "lucide-react";

interface AgentProfileCardProps {
  agent: {
    rank?: number;
    name?: string;
    avatar?: string;
    score?: number;  // Total score (can be negative)
    win_rate?: string;
    win_rate_num?: number;
    roi?: number;
    pnl?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    streak?: number;
    strategy?: string;
    tags?: string[];
    battle_history?: string[];  // Real battle results from backend
  } | null;
}

// Transform real battle history from backend
function getBattleHistory(agent: AgentProfileCardProps['agent']) {
  if (!agent?.battle_history || agent.battle_history.length === 0) {
    return [];
  }
  
  // battle_history is already sorted by most recent first
  return agent.battle_history.slice(0, 80).map((result, index) => ({
    result: result as 'win' | 'loss' | 'draw',
    round: index + 1,
  }));
}

// Get rarity based on rank
function getRarity(rank: number): { name: string; color: string; glow: string; border: string } {
  if (rank === 1) return { name: 'LEGENDARY', color: 'text-[#eab308] dark:text-[#FFD700]', glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)] dark:shadow-[0_0_30px_rgba(255,215,0,0.4)]', border: 'border-[#eab308]/50 dark:border-[#FFD700]/50' };
  if (rank === 2) return { name: 'EPIC', color: 'text-slate-400 dark:text-[#C0C0C0]', glow: 'shadow-[0_0_25px_rgba(148,163,184,0.3)] dark:shadow-[0_0_25px_rgba(192,192,192,0.3)]', border: 'border-slate-400/40 dark:border-[#C0C0C0]/40' };
  if (rank === 3) return { name: 'RARE', color: 'text-amber-700 dark:text-[#CD7F32]', glow: 'shadow-[0_0_20px_rgba(180,83,9,0.2)] dark:shadow-[0_0_20px_rgba(205,127,50,0.3)]', border: 'border-amber-700/30 dark:border-[#CD7F32]/30' };
  return { name: 'COMMON', color: 'text-purple-500 dark:text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]', border: 'border-purple-500/30' };
}

export default function AgentProfileCard({ agent }: AgentProfileCardProps) {
  const battleHistory = useMemo(() => {
    if (!agent) return [];
    return getBattleHistory(agent);
  }, [agent]);

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 rounded-2xl border-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-gradient-to-b dark:from-zinc-900 dark:via-black dark:to-black">
        <Trophy size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Select an agent to view profile</p>
      </div>
    );
  }

  const rarity = getRarity(agent.rank || 999);
  const isPositivePnl = (agent.pnl ?? 0) >= 0;
  const streak = agent.streak || 0;
  const wins = agent.wins || 0;
  const losses = agent.losses || 0;
  const draws = agent.draws || 0;
  const totalBattles = wins + losses + draws;
  const score = agent.score ?? 0;  // Actual total score (can be negative)
  
  // Battle stats from real history (for the grid)
  const battleStats = battleHistory.reduce((acc, d) => {
    if (d.result === 'win') acc.wins++;
    else if (d.result === 'loss') acc.losses++;
    else acc.draws++;
    return acc;
  }, { wins: 0, losses: 0, draws: 0 });
  
  const historyCount = battleHistory.length;

  return (
    <div className={`h-full flex flex-col relative overflow-hidden rounded-2xl ${rarity.border} border-2 ${rarity.glow}`}>
      {/* Background gradient based on rarity */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-zinc-900 dark:via-black dark:to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black/5 via-transparent to-transparent dark:from-white/5 dark:via-transparent dark:to-transparent" />
      
      {/* Content */}
      <div className="relative flex flex-col h-full p-4">
        
        {/* Rarity Badge */}
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-black tracking-widest ${rarity.color}`}>
            {rarity.name}
          </span>
        </div>

        {/* Hero Section - Avatar & Name */}
        <div className="flex flex-col items-center">
          {/* Avatar with glow */}
          <div className="relative mb-2">
            <div className={`absolute inset-0 rounded-full blur-xl ${
              agent.rank === 1 ? 'bg-[#FFD700]/40' : 
              agent.rank === 2 ? 'bg-[#C0C0C0]/40' : 
              agent.rank === 3 ? 'bg-[#CD7F32]/40' : 
              'bg-purple-500/40'
            }`} />
            <Avatar 
              src={agent.avatar} 
              className={`w-16 h-16 ring-2 ${
                agent.rank === 1 ? 'ring-[#FFD700]' :
                agent.rank === 2 ? 'ring-[#C0C0C0]' :
                agent.rank === 3 ? 'ring-[#CD7F32]' :
                'ring-purple-500'
              }`}
            />
            {/* Rank Badge */}
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
              agent.rank === 1 ? 'bg-gradient-to-br from-[#FFD700] to-[#B8860B] text-black' :
              agent.rank === 2 ? 'bg-gradient-to-br from-[#E0E0E0] to-[#A0A0A0] text-black' :
              agent.rank === 3 ? 'bg-gradient-to-br from-[#CD7F32] to-[#8B4513] text-white' :
              'bg-gradient-to-br from-purple-400 to-purple-600 text-white'
            }`}>
              #{agent.rank}
            </div>
          </div>
          
          {/* Name & Tags */}
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{agent.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {agent.tags?.slice(0, 2).map((tag: string) => (
              <span 
                key={tag} 
                className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  tag === 'Whale' ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300' :
                  tag === 'Degen' ? 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300' :
                  tag === 'Rekt' ? 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-300' :
                  'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[9px] text-slate-500 dark:text-zinc-500 font-mono">{agent.strategy}</p>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center gap-2 my-3 py-2 bg-slate-200/50 dark:bg-black/40 rounded-lg border border-slate-300/50 dark:border-white/5">
          <Zap size={16} className={score >= 0 ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-[#dc2626] dark:text-[#FF4D4D]'} />
          <span className={`text-2xl font-black ${score >= 0 ? 'text-slate-900 dark:text-white' : 'text-[#dc2626] dark:text-[#FF4D4D]'}`}>
            {score.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase">Score</span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Attack (Win Rate) */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-200/50 dark:bg-black/30 rounded-lg border border-slate-300/50 dark:border-white/5">
            <Swords size={14} className="text-[#dc2626] dark:text-[#FF4D4D]" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{agent.win_rate}</div>
              <div className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase">Win Rate</div>
            </div>
          </div>
          
          {/* Defense (ROI) */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-200/50 dark:bg-black/30 rounded-lg border border-slate-300/50 dark:border-white/5">
            <Shield size={14} className={isPositivePnl ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-[#dc2626] dark:text-[#FF4D4D]'} />
            <div>
              <div className={`text-sm font-bold ${isPositivePnl ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-[#dc2626] dark:text-[#FF4D4D]'}`}>
                {isPositivePnl ? '+' : ''}{agent.roi}%
              </div>
              <div className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase">ROI</div>
            </div>
          </div>
          
          {/* Rounds */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-200/50 dark:bg-black/30 rounded-lg border border-slate-300/50 dark:border-white/5">
            <Target size={14} className="text-blue-500 dark:text-blue-400" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{totalBattles}</div>
              <div className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase">Battles</div>
            </div>
          </div>
          
          {/* Streak */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-200/50 dark:bg-black/30 rounded-lg border border-slate-300/50 dark:border-white/5">
            {streak >= 0 ? (
              <Flame size={14} className={streak > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400 dark:text-zinc-600'} />
            ) : (
              <Snowflake size={14} className="text-cyan-500 dark:text-cyan-400" />
            )}
            <div>
              <div className={`text-sm font-bold ${
                streak > 0 ? 'text-orange-500 dark:text-orange-400' : streak < 0 ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-500 dark:text-zinc-500'
              }`}>
                {streak === 0 ? '-' : Math.abs(streak)}
              </div>
              <div className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase">Streak</div>
            </div>
          </div>
        </div>

        {/* Battle History - 80 slots grid: green=win, red=loss, gray=not participated */}
        <div className="bg-slate-200/50 dark:bg-black/30 rounded-lg p-3 border border-slate-300/50 dark:border-white/5 mt-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-bold">
              Last 80 Rounds
            </span>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="text-emerald-500 dark:text-emerald-400 font-bold">{battleStats.wins}W</span>
              <span className="text-slate-400 dark:text-zinc-600">/</span>
              <span className="text-red-500 dark:text-red-400 font-bold">{battleStats.losses}L</span>
            </div>
          </div>

          <div className="grid gap-1 flex-1 content-center" style={{ gridTemplateColumns: 'repeat(20, 1fr)' }}>
            {/* Render 80 slots: actual battles + gray empty slots */}
            {Array.from({ length: 80 }).map((_, index) => {
              const battle = battleHistory[index];
              const hasResult = battle !== undefined;
              
              if (!hasResult) {
                // Gray slot - not participated
                return (
                  <Tooltip
                    key={index}
                    content={
                      <div className="text-xs p-1">
                        <div className="text-slate-500 dark:text-zinc-400">Not participated</div>
                      </div>
                    }
                    classNames={{
                      base: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-lg",
                    }}
                  >
                    <div className="aspect-square rounded-[2px] bg-slate-300 dark:bg-zinc-700 opacity-40" />
                  </Tooltip>
                );
              }
              
              return (
                <Tooltip
                  key={index}
                  content={
                    <div className="text-xs p-1">
                      <div className="font-semibold text-slate-900 dark:text-white">Battle #{historyCount - index}</div>
                      <div className={
                        battle.result === 'win' ? 'text-emerald-500 dark:text-emerald-400' : 
                        battle.result === 'loss' ? 'text-red-500 dark:text-red-400' :
                        'text-amber-500 dark:text-amber-400'
                      }>
                        {battle.result === 'win' ? 'Victory' : battle.result === 'loss' ? 'Defeat' : 'Draw'}
                      </div>
                    </div>
                  }
                  classNames={{
                    base: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-lg",
                  }}
                >
                  <div 
                    className={`aspect-square rounded-[2px] cursor-pointer hover:scale-105 transition-transform ${
                      battle.result === 'win' ? 'bg-emerald-500 dark:bg-emerald-400' : 
                      battle.result === 'loss' ? 'bg-red-500 dark:bg-red-400' :
                      'bg-amber-500 dark:bg-amber-400'
                    }`}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
