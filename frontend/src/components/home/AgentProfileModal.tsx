'use client';

import React, { useState, useMemo } from 'react';
import { Modal, ModalContent, ModalBody, Avatar } from "@nextui-org/react";
import { X, Trophy, Flame, Snowflake, Zap, GitCommit, GitBranch, Star, Activity, Medal, Shield, Award, Swords, Target } from "lucide-react";
import type { LeaderboardRow } from "@/hooks/useLeaderboard";
import { AgentTags } from "@/components/ui/AgentTag";
import { getAgentAchievements, type UnlockedAchievement } from "@/lib/achievements";

interface AgentProfileModalProps {
  agent: LeaderboardRow | null;
  isOpen: boolean;
  onClose: () => void;
}

// Get rarity based on rank
function getRarity(rank: number): { name: string; color: string; glow: string; border: string; bg: string } {
  if (rank === 1) return { 
    name: 'LEGENDARY', 
    color: 'text-[#FFD700]', 
    glow: 'shadow-[0_0_40px_rgba(255,215,0,0.4)]', 
    border: 'border-[#FFD700]/50',
    bg: 'from-[#FFD700]/20 to-transparent'
  };
  if (rank === 2) return { 
    name: 'EPIC', 
    color: 'text-[#C0C0C0]', 
    glow: 'shadow-[0_0_30px_rgba(192,192,192,0.3)]', 
    border: 'border-[#C0C0C0]/40',
    bg: 'from-[#C0C0C0]/20 to-transparent'
  };
  if (rank === 3) return { 
    name: 'RARE', 
    color: 'text-[#CD7F32]', 
    glow: 'shadow-[0_0_25px_rgba(205,127,50,0.3)]', 
    border: 'border-[#CD7F32]/30',
    bg: 'from-[#CD7F32]/20 to-transparent'
  };
  return { 
    name: 'COMMON', 
    color: 'text-purple-400', 
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]', 
    border: 'border-purple-500/30',
    bg: 'from-purple-500/20 to-transparent'
  };
}

// Achievement Card Component
function AchievementCard({ 
  achievement, 
  unlocked, 
  isBadge = false 
}: { 
  achievement: UnlockedAchievement; 
  unlocked: boolean;
  isBadge?: boolean;
}) {
  const Icon = achievement.icon;
  
  if (unlocked) {
    return (
      <div className={`p-4 rounded-lg border bg-[#161B22] flex items-start gap-4 hover:border-[#8B949E] transition-colors ${
        isBadge ? 'border-purple-500/30' : 'border-[#30363D]'
      }`}>
        <div className={`p-3 rounded-full bg-[#0D1117] border border-[#30363D] ${achievement.color}`}>
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-bold text-[#C9D1D9] ${achievement.color}`}>{achievement.title}</h4>
            {isBadge && (
              <span className="text-[9px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">BADGE</span>
            )}
          </div>
          <p className="text-sm text-[#8B949E] mt-1">{achievement.description}</p>
          {achievement.progress && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-[#8B949E] mb-1">
                <span>Progress</span>
                <span>{achievement.progress.current} / {achievement.progress.target}</span>
              </div>
              <div className="h-1.5 w-full bg-[#30363D] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full" 
                  style={{ width: `${Math.min(100, (achievement.progress.current / achievement.progress.target) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-[#30363D] bg-[#0D1117] flex items-start gap-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-80 transition-all">
      <div className="p-3 rounded-full bg-[#161B22] border border-[#30363D] text-[#8B949E]">
        <Icon size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-[#8B949E]">{achievement.title}</h4>
          {isBadge && (
            <span className="text-[9px] text-[#6E7681] bg-[#30363D] px-1.5 py-0.5 rounded">BADGE</span>
          )}
        </div>
        <p className="text-sm text-[#8B949E] mt-1">{achievement.description}</p>
        {achievement.progress && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#8B949E] mb-1">
              <span>Progress</span>
              <span>{achievement.progress.current} / {achievement.progress.target}</span>
            </div>
            <div className="h-1.5 w-full bg-[#30363D] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#8B949E] rounded-full" 
                style={{ width: `${Math.min(100, (achievement.progress.current / achievement.progress.target) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentProfileModal({ agent, isOpen, onClose }: AgentProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'strategy' | 'achievements'>('overview');

  // Compute achievements using the unified system
  const achievementData = useMemo(() => {
    if (!agent) return null;
    return getAgentAchievements({
      rank: agent.rank,
      score: agent.score || 0,
      wins: agent.wins || 0,
      losses: agent.losses || 0,
      draws: agent.draws || 0,
      total_rounds: agent.total_rounds || 0,
      win_rate_num: agent.win_rate_num || 0,
      streak: agent.streak || 0,
      drawdown: agent.drawdown || 0,
      tags: agent.tags || [],
    });
  }, [agent]);

  if (!agent || !achievementData) return null;

  const rarity = getRarity(agent.rank);
  const totalRounds = agent.total_rounds || 0;
  const streak = agent.streak || 0;
  const score = agent.score || 0;
  const battleHistory = agent.battle_history || [];

  const { milestones, badges, unlockedCount } = achievementData;
  const unlockedMilestones = milestones.filter(a => a.unlocked);
  const lockedMilestones = milestones.filter(a => !a.unlocked);
  const unlockedBadges = badges.filter(a => a.unlocked);
  const lockedBadges = badges.filter(a => !a.unlocked);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        backdrop: "bg-black/80 backdrop-blur-sm",
        base: "bg-[#0B0C10] border border-white/10 shadow-2xl h-[90vh] md:h-[800px] max-h-[90vh]",
        body: "p-0 h-full overflow-hidden",
        closeButton: "hidden",
      }}
    >
      <ModalContent>
        <ModalBody>
          <div className="relative h-full flex flex-col md:flex-row bg-[#0D1117]">
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-3 right-3 z-50 p-1.5 rounded-md text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#30363D] transition-all"
            >
              <X size={18} />
            </button>

            {/* Left Sidebar (Profile Info) */}
            <div className="w-full md:w-[320px] shrink-0 border-r border-[#30363D] bg-[#0D1117] flex flex-col overflow-y-auto">
                <div className="p-6 md:p-8 flex flex-col gap-6">
                    {/* Avatar & Rank */}
                    <div className="relative w-fit mx-auto md:mx-0">
                        <Avatar 
                            src={agent.avatar} 
                            className="w-32 h-32 md:w-48 md:h-48 rounded-full ring-4 ring-[#30363D] bg-[#0D1117]"
                        />
                        <div className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shadow-lg z-20 border-2 border-[#0D1117] ${
                            agent.rank === 1 ? 'bg-[#FFD700] text-black' :
                            agent.rank === 2 ? 'bg-[#C0C0C0] text-black' :
                            agent.rank === 3 ? 'bg-[#CD7F32] text-white' :
                            'bg-purple-500 text-white'
                        }`}>
                            #{agent.rank}
                        </div>
                    </div>

                    {/* Name & Bio */}
                    <div>
                        <h1 className="text-2xl font-bold text-[#C9D1D9] leading-tight mb-2">{agent.name}</h1>
                        <div className="flex items-center gap-2 text-[#8B949E] text-lg mb-4">
                            <span className="font-light">AI Agent</span>
                            <span>•</span>
                            <span className={rarity.color}>{rarity.name}</span>
                        </div>
                        
                        {agent.tags && agent.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                <AgentTags tags={agent.tags} maxTags={10} size="sm" />
                            </div>
                        )}

                        {/* Follow Button - Coming Soon */}
                        <button 
                            disabled
                            className="w-full py-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#8B949E] font-medium text-sm cursor-not-allowed mb-6 flex items-center justify-center gap-2"
                        >
                            <span>Follow</span>
                            <span className="text-[10px] text-[#6E7681] bg-[#30363D] px-1.5 py-0.5 rounded">Soon</span>
                        </button>

                        {/* Stats List */}
                        <div className="flex flex-col gap-3 text-sm text-[#8B949E]">
                            <div className="flex items-center gap-2 hover:text-[#58A6FF] transition-colors cursor-default">
                                <Zap size={16} />
                                <span className="text-[#C9D1D9] font-bold">{score.toLocaleString()}</span> Score
                            </div>
                            <div className="flex items-center gap-2 hover:text-[#58A6FF] transition-colors cursor-default">
                                <Swords size={16} />
                                <span className="text-[#C9D1D9] font-bold">{agent.win_rate}</span> Win Rate
                            </div>
                            <div className="flex items-center gap-2 hover:text-[#58A6FF] transition-colors cursor-default">
                                <Target size={16} />
                                <span className="text-[#C9D1D9] font-bold">{totalRounds}</span> Battles
                            </div>
                            <div className="flex items-center gap-2 hover:text-[#58A6FF] transition-colors cursor-default">
                                {streak >= 0 ? <Flame size={16} /> : <Snowflake size={16} />}
                                <span className={`${streak > 0 ? 'text-orange-400' : streak < 0 ? 'text-cyan-400' : 'text-[#C9D1D9]'} font-bold`}>
                                    {streak === 0 ? '-' : (streak > 0 ? `+${streak}` : streak)}
                                </span> Streak
                            </div>
                            {agent.favorite_symbol && (
                                <div className="flex items-center gap-2 hover:text-[#58A6FF] transition-colors cursor-default mt-2 pt-4 border-t border-[#30363D]">
                                    <Star size={16} />
                                    Preferred: <span className="text-[#C9D1D9] font-mono bg-[#21262D] px-1.5 rounded text-xs border border-[#30363D]">{agent.favorite_symbol}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content (Feed/Activity) */}
            <div className="flex-1 bg-[#0D1117] flex flex-col min-w-0 overflow-hidden">
                {/* Tabs */}
                <div className="flex items-center gap-8 px-6 border-b border-[#30363D] sticky top-0 bg-[#0D1117] z-30 shrink-0 h-[60px]">
                    <button 
                      onClick={() => setActiveTab('overview')}
                      className={`h-full border-b-2 font-medium text-sm px-1 flex items-center gap-2 transition-colors ${
                        activeTab === 'overview' 
                          ? 'border-[#F78166] text-[#C9D1D9] font-semibold' 
                          : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
                      }`}
                    >
                        <Activity size={16} />
                        Overview
                    </button>
                    <button 
                      onClick={() => setActiveTab('strategy')}
                      className={`h-full border-b-2 font-medium text-sm px-1 flex items-center gap-2 transition-colors ${
                        activeTab === 'strategy' 
                          ? 'border-[#F78166] text-[#C9D1D9] font-semibold' 
                          : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
                      }`}
                    >
                        <GitBranch size={16} />
                        Strategy
                        <span className="text-[10px] text-[#6E7681] bg-[#30363D] px-1.5 py-0.5 rounded">Soon</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('achievements')}
                      className={`h-full border-b-2 font-medium text-sm px-1 flex items-center gap-2 transition-colors ${
                        activeTab === 'achievements' 
                          ? 'border-[#F78166] text-[#C9D1D9] font-semibold' 
                          : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
                      }`}
                    >
                        <Medal size={16} />
                        Achievements
                        {unlockedCount > 0 && (
                          <span className="bg-[#30363D] text-[#C9D1D9] text-[10px] px-1.5 rounded-full">
                            {unlockedCount}
                          </span>
                        )}
                    </button>
                </div>

                {/* Main Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-8">
                        
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                          <>
                            {/* Battle History (Contribution Graph Style) */}
                            <div className="border border-[#30363D] rounded-md bg-[#0D1117] p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-[#C9D1D9]">Battle History</h3>
                                    <div className="text-xs text-[#8B949E]">
                                        Last 80 rounds
                                    </div>
                                </div>
                                <div className="overflow-x-auto pb-2">
                                    <div className="grid gap-1 min-w-[600px]" style={{ gridTemplateColumns: 'repeat(40, 1fr)' }}>
                                        {Array.from({ length: 80 }).map((_, index) => {
                                            const battle = battleHistory[index];
                                            const hasResult = battle !== undefined;
                                            
                                            return (
                                            <div 
                                                key={index}
                                                className={`aspect-square rounded-[2px] ${
                                                !hasResult ? 'bg-[#161B22]' :
                                                battle === 'win' ? 'bg-[#238636]' : 
                                                battle === 'loss' ? 'bg-[#DA3633]' :
                                                'bg-[#D29922]'
                                                }`}
                                                title={battle === 'win' ? 'Victory' : battle === 'loss' ? 'Defeat' : 'Draw'}
                                            />
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-[#8B949E]">
                                    <span>Less</span>
                                    <div className="w-2.5 h-2.5 bg-[#161B22] rounded-[2px]"></div>
                                    <div className="w-2.5 h-2.5 bg-[#DA3633] rounded-[2px]"></div>
                                    <div className="w-2.5 h-2.5 bg-[#D29922] rounded-[2px]"></div>
                                    <div className="w-2.5 h-2.5 bg-[#238636] rounded-[2px]"></div>
                                    <span>More</span>
                                </div>
                            </div>

                            {/* Recent Activity Feed */}
                            <div>
                                <h3 className="text-sm font-semibold text-[#C9D1D9] mb-4">Contribution Activity</h3>
                                <div className="relative pl-8 border-l-2 border-[#30363D] space-y-8 pb-8">
                                    {battleHistory.slice(0, 10).map((result, i) => (
                                        <div key={i} className="relative">
                                            <div className={`absolute -left-[41px] w-6 h-6 rounded-full border-4 border-[#0D1117] flex items-center justify-center ${
                                                result === 'win' ? 'bg-[#238636]' : 
                                                result === 'loss' ? 'bg-[#DA3633]' : 
                                                'bg-[#D29922]'
                                            }`}>
                                                {result === 'win' ? <Trophy size={10} className="text-white" /> :
                                                 result === 'loss' ? <X size={10} className="text-white" /> :
                                                 <GitCommit size={10} className="text-white" />}
                                            </div>
                                            
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-[#C9D1D9] text-sm">
                                                    <span className="font-semibold capitalize">{result}</span>
                                                    <span className="text-[#8B949E]">in Round #{2000 - i}</span>
                                                </div>
                                                <div className="text-xs text-[#8B949E] flex items-center gap-2">
                                                    <span>{i * 15 + 5} minutes ago</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{agent.favorite_symbol || 'BTCUSDT'}</span>
                                                </div>
                                                <div className={`mt-2 p-3 rounded-md border border-[#30363D] bg-[#161B22] text-sm text-[#8B949E] ${
                                                    result === 'win' ? 'border-l-2 border-l-[#238636]' :
                                                    result === 'loss' ? 'border-l-2 border-l-[#DA3633]' :
                                                    'border-l-2 border-l-[#D29922]'
                                                }`}>
                                                    {result === 'win' ? 'Executed a successful strategy with high profit factor.' :
                                                     result === 'loss' ? 'Stop loss triggered due to market volatility.' :
                                                     'Market consolidated, position closed at breakeven.'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="relative">
                                        <div className="absolute -left-[41px] w-6 h-6 rounded-full bg-[#30363D] border-4 border-[#0D1117]" />
                                        <div className="text-sm text-[#8B949E] italic">
                                            Agent deployed to mainnet
                                        </div>
                                    </div>
                                </div>
                            </div>
                          </>
                        )}

                        {/* STRATEGY TAB */}
                        {activeTab === 'strategy' && (
                          <div className="text-center py-20 text-[#8B949E]">
                            <GitBranch size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-semibold text-[#C9D1D9] mb-2">Strategy Analysis</h3>
                            <span className="inline-block text-xs text-[#6E7681] bg-[#30363D] px-2 py-1 rounded mb-4">Coming Soon</span>
                            <p className="max-w-md mx-auto">
                              Detailed breakdown of {agent.name}&apos;s trading strategy, indicators, and decision models.
                            </p>
                          </div>
                        )}

                        {/* ACHIEVEMENTS TAB */}
                        {activeTab === 'achievements' && (
                          <div className="space-y-10">
                            {/* ============== MILESTONES SECTION ============== */}
                            <div>
                              <div className="flex items-center gap-3 mb-6">
                                <Trophy size={20} className="text-yellow-500" />
                                <h2 className="text-lg font-bold text-[#C9D1D9]">Milestones</h2>
                                <span className="text-xs text-[#8B949E] bg-[#21262D] px-2 py-0.5 rounded">
                                  {unlockedMilestones.length} / {milestones.length}
                                </span>
                              </div>

                              {/* Unlocked Milestones */}
                              {unlockedMilestones.length > 0 && (
                                <div className="mb-6">
                                  <h3 className="text-xs font-semibold text-[#238636] mb-3 uppercase tracking-wider">Unlocked</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {unlockedMilestones.map(achievement => (
                                      <AchievementCard key={achievement.id} achievement={achievement} unlocked />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Locked Milestones */}
                              {lockedMilestones.length > 0 && (
                                <div>
                                  <h3 className="text-xs font-semibold text-[#8B949E] mb-3 uppercase tracking-wider">Locked</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {lockedMilestones.map(achievement => (
                                      <AchievementCard key={achievement.id} achievement={achievement} unlocked={false} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ============== BADGES SECTION ============== */}
                            <div>
                              <div className="flex items-center gap-3 mb-6">
                                <Award size={20} className="text-purple-500" />
                                <h2 className="text-lg font-bold text-[#C9D1D9]">Badges</h2>
                                <span className="text-xs text-[#8B949E] bg-[#21262D] px-2 py-0.5 rounded">
                                  {unlockedBadges.length} / {badges.length}
                                </span>
                                <span className="text-[10px] text-[#6E7681] bg-[#30363D] px-1.5 py-0.5 rounded ml-auto">
                                  Status-based
                                </span>
                              </div>

                              {/* Active Badges */}
                              {unlockedBadges.length > 0 && (
                                <div className="mb-6">
                                  <h3 className="text-xs font-semibold text-[#238636] mb-3 uppercase tracking-wider">Active</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {unlockedBadges.map(achievement => (
                                      <AchievementCard key={achievement.id} achievement={achievement} unlocked isBadge />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Inactive Badges */}
                              {lockedBadges.length > 0 && (
                                <div>
                                  <h3 className="text-xs font-semibold text-[#8B949E] mb-3 uppercase tracking-wider">Inactive</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {lockedBadges.map(achievement => (
                                      <AchievementCard key={achievement.id} achievement={achievement} unlocked={false} isBadge />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                    </div>
                </div>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
