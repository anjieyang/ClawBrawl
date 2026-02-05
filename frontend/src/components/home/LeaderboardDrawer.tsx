'use client';

import React, { useState, useMemo } from 'react';
import { Avatar } from "@nextui-org/react";
import { Trophy, Shield, Activity, Target, Zap, Copy, Eye, Check, User, Bell } from "lucide-react";
import type { LeaderboardRow } from "@/hooks/useLeaderboard";
import { AgentProfileModal } from "./AgentProfileModal";
import RadarChartSection from "./RadarChartSection";
import { AgentTags } from "@/components/ui/AgentTag";

interface LeaderboardDrawerProps {
  agent: LeaderboardRow | null;
  onClose: () => void;
  onGoToArena?: (symbol: string) => void;
}

// Get rarity based on rank
function getRarity(rank: number): { name: string; color: string; glow: string; border: string } {
  if (rank === 1) return { name: 'LEGENDARY', color: 'text-[#eab308]', glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]', border: 'border-[#eab308]/50' };
  if (rank === 2) return { name: 'EPIC', color: 'text-slate-300', glow: 'shadow-[0_0_25px_rgba(148,163,184,0.3)]', border: 'border-slate-400/40' };
  if (rank === 3) return { name: 'RARE', color: 'text-amber-600', glow: 'shadow-[0_0_20px_rgba(180,83,9,0.2)]', border: 'border-amber-700/30' };
  return { name: 'COMMON', color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]', border: 'border-purple-500/30' };
}

export function LeaderboardDrawer({ agent, onClose, onGoToArena }: LeaderboardDrawerProps) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Check if we're in skeleton/loading state
  const isLoading = !agent || agent.bot_id === 'skeleton';

  if (!agent) return null;

  const rarity = getRarity(agent.rank);
  const preferredSymbol = agent.favorite_symbol || 'BTCUSDT';

  // Handle "View Profile" click - opens modal
  const handleViewProfile = () => {
    setIsProfileModalOpen(true);
  };

  // Handle "Back this Agent" click
  const handleBackAgent = () => {
    if (onGoToArena) {
      onGoToArena(preferredSymbol);
    } else {
      // Fallback: Direct DOM scroll to arena section
      const arenaSection = document.getElementById('section-arena');
      if (arenaSection) {
        arenaSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Handle Copy ID
  const handleCopyId = () => {
    navigator.clipboard.writeText(agent.bot_id);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  };

  // Memoize radar data to avoid recalculation
  const radarData = useMemo(() => [
    { subject: 'Win Rate', A: agent.win_rate_num, fullMark: 100 },
    { subject: 'Survival', A: 100 - Math.abs(agent.drawdown), fullMark: 100 },
    { subject: 'Activity', A: Math.min(agent.total_rounds, 100), fullMark: 100 },
    { subject: 'Streak', A: Math.min(Math.abs(agent.streak) * 10, 100), fullMark: 100 },
    { subject: 'Score', A: Math.min(Math.max(agent.score, 0) / 10, 100), fullMark: 100 },
  ], [agent.win_rate_num, agent.drawdown, agent.total_rounds, agent.streak, agent.score]);

  return (
    <div className={`h-full flex flex-col bg-[#0B0C10] border-l border-white/10 w-full relative overflow-hidden ${isLoading ? 'animate-pulse' : ''}`}>
      {/* Background Glow */}
      <div className={`absolute top-0 left-0 right-0 h-[200px] bg-gradient-to-b ${
          agent.rank === 1 ? 'from-yellow-900/20' : 
          agent.rank === 2 ? 'from-slate-800/20' : 
          agent.rank === 3 ? 'from-amber-900/20' : 
          'from-purple-900/10'
      } to-transparent pointer-events-none`} />

      {/* Header */}
      <div className="p-6 border-b border-white/5 relative z-10">
        <div className="flex justify-between items-start mb-4">
            <div className={`text-[10px] font-black tracking-widest ${rarity.color} border border-current px-2 py-0.5 rounded`}>
                {rarity.name}
            </div>
            <div className="flex items-center gap-2 text-white/50 text-xs font-mono relative">
                <span>ID: {agent.bot_id.substring(0, 8)}</span>
                <button onClick={handleCopyId} className="hover:text-white transition-colors">
                  {showCopiedToast ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                </button>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className={`relative rounded-full p-0.5 ${rarity.border} border-2 ${rarity.glow}`}>
                <Avatar src={agent.avatar} className="w-20 h-20" />
                <div className="absolute -bottom-2 -right-2 bg-black text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border border-white/20">
                    #{agent.rank}
                </div>
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold text-white leading-tight truncate max-w-[180px]">{agent.name}</h2>
                {agent.tags && agent.tags.length > 0 && (
                  <AgentTags tags={agent.tags} maxTags={3} size="sm" className="mt-2" />
                )}
            </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
        
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 text-white/50 text-[10px] mb-1 uppercase tracking-wider">
                    <Trophy size={12} /> Score
                </div>
                <div className="text-xl font-bold text-white font-mono">{agent.score.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 text-white/50 text-[10px] mb-1 uppercase tracking-wider">
                    <Target size={12} /> Win Rate
                </div>
                <div className={`text-xl font-bold font-mono ${agent.win_rate_num > 50 ? 'text-green-400' : 'text-white'}`}>
                    {agent.win_rate}
                </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 text-white/50 text-[10px] mb-1 uppercase tracking-wider">
                    <Shield size={12} /> Max DD
                </div>
                <div className="text-xl font-bold text-red-400 font-mono">{agent.drawdown}%</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 text-white/50 text-[10px] mb-1 uppercase tracking-wider">
                    <Zap size={12} /> Streak
                </div>
                <div className={`text-xl font-bold font-mono ${agent.streak > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                    {agent.streak > 0 ? `+${agent.streak}` : agent.streak}
                </div>
            </div>
        </div>

        {/* Radar Chart - Lazy loaded */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5">
                <Activity size={80} />
            </div>
            <h3 className="text-xs font-bold text-white/80 mb-2 uppercase tracking-wider">Attribute Analysis</h3>
            <div className="h-[180px] w-full -ml-4">
                <RadarChartSection data={radarData} agentName={agent.name} />
            </div>
        </div>

      </div>

      {/* Footer Action - keep in normal flow to avoid scroll repaint issues */}
      <div className="shrink-0 p-4 border-t border-white/10 bg-[#0B0C10]/95">
        <div className="flex gap-2 mb-2">
          {/* Follow Button - Coming Soon */}
          <button
            disabled
            className="flex-1 h-10 rounded-xl border border-white/10 text-white/30 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed bg-white/5"
            title="Coming Soon"
          >
            <Bell size={16} />
            <span className="flex flex-col items-start leading-tight">
              <span>Follow</span>
              <span className="text-[8px] text-white/20 font-normal">Coming Soon</span>
            </span>
          </button>
          
          {/* Watch in Arena Button - Coming Soon */}
          <button
            disabled
            className="flex-1 h-10 rounded-xl border border-white/10 text-white/30 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed bg-white/5"
            title="Coming Soon"
          >
            <Eye size={16} />
            <span className="flex flex-col items-start leading-tight">
              <span>Watch</span>
              <span className="text-[8px] text-white/20 font-normal">Coming Soon</span>
            </span>
          </button>
        </div>
        
        {/* Primary CTA - View Profile */}
        <button 
          onClick={handleViewProfile}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all flex items-center justify-center gap-2"
        >
          <User size={18} />
          View Full Profile
        </button>
        
        {/* Hint Text */}
        <p className="text-[10px] text-white/30 text-center mt-2">
          See detailed stats and history for {agent.name}
        </p>
      </div>

      {/* Profile Modal */}
      <AgentProfileModal 
        agent={agent}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
