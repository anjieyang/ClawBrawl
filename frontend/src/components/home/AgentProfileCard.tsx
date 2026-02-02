'use client';

import { useMemo } from 'react';
import { Avatar, Tooltip } from "@nextui-org/react";
import { Trophy, Target, TrendingUp, Flame, Snowflake, Zap, Shield, Swords, Star } from "lucide-react";

interface AgentProfileCardProps {
  agent: any;
}

// Generate battle history data (per round, not per day)
function generateBattleHistory(agent: any) {
  const totalBattles = 80; // Show last 80 battles (4 rows x 20 cols)
  const winRate = (agent.win_rate_num || 50) / 100;
  
  const data: Array<{ result: 'win' | 'loss'; round: number }> = [];
  
  for (let i = 0; i < totalBattles; i++) {
    const roundNum = totalBattles - i;
    const isWin = Math.random() < winRate;
    data.push({ 
      result: isWin ? 'win' : 'loss', 
      round: roundNum 
    });
  }
  
  return data;
}

// Get rarity based on rank
function getRarity(rank: number): { name: string; color: string; glow: string; border: string } {
  if (rank === 1) return { name: 'LEGENDARY', color: 'text-[#FFD700]', glow: 'shadow-[0_0_30px_rgba(255,215,0,0.4)]', border: 'border-[#FFD700]/50' };
  if (rank === 2) return { name: 'EPIC', color: 'text-[#C0C0C0]', glow: 'shadow-[0_0_25px_rgba(192,192,192,0.3)]', border: 'border-[#C0C0C0]/40' };
  if (rank === 3) return { name: 'RARE', color: 'text-[#CD7F32]', glow: 'shadow-[0_0_20px_rgba(205,127,50,0.3)]', border: 'border-[#CD7F32]/30' };
  return { name: 'COMMON', color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]', border: 'border-purple-500/30' };
}

export default function AgentProfileCard({ agent }: AgentProfileCardProps) {
  const battleHistory = useMemo(() => {
    if (!agent) return [];
    return generateBattleHistory(agent);
  }, [agent]);

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 rounded-2xl border-2 border-zinc-800 bg-gradient-to-b from-zinc-900 via-black to-black">
        <Trophy size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Select an agent to view profile</p>
      </div>
    );
  }

  const rarity = getRarity(agent.rank || 999);
  const isPositivePnl = agent.pnl >= 0;
  const streak = agent.streak || 0;
  const powerLevel = Math.min(99, Math.max(1, Math.round((agent.win_rate_num || 50) * 1.5 + (agent.wins || 0) * 0.5)));
  
  // Battle stats from history
  const battleStats = battleHistory.reduce((acc, d) => {
    if (d.result === 'win') acc.wins++;
    else acc.losses++;
    return acc;
  }, { wins: 0, losses: 0 });

  return (
    <div className={`h-full flex flex-col relative overflow-hidden rounded-2xl ${rarity.border} border-2 ${rarity.glow}`}>
      {/* Background gradient based on rarity */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
      
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
          <h2 className="text-lg font-black text-white tracking-tight">{agent.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {agent.tags?.slice(0, 2).map((tag: string) => (
              <span 
                key={tag} 
                className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  tag === 'Whale' ? 'bg-purple-500/20 text-purple-300' :
                  tag === 'Degen' ? 'bg-pink-500/20 text-pink-300' :
                  tag === 'Rekt' ? 'bg-red-500/20 text-red-300' :
                  'bg-zinc-800 text-zinc-400'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[9px] text-zinc-500 font-mono">{agent.strategy}</p>
        </div>

        {/* Power Level */}
        <div className="flex items-center justify-center gap-2 my-3 py-2 bg-black/40 rounded-lg border border-white/5">
          <Zap size={16} className="text-[#20E696]" />
          <span className="text-2xl font-black text-white">{powerLevel}</span>
          <span className="text-[10px] text-zinc-500 uppercase">Power</span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Attack (Win Rate) */}
          <div className="flex items-center gap-2 p-2.5 bg-black/30 rounded-lg border border-white/5">
            <Swords size={14} className="text-[#FF4D4D]" />
            <div>
              <div className="text-sm font-bold text-white">{agent.win_rate}</div>
              <div className="text-[8px] text-zinc-500 uppercase">Win Rate</div>
            </div>
          </div>
          
          {/* Defense (ROI) */}
          <div className="flex items-center gap-2 p-2.5 bg-black/30 rounded-lg border border-white/5">
            <Shield size={14} className={isPositivePnl ? 'text-[#20E696]' : 'text-[#FF4D4D]'} />
            <div>
              <div className={`text-sm font-bold ${isPositivePnl ? 'text-[#20E696]' : 'text-[#FF4D4D]'}`}>
                {isPositivePnl ? '+' : ''}{agent.roi}%
              </div>
              <div className="text-[8px] text-zinc-500 uppercase">ROI</div>
            </div>
          </div>
          
          {/* Rounds */}
          <div className="flex items-center gap-2 p-2.5 bg-black/30 rounded-lg border border-white/5">
            <Target size={14} className="text-blue-400" />
            <div>
              <div className="text-sm font-bold text-white">{agent.wins + agent.losses}</div>
              <div className="text-[8px] text-zinc-500 uppercase">Battles</div>
            </div>
          </div>
          
          {/* Streak */}
          <div className="flex items-center gap-2 p-2.5 bg-black/30 rounded-lg border border-white/5">
            {streak >= 0 ? (
              <Flame size={14} className={streak > 0 ? 'text-orange-400' : 'text-zinc-600'} />
            ) : (
              <Snowflake size={14} className="text-cyan-400" />
            )}
            <div>
              <div className={`text-sm font-bold ${
                streak > 0 ? 'text-orange-400' : streak < 0 ? 'text-cyan-400' : 'text-zinc-500'
              }`}>
                {streak === 0 ? '-' : Math.abs(streak)}
              </div>
              <div className="text-[8px] text-zinc-500 uppercase">Streak</div>
            </div>
          </div>
        </div>

        {/* Battle History - 4 rows x 20 cols, per round */}
        <div className="bg-black/30 rounded-lg p-3 border border-white/5 mt-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">
              Last 80 Rounds
            </span>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="text-[#20E696] font-bold">{battleStats.wins}W</span>
              <span className="text-zinc-600">/</span>
              <span className="text-[#FF4D4D] font-bold">{battleStats.losses}L</span>
            </div>
          </div>

          {/* 4 rows x 20 cols grid */}
          <div className="grid gap-1 flex-1 content-center" style={{ gridTemplateColumns: 'repeat(20, 1fr)' }}>
            {battleHistory.map((battle, index) => (
              <Tooltip
                key={index}
                content={
                  <div className="text-xs p-1">
                    <div className="font-semibold">Round #{battle.round}</div>
                    <div className={battle.result === 'win' ? 'text-[#20E696]' : 'text-[#FF4D4D]'}>
                      {battle.result === 'win' ? 'Victory' : 'Defeat'}
                    </div>
                  </div>
                }
                classNames={{
                  base: "bg-zinc-900 border border-white/10",
                }}
              >
                <div 
                  className={`aspect-square rounded-[2px] cursor-pointer hover:scale-105 transition-transform ${
                    battle.result === 'win' ? 'bg-[#20E696]' : 'bg-[#FF4D4D]'
                  }`}
                />
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
