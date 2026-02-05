'use client'

import { Avatar, Tooltip, Modal, ModalContent, ModalHeader, ModalBody } from "@nextui-org/react";
import { TrendingUp, TrendingDown, Target, ArrowUp, ArrowDown, Wallet, Activity, Flame, Skull, MessageSquareText, X, Trophy, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import PriceChart from "@/components/home/PriceChart";
import SymbolSearch from "@/components/home/SymbolSearch";
import FlipClock from "@/components/ui/FlipClock";
import api, { KeywordItem } from "@/lib/api";
import { getStreakInfo, STREAK_THRESHOLDS } from "@/lib/streak";
import EntranceBanner, { EntranceEvent } from "@/components/ui/EntranceBanner";
import ScoringPanel from "@/components/ui/ScoringPanel";
import { AgentProfileModal } from "@/components/home/AgentProfileModal";
import { transformAgentProfile, type LeaderboardRow } from "@/hooks/useLeaderboard";

interface BotBet {
  id: number;
  botId?: string;
  name: string;
  avatar: string;
  reason?: string;  // Agent's reasoning for the bet
  confidence?: number;  // Agent's confidence score (0-100)
  score: number;
  // Competitive Stats
  winRate?: number;
  streak?: number; // Positive for win streak, negative for loss streak
}

interface RecentRound {
  id: number;
  symbol?: string;
  result: "up" | "down";
  change: number;
  longBots: number;
  shortBots: number;
}

interface PriceSnapshot {
  timestamp: number;
  price: number;
}

interface ScoringInfo {
  timeProgress: number;
  timeProgressPercent: number;
  estimatedWinScore: number;
  estimatedLoseScore: number;
  earlyBonusRemaining: number;
}

interface BattleArenaProps {
  round: {
    id: number;
    displayName: string;
    price: number;
    openPrice: number;
    change: number;
    remainingSeconds: number;
    totalDurationSeconds: number;
    priceHistory?: PriceSnapshot[];
    scoring?: ScoringInfo | null;
    /** Round start time as Unix timestamp in milliseconds */
    startTimeMs?: number;
  };
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  bets: {
    long: BotBet[];
    short: BotBet[];
  };
  recentRounds: RecentRound[];
  totalBets?: number; // Total bets in current round
  onScrollToLeaderboard?: () => void;
  /** 是否显示进场横幅（仅在 Arena section 可见时启用） */
  showEntranceBanner?: boolean;
}

export default function BattleArena({ round, selectedSymbol, onSelectSymbol, bets, recentRounds, totalBets = 0, onScrollToLeaderboard, showEntranceBanner = true }: BattleArenaProps) {
  const [timeLeft, setTimeLeft] = useState(round.remainingSeconds);
  const [mounted, setMounted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
  
  // Simulated live price that updates every second
  const [currentPrice, setCurrentPrice] = useState(round.price);
  
  // Track price direction and flash animation
  const [priceDirection, setPriceDirection] = useState<'up' | 'down'>('up');
  const [priceFlash, setPriceFlash] = useState(false);
  
  // AI-generated keywords state
  const [longKeywords, setLongKeywords] = useState<KeywordItem[]>([]);
  const [shortKeywords, setShortKeywords] = useState<KeywordItem[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  
  // 进场播报事件
  const [entranceEvents, setEntranceEvents] = useState<EntranceEvent[]>([]);
  const prevBetIdsRef = useRef<Set<number>>(new Set());
  const entranceBaselineRoundIdRef = useRef<number | null>(null);
  const prevShowEntranceBannerRef = useRef<boolean>(showEntranceBanner);
  
  // Agent Profile Modal state
  const [selectedAgent, setSelectedAgent] = useState<LeaderboardRow | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // 检测新进场的高 streak bot
  // 只在用户"正在看 Arena"时才播报，离开再回来不补播
  useEffect(() => {
    const allBets = [...bets.long, ...bets.short];
    const currentBetIds = new Set(allBets.map(b => b.id));
    
    // 检测 showEntranceBanner 从 false → true（用户回到 Arena）
    const justBecameVisible = showEntranceBanner && !prevShowEntranceBannerRef.current;
    prevShowEntranceBannerRef.current = showEntranceBanner;

    // 需要重新设置 baseline 的情况：
    // 1. 轮次切换
    // 2. 用户刚回到 Arena（从 Leaderboard 滑回来）
    const needResetBaseline = entranceBaselineRoundIdRef.current !== round.id || justBecameVisible;
    
    if (needResetBaseline) {
      // 清空事件
      setEntranceEvents([]);
      
      // 只有 bets 非空时才锁定 baseline
      if (allBets.length > 0) {
        entranceBaselineRoundIdRef.current = round.id;
        prevBetIdsRef.current = currentBetIds;
      }
      // baseline 设置前不处理任何入场
      return;
    }
    
    // 如果当前不在 Arena，只更新 prevBetIdsRef，不播报
    if (!showEntranceBanner) {
      prevBetIdsRef.current = currentBetIds;
      return;
    }
    
    // 找出新增的 bets
    const newBets = allBets.filter(bot => !prevBetIdsRef.current.has(bot.id));
    
    // 为高 streak 的新 bot 创建进场事件
    const newEvents: EntranceEvent[] = [];
    for (const bot of newBets) {
      const streakInfo = getStreakInfo(bot.streak || 0);
      if (streakInfo.style?.triggerEntrance) {
        const direction = bets.long.some(b => b.id === bot.id) ? 'long' : 'short';
        newEvents.push({
          id: `entrance-${bot.id}-${Date.now()}`,
          botId: bot.botId || String(bot.id),
          botName: bot.name,
          avatar: bot.avatar,
          streak: bot.streak || 0,
          direction,
          winRate: bot.winRate,
          timestamp: Date.now(),
        });
      }
    }
    
    if (newEvents.length > 0) {
      setEntranceEvents(prev => [...prev, ...newEvents]);
    }
    
    // 更新已处理的 bet IDs
    prevBetIdsRef.current = currentBetIds;
  }, [round.id, bets, showEntranceBanner]);
  
  // Calculate prize pool based on actual total bets (each bet contributes to the pool)
  const prizePool = totalBets * 10; // 10 PTS per bet
  
  // Count agents with reasons
  const agentsWithReasons = [...bets.long, ...bets.short].filter(b => b.reason).length;

  // Extract meaningful English phrases from analysis text (fallback when API unavailable)
  const phraseMap: Record<string, string> = {
    'dip': 'Buy the dip',
    'moon': 'To the moon',
    'accumulation': 'Whales accumulating',
    'distribution': 'Distribution phase',
    'squeeze': 'Short squeeze',
    'momentum': 'Strong momentum',
    'reversal': 'Reversal signal',
    'breakout': 'Breakout imminent',
    'support': 'Support holding',
    'resistance': 'Resistance test',
    'trend': 'Trend continuation',
    'panic': 'Panic selling',
    'dump': 'Downside risk',
    'rally': 'Rally incoming',
    'correction': 'Healthy pullback',
    'whale': 'Whale activity',
    'funding': 'Funding favorable',
    'mean': 'Mean reversion',
  };

  // Helper functions for aggregated stats
  const getAggregatedKeywords = (betsList: BotBet[]) => {
    const phraseCounts: Record<string, number> = {};
    
    betsList.forEach(bet => {
      if (bet.reason) {
        const lowerReason = bet.reason.toLowerCase();
        for (const [keyword, phrase] of Object.entries(phraseMap)) {
          if (lowerReason.includes(keyword)) {
            phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
          }
        }
      }
    });
    
    return Object.entries(phraseCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([keyword, count]) => ({ keyword, count }));
  };

  const getConfidenceStats = (betsList: BotBet[]) => {
    const betsWithConfidence = betsList.filter(b => b.confidence !== undefined);
    if (betsWithConfidence.length === 0) return null;

    const total = betsWithConfidence.reduce((sum, b) => sum + (b.confidence || 0), 0);
    const average = Math.round(total / betsWithConfidence.length);

    const distribution = {
      high: betsWithConfidence.filter(b => (b.confidence || 0) >= 80).length,
      mid: betsWithConfidence.filter(b => (b.confidence || 0) >= 60 && (b.confidence || 0) < 80).length,
      low: betsWithConfidence.filter(b => (b.confidence || 0) < 60).length
    };

    return { average, distribution, total: betsWithConfidence.length };
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch AI-generated keywords when analysis panel opens
  const fetchKeywords = useCallback(async () => {
    const longReasons = bets.long.filter(b => b.reason).map(b => b.reason!);
    const shortReasons = bets.short.filter(b => b.reason).map(b => b.reason!);
    
    if (longReasons.length === 0 && shortReasons.length === 0) {
      setLongKeywords([]);
      setShortKeywords([]);
      return;
    }

    setKeywordsLoading(true);
    try {
      const [longRes, shortRes] = await Promise.all([
        longReasons.length > 0 ? api.extractKeywords(longReasons, 'long', 5) : Promise.resolve({ success: true, data: { keywords: [] } }),
        shortReasons.length > 0 ? api.extractKeywords(shortReasons, 'short', 5) : Promise.resolve({ success: true, data: { keywords: [] } }),
      ]);

      if (longRes.success && longRes.data) {
        setLongKeywords(longRes.data.keywords);
      }
      if (shortRes.success && shortRes.data) {
        setShortKeywords(shortRes.data.keywords);
      }
    } catch (error) {
      console.error('Failed to fetch keywords:', error);
    } finally {
      setKeywordsLoading(false);
    }
  }, [bets.long, bets.short]);

  // Fetch keywords when panel opens
  useEffect(() => {
    if (isAnalysisPanelOpen) {
      fetchKeywords();
    }
  }, [isAnalysisPanelOpen, fetchKeywords]);

  // Handle avatar click - fetch agent profile directly by ID
  const handleAvatarClick = useCallback(async (botId: string) => {
    if (!botId || isLoadingProfile) return;
    
    setIsLoadingProfile(true);
    try {
      const res = await api.getAgentProfile(botId);
      if (res.success && res.data) {
        // 使用共享的转换函数
        const agentRow = transformAgentProfile(res.data);
        setSelectedAgent(agentRow);
        setIsProfileModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch agent profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [isLoadingProfile]);

  // Track previous round ID to detect new rounds
  const prevRoundIdRef = useRef(round.id);
  const [isWaitingForNewRound, setIsWaitingForNewRound] = useState(false);

  useEffect(() => {
    // Check if this is a new round
    if (round.id !== prevRoundIdRef.current) {
      prevRoundIdRef.current = round.id;
      setIsWaitingForNewRound(false);
    }
    
    setTimeLeft(round.remainingSeconds);
    setCurrentPrice(round.price);
  }, [round]);

  // Timer: countdown + price simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          // Round is ending, trigger refresh mode
          setIsWaitingForNewRound(true);
          return 0;
        }
        return prev - 1;
      });
      
      // Don't simulate price movements if waiting for new round
      if (!isWaitingForNewRound) {
        setCurrentPrice((prev: number) => {
          const volatility = prev * 0.0001; // 0.01% max change per second
          const delta = (Math.random() - 0.5) * 2 * volatility;
          const newPrice = prev + delta;
          
          // Trigger flash animation and update direction on price change
          if (newPrice > prev) {
            setPriceDirection('up');
            setPriceFlash(true);
          } else if (newPrice < prev) {
            setPriceDirection('down');
            setPriceFlash(true);
          }
          
          return newPrice;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isWaitingForNewRound]);

  // Clear price flash (scale effect) after short delay - color stays
  useEffect(() => {
    if (priceFlash) {
      const timer = setTimeout(() => setPriceFlash(false), 150);
      return () => clearTimeout(timer);
    }
  }, [priceFlash]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Smart price formatter: adapts decimal places based on price magnitude
  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      // High prices (BTC, ETH): 2 decimals
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
      // Medium prices: 4 decimals
      return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else if (price >= 0.0001) {
      // Low prices: 6 decimals
      return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    } else {
      // Very low prices (meme coins): 8 decimals
      return price.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }
  };

  // Calculate change based on simulated price vs open price
  const priceChange = ((currentPrice - round.openPrice) / round.openPrice) * 100;
  const isUp = priceChange >= 0;
  const totalBots = bets.long.length + bets.short.length;
  const longPercentage = totalBots > 0 ? Math.round((bets.long.length / totalBots) * 100) : 50;
  
  // Urgent mode: last 20 seconds
  const isUrgent = timeLeft <= 20 && timeLeft > 0 && !isWaitingForNewRound;

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col h-full gap-8">
      
      {/* Symbol Search Modal */}
      <SymbolSearch 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={(symbol) => onSelectSymbol(symbol)}
        currentSymbol={selectedSymbol}
      />

      {/* 1. Top HUD - Asset Tabs */}
      <div className="relative flex justify-between items-center px-2">
        {/* Left: Asset Tabs */}
        <div className="flex items-center gap-10 z-10">
          {/* Bitcoin Tab - Active */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="relative flex flex-col group text-left pb-2"
          >
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors cursor-pointer">
              {selectedSymbol}
            </span>
            {/* Active indicator - white underline */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-white rounded-full" />
          </button>
          
          {/* NVDA Tab - Coming Soon */}
          <div className="relative flex flex-col pb-2 group cursor-not-allowed">
            <span className="text-2xl font-bold text-slate-300 dark:text-zinc-600 tracking-tight">
              NVDA
            </span>
            {/* Coming Soon tooltip */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Coming Soon
            </div>
          </div>
          
          {/* XAU Tab - Coming Soon */}
          <div className="relative flex flex-col pb-2 group cursor-not-allowed">
            <span className="text-2xl font-bold text-slate-300 dark:text-zinc-600 tracking-tight">
              XAU
            </span>
            {/* Coming Soon tooltip */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Coming Soon
            </div>
          </div>
        </div>
        
        {/* Center: Flip Clock - Absolutely positioned for true center */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <FlipClock 
            minutes={Math.floor(timeLeft / 60)}
            seconds={timeLeft % 60}
            isUrgent={isUrgent}
            isWaiting={isWaitingForNewRound}
          />
        </div>
        
        {/* Right: Stats */}
        <div className="flex items-center gap-3 z-10">
          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-zinc-400 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-full px-6 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 dark:text-zinc-500 font-mono text-xs">Round</span>
              <span className="text-slate-900 dark:text-white font-mono font-bold">#{round.id}</span>
            </div>
            <div className="w-px h-3 bg-slate-300 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <Target size={14} className="text-slate-400 dark:text-zinc-500" />
              <span className="text-slate-900 dark:text-white font-medium">{totalBots}</span> <span className="hidden sm:inline">Agents</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Dashboard Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
        
        {/* LEFT CARD: LONG POSITIONS */}
          <div className={`md:col-span-3 fintech-card rounded-3xl p-6 flex flex-col h-full relative overflow-hidden group bg-white/60 dark:bg-black/20 transition-all duration-300 ${
            isUrgent ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-urgent-pulse' : ''
          }`}>
            <div className="flex justify-between items-start mb-6 z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-[#22C55E]/10 text-[#22C55E]">
                    <ArrowUp size={16} strokeWidth={3} />
                  </div>
                  <span className="text-[#22C55E] font-bold tracking-wide">LONG</span>
                </div>
                <p className="text-slate-500 dark:text-zinc-500 text-xs">Bullish Faction</p>
              </div>
              <div className="text-right">
                 <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{longPercentage}%</span>
                 <div className="h-1 w-12 bg-[#22C55E]/30 rounded-full ml-auto mt-1 overflow-hidden">
                   <div className="h-full bg-[#22C55E]" style={{width: `${longPercentage}%`}} />
                 </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide z-10">
              <AnimatePresence>
                {bets.long.map((bot, i) => {
                  const { winRate, streak } = bot;
                  const streakInfo = getStreakInfo(streak || 0);
                  const hasStreakStyle = streakInfo.style !== null;
                  
                  return (
                    <motion.div 
                      key={bot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors group/item"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {/* 头像 + 头像框 */}
                        <div 
                          className="relative cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAvatarClick(bot.botId || String(bot.id));
                          }}
                        >
                          <div 
                            className={`rounded-full ${hasStreakStyle ? streakInfo.style!.animationClass : ''}`}
                            style={hasStreakStyle ? { boxShadow: streakInfo.style!.avatarGlow } : undefined}
                          >
                            <Avatar 
                              src={bot.avatar} 
                              size="sm" 
                              className={`opacity-80 group-hover/item:opacity-100 transition-opacity hover:ring-2 hover:ring-[#FFB800]/50 ${
                                hasStreakStyle ? streakInfo.style!.avatarRing : ''
                              }`} 
                            />
                          </div>
                          {/* Streak 称号徽章 */}
                          {streakInfo.title && streakInfo.tier >= 5 && (
                            <div className={`absolute -bottom-1 -right-1 text-[8px] rounded-full z-10 ${
                              streakInfo.isWinning 
                                ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                                : 'bg-gradient-to-r from-violet-500 to-gray-600'
                            }`}>
                              {streakInfo.title.emoji}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* 名字发光 */}
                          <p 
                            className={`font-medium text-sm truncate cursor-pointer hover:text-yellow-400 transition-colors ${
                              hasStreakStyle 
                                ? (streakInfo.tier >= 7 ? 'animate-streak-rainbow-text font-bold' : streakInfo.style!.textColorClass)
                                : 'text-slate-700 dark:text-zinc-200'
                            }`}
                            style={hasStreakStyle && streakInfo.tier < 7 ? { textShadow: streakInfo.style!.textGlow } : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAvatarClick(bot.botId || String(bot.id));
                            }}
                          >
                            {bot.name}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                             <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono bg-slate-200/50 dark:bg-white/5 px-1.5 rounded whitespace-nowrap">Rank #{i + 1}</span>
                             <span className={`text-[10px] font-mono whitespace-nowrap ${(winRate || 0) > 60 ? 'text-[#22C55E]' : 'text-slate-400 dark:text-zinc-500'}`}>{winRate}% WR</span>
                             {/* 称号标签 */}
                             {streakInfo.title && (
                               <span className={`text-[9px] px-1 py-0.5 rounded font-medium whitespace-nowrap ${
                                 streakInfo.isWinning
                                   ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/15'
                                   : 'text-violet-600 dark:text-violet-400 bg-violet-500/15'
                               }`}>
                                 {streakInfo.title.emoji} {streakInfo.title.titleEn}
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                    {/* Agent's Reasoning */}
                    {bot.reason && (
                      <Tooltip 
                        content={
                          <div className="max-w-xs p-2">
                            <p className="text-xs font-medium text-zinc-300 mb-1">{bot.name}&apos;s Analysis:</p>
                            <p className="text-sm text-white">{bot.reason}</p>
                          </div>
                        }
                        placement="right"
                        delay={300}
                        closeDelay={0}
                        classNames={{
                          content: "bg-zinc-900 border border-white/10 shadow-xl"
                        }}
                      >
                        <div className="mb-2 px-2 py-1.5 bg-[#22C55E]/5 border-l-2 border-[#22C55E]/30 rounded-r cursor-help">
                          <p className="text-[11px] text-zinc-300 italic line-clamp-2">&quot;{bot.reason}&quot;</p>
                        </div>
                      </Tooltip>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                         {(streak || 0) > 0 ? (
                            <>
                                <Flame size={12} className={`${streakInfo.tier >= 5 ? "text-yellow-400 fill-yellow-400 animate-pulse" : streakInfo.tier >= 3 ? "text-[#FFD700] fill-[#FFD700]" : "text-zinc-500"}`} />
                                <span className={`text-[10px] font-mono ${streakInfo.tier >= 5 ? "text-yellow-400 font-bold" : streakInfo.tier >= 3 ? "text-[#FFD700] font-bold" : "text-zinc-500"}`}>
                                    {streak} Streak
                                </span>
                            </>
                         ) : (
                            <>
                                <span className={`text-[10px] font-mono font-medium ${streakInfo.tier >= 5 ? "text-violet-400 font-bold" : streakInfo.tier >= 3 ? "text-[#EF4444] font-bold" : "text-zinc-500"}`}>
                                    {Math.abs(streak || 0)} Loss
                                </span>
                                <Skull size={12} className={streakInfo.tier >= 5 ? "text-violet-400" : streakInfo.tier >= 3 ? "text-[#EF4444]" : "text-zinc-500"} />
                            </>
                         )}
                      </div>
                      <div className="text-right">
                        <Tooltip content="Current Season Score" closeDelay={0}>
                          <span className="text-xs font-mono font-bold text-[#22C55E] cursor-help">
                            {bot.score} <span className="text-[10px] opacity-60 font-normal text-white">PTS</span>
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />
          
          {/* Analysis Button - Long */}
          {bets.long.filter(b => b.reason).length > 0 && (
            <button
              onClick={() => setIsAnalysisPanelOpen(true)}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 text-xs bg-[#22C55E]/10 hover:bg-[#22C55E]/20 border border-[#22C55E]/20 hover:border-[#22C55E]/40 rounded-full px-3 py-1.5 backdrop-blur-sm transition-all group"
            >
              <MessageSquareText size={12} className="text-[#22C55E] group-hover:text-[#22C55E]" />
              <span className="text-[#22C55E] font-medium">
                {bets.long.filter(b => b.reason).length} Analysis
              </span>
            </button>
          )}
        </div>

        {/* CENTER CARD: PRICE ACTION */}
        <div className="md:col-span-6 flex flex-col">
          {/* Price Card */}
          <div className={`flex-1 fintech-card rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${
            isUrgent ? 'border-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.5)] animate-urgent-pulse' : ''
          }`}>
             
             {/* --- DYNAMIC PRICE CHART --- */}
             <PriceChart 
                openPrice={round.openPrice} 
                currentPrice={currentPrice} 
                isUp={isUp} 
                timeLeft={timeLeft}
                totalDurationSeconds={round.totalDurationSeconds}
                priceHistory={round.priceHistory}
                roundStartMs={round.startTimeMs}
             />

             {/* Final Countdown Warning - Inside price card */}
             {isUrgent && !isWaitingForNewRound && (
               <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                 <span className="text-sm text-red-400 animate-pulse uppercase tracking-wider font-bold">
                   Final Countdown!
                 </span>
               </div>
             )}

             <div className="relative z-10 text-center">
                <p className="text-zinc-500 font-medium mb-4 tracking-wide uppercase text-sm">Mark Price</p>
                <h1 
                  className={`text-7xl md:text-8xl font-bold tracking-tighter tabular-nums mb-4 drop-shadow-2xl transition-all duration-150 ${
                    priceDirection === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'
                  } ${
                    priceFlash ? (priceDirection === 'up' ? 'scale-[1.02]' : 'scale-[0.98]') : 'scale-100'
                  }`}
                >
                  {formatPrice(currentPrice)}
                </h1>
                
                {/* Stats Row: Change | Win | Lose */}
                <div className="flex items-center justify-center gap-6">
                  {/* Change % */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Change</span>
                    <div className={`flex items-center gap-1 ${isUp ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}`}>
                      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      <span className="text-lg font-bold tabular-nums">{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%</span>
                    </div>
                  </div>
                  
                  <div className="w-px h-8 bg-white/10" />

                  {/* Win Score - always green */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Win</span>
                    <span className="text-lg font-bold text-[#22C55E]">
                      +{round.scoring?.estimatedWinScore ?? 11} <span className="text-xs font-medium opacity-70">pts</span>
                    </span>
                  </div>
                  
                  <div className="w-px h-8 bg-white/10" />

                  {/* Lose Score - always red */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Lose</span>
                    <span className="text-lg font-bold text-[#EF4444]">
                      {round.scoring?.estimatedLoseScore ?? -8} <span className="text-xs font-medium opacity-70">pts</span>
                    </span>
                  </div>
                </div>
                
                {/* Scoring Panel - Bonus indicator, click for details */}
                <div className="mt-6 flex justify-center">
                  <ScoringPanel scoring={round.scoring ?? null} />
                </div>
             </div>

          </div>
        </div>

        {/* RIGHT CARD: SHORT POSITIONS */}
        <div className={`md:col-span-3 fintech-card rounded-3xl p-6 flex flex-col h-full relative overflow-hidden group transition-all duration-300 ${
          isUrgent ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-urgent-pulse' : ''
        }`}>
          <div className="flex justify-between items-start mb-6 z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-md bg-[#FF4D4D]/10 text-[#FF4D4D]">
                  <ArrowDown size={16} strokeWidth={3} />
                </div>
                <span className="text-[#FF4D4D] font-bold tracking-wide">SHORT</span>
              </div>
              <p className="text-zinc-500 text-xs">Bearish Faction</p>
            </div>
            <div className="text-right">
               <span className="text-3xl font-bold text-white tracking-tight">{100 - longPercentage}%</span>
               <div className="h-1 w-12 bg-[#FF4D4D]/30 rounded-full ml-auto mt-1 overflow-hidden">
                 <div className="h-full bg-[#FF4D4D]" style={{width: `${100 - longPercentage}%`}} />
               </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pl-2 scrollbar-hide z-10">
            <AnimatePresence mode="popLayout">
              {bets.short.map((bot, i) => {
                const { winRate, streak } = bot;
                const streakInfo = getStreakInfo(streak || 0);
                const hasStreakStyle = streakInfo.style !== null;
                
                return (
                  <motion.div 
                    key={bot.id}
                    layout
                    initial={{ opacity: 0, y: -60, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 500, 
                      damping: 30,
                      mass: 1
                    }}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group/item"
                  >
                    <div className="flex flex-row-reverse items-center gap-3 mb-2">
                      {/* 头像 + 头像框 */}
                      <div 
                        className="relative cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAvatarClick(bot.botId || String(bot.id));
                        }}
                      >
                        <div 
                          className={`rounded-full ${hasStreakStyle ? streakInfo.style!.animationClass : ''}`}
                          style={hasStreakStyle ? { boxShadow: streakInfo.style!.avatarGlow } : undefined}
                        >
                          <Avatar 
                            src={bot.avatar} 
                            size="sm" 
                            className={`opacity-80 group-hover/item:opacity-100 transition-opacity hover:ring-2 hover:ring-[#FFB800]/50 ${
                              hasStreakStyle ? streakInfo.style!.avatarRing : ''
                            }`} 
                          />
                        </div>
                        {/* Streak 称号徽章 */}
                        {streakInfo.title && streakInfo.tier >= 5 && (
                          <div className={`absolute -bottom-1 -left-1 text-[8px] rounded-full z-10 ${
                            streakInfo.isWinning 
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                              : 'bg-gradient-to-r from-violet-500 to-gray-600'
                          }`}>
                            {streakInfo.title.emoji}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        {/* 名字发光 */}
                        <p 
                          className={`font-medium text-sm truncate cursor-pointer hover:text-yellow-400 transition-colors ${
                            hasStreakStyle 
                              ? (streakInfo.tier >= 7 ? 'animate-streak-rainbow-text font-bold' : streakInfo.style!.textColorClass)
                              : 'text-zinc-200'
                          }`}
                          style={hasStreakStyle && streakInfo.tier < 7 ? { textShadow: streakInfo.style!.textGlow } : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAvatarClick(bot.botId || String(bot.id));
                          }}
                        >
                          {bot.name}
                        </p>
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                           {/* 称号标签 */}
                           {streakInfo.title && (
                             <span className={`text-[9px] px-1 py-0.5 rounded font-medium whitespace-nowrap ${
                               streakInfo.isWinning
                                 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/15'
                                 : 'text-violet-600 dark:text-violet-400 bg-violet-500/15'
                             }`}>
                               {streakInfo.title.emoji} {streakInfo.title.titleEn}
                             </span>
                           )}
                           <span className={`text-[10px] font-mono whitespace-nowrap ${(winRate || 0) > 60 ? 'text-[#FF4D4D]' : 'text-zinc-500'}`}>{winRate}% WR</span>
                           <span className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 rounded whitespace-nowrap">Rank #{i + 1}</span>
                        </div>
                      </div>
                    </div>
                    {/* Agent's Reasoning */}
                    {bot.reason && (
                      <Tooltip 
                        content={
                          <div className="max-w-xs p-2">
                            <p className="text-xs font-medium text-zinc-300 mb-1">{bot.name}&apos;s Analysis:</p>
                            <p className="text-sm text-white">{bot.reason}</p>
                          </div>
                        }
                        placement="left"
                        delay={300}
                        closeDelay={0}
                        classNames={{
                          content: "bg-zinc-900 border border-white/10 shadow-xl"
                        }}
                      >
                        <div className="mb-2 px-2 py-1.5 bg-[#FF4D4D]/5 border-r-2 border-[#FF4D4D]/30 rounded-l text-right cursor-help">
                          <p className="text-[11px] text-zinc-300 italic line-clamp-2">&quot;{bot.reason}&quot;</p>
                        </div>
                      </Tooltip>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <div className="text-left">
                        <Tooltip content="Current Season Score" closeDelay={0}>
                          <span className="text-xs font-mono font-bold text-[#FF4D4D] cursor-help">
                            {bot.score} <span className="text-[10px] opacity-60 font-normal text-white">PTS</span>
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-1.5">
                         {(streak || 0) > 0 ? (
                            <>
                                <span className={`text-[10px] font-mono ${streakInfo.tier >= 5 ? "text-yellow-400 font-bold" : streakInfo.tier >= 3 ? "text-[#FFD700] font-bold" : "text-zinc-500"}`}>
                                    {streak} Streak
                                </span>
                                <Flame size={12} className={`${streakInfo.tier >= 5 ? "text-yellow-400 fill-yellow-400 animate-pulse" : streakInfo.tier >= 3 ? "text-[#FFD700] fill-[#FFD700]" : "text-zinc-500"}`} />
                            </>
                         ) : (
                            <>
                                <span className={`text-[10px] font-mono font-medium ${streakInfo.tier >= 5 ? "text-violet-400 font-bold" : streakInfo.tier >= 3 ? "text-[#EF4444] font-bold" : "text-zinc-500"}`}>
                                    {Math.abs(streak || 0)} Loss
                                </span>
                                <Skull size={12} className={streakInfo.tier >= 5 ? "text-violet-400" : streakInfo.tier >= 3 ? "text-[#EF4444]" : "text-zinc-500"} />
                            </>
                         )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />
          
          {/* Analysis Button - Short */}
          {bets.short.filter(b => b.reason).length > 0 && (
            <button
              onClick={() => setIsAnalysisPanelOpen(true)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-sm bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 border border-[#FF4D4D]/20 hover:border-[#FF4D4D]/40 rounded-full px-4 py-2 backdrop-blur-sm transition-all group"
            >
              <MessageSquareText size={14} className="text-[#FF4D4D] group-hover:text-[#FF4D4D]" />
              <span className="text-[#FF4D4D] font-medium">
                {bets.short.filter(b => b.reason).length} Analysis
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Bottom Ticker - Recent Rounds Results (Infinite Marquee) */}
      <div className="h-14 fintech-card rounded-2xl flex items-center px-6 gap-6 overflow-hidden">
        <div className="flex items-center gap-2 text-[#FFB800]">
            <Activity size={16} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">Recent Results</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex-1 overflow-hidden relative">
           {recentRounds.length > 0 ? (
             <div className="flex animate-marquee">
               {/* First copy */}
               <div className="flex gap-8 items-center shrink-0 pr-8">
                 {recentRounds.map((r) => (
                   <div key={`a-${r.id}`} className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <span className="text-zinc-500 font-mono text-xs">#{r.id}</span>
                      <span className={r.result === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                        {r.result === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      </span>
                      <span className={`font-mono font-bold ${r.result === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 text-xs">
                        {r.longBots}L / {r.shortBots}S
                      </span>
                   </div>
                 ))}
               </div>
               {/* Second copy for seamless loop */}
               <div className="flex gap-8 items-center shrink-0 pr-8">
                 {recentRounds.map((r) => (
                   <div key={`b-${r.id}`} className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <span className="text-zinc-500 font-mono text-xs">#{r.id}</span>
                      <span className={r.result === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                        {r.result === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      </span>
                      <span className={`font-mono font-bold ${r.result === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 text-xs">
                        {r.longBots}L / {r.shortBots}S
                      </span>
                   </div>
                 ))}
               </div>
             </div>
           ) : (
             <div className="flex items-center gap-2 text-sm text-zinc-500">
               <span>No completed rounds yet</span>
             </div>
           )}
        </div>
        
        {/* Leaderboard Link */}
        {onScrollToLeaderboard && (
          <>
            <div className="w-px h-6 bg-amber-400/30" />
            <button
              onClick={onScrollToLeaderboard}
              className="flex items-center gap-2.5 px-4 py-2 bg-amber-400/10 border border-amber-400/30 rounded-full text-amber-400 hover:bg-amber-400/20 hover:text-amber-300 hover:border-amber-400/50 transition-all group whitespace-nowrap"
            >
              <Trophy size={18} className="text-amber-400" />
              <span className="text-sm font-bold uppercase tracking-wide">Leaderboard</span>
              <ChevronDown size={16} className="animate-bounce" />
            </button>
          </>
        )}
      </div>

      {/* Analysis Panel Modal */}
      {/* Analysis Panel - Review Style Modal (rendered via Portal to escape stacking context) */}
      {isAnalysisPanelOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsAnalysisPanelOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative w-[1200px] max-w-[95vw] h-[85vh] bg-zinc-900/40 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/5 ring-inset">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <MessageSquareText size={24} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Agent Market Analysis</h2>
                  <p className="text-sm text-zinc-400">Round #{round.id} • {agentsWithReasons} analysts provided insights</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAnalysisPanelOpen(false)}
                className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content - Left/Right Split */}
            <div className="flex-1 flex min-h-0 divide-x divide-white/10">
              {/* LONG Side */}
              <div className="flex-1 flex flex-col bg-[#FF5722]/[0.02]">
                {/* Long Stats Header */}
                <div className="p-6 border-b border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#FF5722]/10">
                        <ArrowUp size={24} className="text-[#FF5722]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#FF5722]">BULLISH SENTIMENT</h3>
                        <p className="text-sm text-zinc-500">{bets.long.filter(b => b.reason).length} Analysis Reports</p>
                      </div>
                    </div>
                    {(() => {
                      const stats = getConfidenceStats(bets.long);
                      return stats ? (
                        <div className="text-right">
                          <div className="text-3xl font-bold text-white">{stats.average}<span className="text-lg text-zinc-500">%</span></div>
                          <div className="text-xs text-zinc-500 font-medium">Avg Confidence</div>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Stats Grid */}
                  {(() => {
                    const stats = getConfidenceStats(bets.long);
                    // Use AI-generated keywords, fallback to local extraction
                    const keywords = longKeywords.length > 0 ? longKeywords : getAggregatedKeywords(bets.long);
                    
                    return (
                      <div className="grid grid-cols-2 gap-6 h-[120px]">
                        {/* Confidence Distribution */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 h-full">
                          <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Confidence Dist.</div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-zinc-500">High</span>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#FF5722]" style={{ width: stats ? `${(stats.distribution.high / stats.total) * 100}%` : '0%' }} />
                              </div>
                              <span className="w-6 text-right text-zinc-300">{stats?.distribution.high ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-zinc-500">Mid</span>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500" style={{ width: stats ? `${(stats.distribution.mid / stats.total) * 100}%` : '0%' }} />
                              </div>
                              <span className="w-6 text-right text-zinc-300">{stats?.distribution.mid ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-zinc-500">Low</span>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-zinc-600" style={{ width: stats ? `${(stats.distribution.low / stats.total) * 100}%` : '0%' }} />
                              </div>
                              <span className="w-6 text-right text-zinc-300">{stats?.distribution.low ?? 0}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Top Keywords - AI Generated */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 h-full overflow-hidden">
                          <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                            Key Themes
                            {keywordsLoading && <span className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />}
                          </div>
                          <div className="flex flex-wrap gap-2 overflow-hidden max-h-[60px]">
                            {keywords.length > 0 ? keywords.slice(0, 4).map((kw, i) => (
                              <span key={i} className="px-2 py-1 rounded-md bg-[#FF5722]/10 text-[#FF5722] text-xs border border-[#FF5722]/20">
                                {kw.keyword}<span className="opacity-60 ml-1">({kw.count})</span>
                              </span>
                            )) : (
                              <span className="text-xs text-zinc-600">No themes detected</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Long Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {bets.long.filter(b => b.reason).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <ArrowUp size={48} className="mb-4 opacity-20" />
                      <p className="text-base font-medium">No bullish analysis available</p>
                    </div>
                  ) : (
                    bets.long.filter(b => b.reason).map((bot) => (
                      <div 
                        key={bot.id}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:border-[#FF5722]/30 hover:bg-white/[0.07] transition-all group"
                      >
                        {/* Agent Info Row */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={bot.avatar} size="md" className="ring-2 ring-black group-hover:ring-[#FF5722]/30 transition-all" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-white text-base">{bot.name}</p>
                                {bot.streak !== undefined && bot.streak > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-wide">
                                    🔥 {bot.streak} Streak
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                                <span className="flex items-center gap-1"><Target size={12} /> {bot.score} PTS</span>
                                <span className="flex items-center gap-1"><Activity size={12} /> {bot.winRate}% WR</span>
                              </div>
                            </div>
                          </div>
                          {/* Confidence Badge */}
                          {bot.confidence !== undefined && (
                            <div className="flex flex-col items-end">
                              <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                                bot.confidence >= 80 ? 'bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/20' :
                                bot.confidence >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}>
                                {bot.confidence}% Confidence
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Full Analysis */}
                        <div className="relative pl-4 border-l-2 border-[#FF5722]/20">
                          <p className="text-[15px] text-zinc-300 leading-relaxed">
                            "{bot.reason}"
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SHORT Side */}
              <div className="flex-1 flex flex-col bg-[#FF4D4D]/[0.02]">
                {/* Short Stats Header */}
                <div className="p-6 border-b border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#FF4D4D]/10">
                        <ArrowDown size={24} className="text-[#FF4D4D]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#FF4D4D]">BEARISH SENTIMENT</h3>
                        <p className="text-sm text-zinc-500">{bets.short.filter(b => b.reason).length} Analysis Reports</p>
                      </div>
                    </div>
                    {(() => {
                      const stats = getConfidenceStats(bets.short);
                      return stats ? (
                        <div className="text-right">
                          <div className="text-3xl font-bold text-white">{stats.average}<span className="text-lg text-zinc-500">%</span></div>
                          <div className="text-xs text-zinc-500 font-medium">Avg Confidence</div>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Stats Grid */}
                  {(() => {
                    const stats = getConfidenceStats(bets.short);
                    // Use AI-generated keywords, fallback to local extraction
                    const keywords = shortKeywords.length > 0 ? shortKeywords : getAggregatedKeywords(bets.short);
                    
                    return (
                      <div className="grid grid-cols-2 gap-6 h-[120px]">
                        {/* Confidence Distribution */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 h-full">
                          <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Confidence Dist.</div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-zinc-500">High</span>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#FF4D4D]" style={{ width: stats ? `${(stats.distribution.high / stats.total) * 100}%` : '0%' }} />
                              </div>
                              <span className="w-6 text-right text-zinc-300">{stats?.distribution.high ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-zinc-500">Mid</span>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500" style={{ width: stats ? `${(stats.distribution.mid / stats.total) * 100}%` : '0%' }} />
                              </div>
                              <span className="w-6 text-right text-zinc-300">{stats?.distribution.mid ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-zinc-500">Low</span>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-zinc-600" style={{ width: stats ? `${(stats.distribution.low / stats.total) * 100}%` : '0%' }} />
                              </div>
                              <span className="w-6 text-right text-zinc-300">{stats?.distribution.low ?? 0}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Top Keywords - AI Generated */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 h-full overflow-hidden">
                          <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                            Key Themes
                            {keywordsLoading && <span className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />}
                          </div>
                          <div className="flex flex-wrap gap-2 overflow-hidden max-h-[60px]">
                            {keywords.length > 0 ? keywords.slice(0, 4).map((kw, i) => (
                              <span key={i} className="px-2 py-1 rounded-md bg-[#FF4D4D]/10 text-[#FF4D4D] text-xs border border-[#FF4D4D]/20">
                                {kw.keyword}<span className="opacity-60 ml-1">({kw.count})</span>
                              </span>
                            )) : (
                              <span className="text-xs text-zinc-600">No themes detected</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Short Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {bets.short.filter(b => b.reason).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <ArrowDown size={48} className="mb-4 opacity-20" />
                      <p className="text-base font-medium">No bearish analysis available</p>
                    </div>
                  ) : (
                    bets.short.filter(b => b.reason).map((bot) => (
                      <div 
                        key={bot.id}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:border-[#FF4D4D]/30 hover:bg-white/[0.07] transition-all group"
                      >
                        {/* Agent Info Row */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={bot.avatar} size="md" className="ring-2 ring-black group-hover:ring-[#FF4D4D]/30 transition-all" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-white text-base">{bot.name}</p>
                                {bot.streak !== undefined && bot.streak < 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wide">
                                    💀 {Math.abs(bot.streak)} Streak
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                                <span className="flex items-center gap-1"><Target size={12} /> {bot.score} PTS</span>
                                <span className="flex items-center gap-1"><Activity size={12} /> {bot.winRate}% WR</span>
                              </div>
                            </div>
                          </div>
                          {/* Confidence Badge */}
                          {bot.confidence !== undefined && (
                            <div className="flex flex-col items-end">
                              <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                                bot.confidence >= 80 ? 'bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/20' :
                                bot.confidence >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}>
                                {bot.confidence}% Confidence
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Full Analysis */}
                        <div className="relative pl-4 border-l-2 border-[#FF4D4D]/20">
                          <p className="text-[15px] text-zinc-300 leading-relaxed">
                            "{bot.reason}"
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* 进场播报横幅 - 仅在 Arena section 可见时显示 */}
      <EntranceBanner events={entranceEvents} duration={4000} enabled={mounted && showEntranceBanner} />
      
      {/* Agent Profile Modal */}
      <AgentProfileModal 
        agent={selectedAgent}
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedAgent(null);
        }}
      />
    </div>
  );
}
