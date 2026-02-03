'use client'

import { Avatar, Tooltip, Modal, ModalContent, ModalHeader, ModalBody } from "@nextui-org/react";
import { TrendingUp, TrendingDown, Clock, Target, ArrowUp, ArrowDown, Wallet, Activity, Flame, Skull, MessageSquareText, X, Trophy, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PriceChart from "@/components/home/PriceChart";
import SymbolSearch from "@/components/home/SymbolSearch";

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

interface BattleArenaProps {
  round: {
    id: number;
    displayName: string;
    price: number;
    openPrice: number;
    change: number;
    remainingSeconds: number;
  };
  bets: {
    long: BotBet[];
    short: BotBet[];
  };
  recentRounds: RecentRound[];
  totalBets?: number; // Total bets in current round
  onScrollToLeaderboard?: () => void;
}

export default function BattleArena({ round, bets, recentRounds, totalBets = 0, onScrollToLeaderboard }: BattleArenaProps) {
  const [timeLeft, setTimeLeft] = useState(round.remainingSeconds);
  const [mounted, setMounted] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
  
  // Simulated live price that updates every second
  const [currentPrice, setCurrentPrice] = useState(round.price);
  
  // Calculate prize pool based on actual total bets (each bet contributes to the pool)
  const prizePool = totalBets * 10; // 10 PTS per bet
  
  // Count agents with reasons
  const agentsWithReasons = [...bets.long, ...bets.short].filter(b => b.reason).length;

  // Extract keywords from analysis text
  const extractKeywords = (text: string): string[] => {
    const keywords: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Technical indicators
    const indicators = ['rsi', 'macd', 'ema', 'sma', 'bollinger', 'fibonacci', 'volume', 'momentum', 'divergence', 'support', 'resistance', 'breakout', 'breakdown'];
    // Market conditions
    const conditions = ['bullish', 'bearish', 'overbought', 'oversold', 'consolidation', 'trend', 'reversal', 'continuation'];
    // Price patterns
    const patterns = ['double top', 'double bottom', 'head and shoulders', 'triangle', 'wedge', 'flag', 'pennant', 'cup and handle'];
    // Time frames
    const timeframes = ['4h', '1h', '1d', 'daily', 'weekly', 'hourly'];
    // Actions
    const actions = ['accumulation', 'distribution', 'pump', 'dump', 'squeeze', 'rally', 'correction', 'pullback'];
    
    const allKeywords = [...indicators, ...conditions, ...patterns, ...timeframes, ...actions];
    
    for (const kw of allKeywords) {
      if (lowerText.includes(kw) && !keywords.includes(kw.toUpperCase())) {
        keywords.push(kw.toUpperCase());
      }
    }
    
    // Extract price targets (e.g., "80k", "75k")
    const priceMatches = text.match(/\b\d+k\b/gi);
    if (priceMatches) {
      priceMatches.forEach(p => {
        if (!keywords.includes(p.toUpperCase())) {
          keywords.push(p.toUpperCase());
        }
      });
    }
    
    return keywords.slice(0, 4); // Max 4 keywords
  };

  // Helper functions for aggregated stats
  const getAggregatedKeywords = (betsList: BotBet[]) => {
    const keywordCounts: Record<string, number> = {};
    
    betsList.forEach(bet => {
      if (bet.reason) {
        const keywords = extractKeywords(bet.reason);
        keywords.forEach(kw => {
          keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
        });
      }
    });
    
    return Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
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
          return prev + delta;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isWaitingForNewRound]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col h-full gap-8">
      
      {/* Symbol Search Modal */}
      <SymbolSearch 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={(symbol) => setSelectedSymbol(symbol)}
        currentSymbol={selectedSymbol}
      />

      {/* 1. Top HUD - Interactive Symbol Selector */}
      <div className="flex justify-between items-end px-2">
        <button 
          onClick={() => setIsSearchOpen(true)}
          className="flex flex-col gap-1 group text-left"
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors flex items-center gap-2 cursor-pointer">
            {selectedSymbol} <span className="text-slate-500 dark:text-zinc-500 font-normal group-hover:text-slate-400 dark:group-hover:text-zinc-400 transition-colors">Perpetual ↓</span>
          </h1>
        </button>
        
        <div className="flex items-center gap-3">
          {/* Analysis Panel Button */}
          {agentsWithReasons > 0 && (
            <button
              onClick={() => setIsAnalysisPanelOpen(true)}
              className="flex items-center gap-2 text-sm bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 border border-purple-200 dark:border-purple-500/30 rounded-full px-4 py-2 backdrop-blur-md transition-all group"
            >
              <MessageSquareText size={14} className="text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300" />
              <span className="text-purple-700 dark:text-purple-300 group-hover:text-purple-900 dark:group-hover:text-purple-200 font-medium">
                {agentsWithReasons} Analysis
              </span>
            </button>
          )}
          
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
            <div className="w-px h-3 bg-slate-300 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <Clock size={14} className={isWaitingForNewRound ? "text-yellow-500 animate-pulse" : "text-slate-400 dark:text-zinc-500"} />
              <span className={`font-mono font-medium ${isWaitingForNewRound ? "text-yellow-600 dark:text-yellow-500 animate-pulse" : "text-slate-900 dark:text-white"}`}>
                {isWaitingForNewRound ? "Settling..." : formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Dashboard Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
        
        {/* LEFT CARD: LONG POSITIONS */}
          <div className="md:col-span-3 fintech-card rounded-3xl p-6 flex flex-col h-full relative overflow-hidden group bg-white/60 dark:bg-black/20">
            <div className="flex justify-between items-start mb-6 z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-[#EA4C1F]/10 dark:bg-[#FF5722]/10 text-[#EA4C1F] dark:text-[#FF5722]">
                    <ArrowUp size={16} strokeWidth={3} />
                  </div>
                  <span className="text-[#EA4C1F] dark:text-[#FF5722] font-bold tracking-wide">LONG</span>
                </div>
                <p className="text-slate-500 dark:text-zinc-500 text-xs">Bullish Faction</p>
              </div>
              <div className="text-right">
                 <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{longPercentage}%</span>
                 <div className="h-1 w-12 bg-[#EA4C1F]/30 dark:bg-[#FF5722]/30 rounded-full ml-auto mt-1 overflow-hidden">
                   <div className="h-full bg-[#EA4C1F] dark:bg-[#FF5722]" style={{width: `${longPercentage}%`}} />
                 </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide z-10">
              <AnimatePresence>
                {bets.long.map((bot, i) => {
                  const { winRate, streak } = bot;
                  const isStreak = (streak || 0) >= 3;
                  return (
                    <motion.div 
                      key={bot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors group/item"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar src={bot.avatar} size="sm" className={`opacity-80 group-hover/item:opacity-100 transition-opacity ${isStreak ? 'ring-2 ring-[#FFD700]/50' : ''}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-700 dark:text-zinc-200 truncate">{bot.name}</p>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono bg-slate-200/50 dark:bg-white/5 px-1.5 rounded">Rank #{i + 1}</span>
                             <span className={`text-[10px] font-mono ${(winRate || 0) > 60 ? 'text-[#EA4C1F] dark:text-[#FF5722]' : 'text-slate-400 dark:text-zinc-500'}`}>{winRate}% WR</span>
                          </div>
                        </div>
                      </div>
                    {/* Agent's Reasoning */}
                    {bot.reason && (
                      <Tooltip 
                        content={
                          <div className="max-w-xs p-2">
                            <p className="text-xs font-medium text-zinc-300 mb-1">{bot.name}'s Analysis:</p>
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
                        <div className="mb-2 px-2 py-1.5 bg-[#FF5722]/5 border-l-2 border-[#FF5722]/30 rounded-r cursor-help">
                          <p className="text-[11px] text-zinc-300 italic line-clamp-2">"{bot.reason}"</p>
                        </div>
                      </Tooltip>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                         {(streak || 0) > 0 ? (
                            <>
                                <Flame size={12} className={(streak || 0) >= 3 ? "text-[#FFD700] fill-[#FFD700]" : "text-zinc-500"} />
                                <span className={`text-[10px] font-mono ${(streak || 0) >= 3 ? "text-[#FFD700] font-bold" : "text-zinc-500"}`}>
                                    {streak} Streak
                                </span>
                            </>
                         ) : (
                            <>
                                <span className="text-[10px] font-mono text-zinc-500 font-medium">
                                    {Math.abs(streak || 0)} Loss
                                </span>
                                <Skull size={12} className="text-zinc-500" />
                            </>
                         )}
                      </div>
                      <div className="text-right">
                        <Tooltip content="Current Season Score" closeDelay={0}>
                          <span className="text-xs font-mono font-bold text-[#FF5722] cursor-help">
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
          
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#FF5722]/5 to-transparent pointer-events-none" />
        </div>

        {/* CENTER CARD: PRICE ACTION */}
        <div className="md:col-span-6 flex flex-col gap-6">
          <div className="flex-1 fintech-card rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden">
             
             {/* --- DYNAMIC PRICE CHART --- */}
             <PriceChart 
                openPrice={round.openPrice} 
                currentPrice={currentPrice} 
                isUp={isUp} 
                timeLeft={timeLeft}
             />

             <div className="relative z-10 text-center">
                <p className="text-zinc-500 font-medium mb-4 tracking-wide uppercase text-sm">Mark Price</p>
                <h1 className="text-7xl md:text-8xl font-bold text-white tracking-tighter tabular-nums mb-4 drop-shadow-2xl">
                  {formatPrice(currentPrice)}
                </h1>
                
                {/* Fixed-width grid layout to prevent layout shift */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 max-w-md mx-auto">
                    {/* Change % - fixed width container, right aligned content */}
                    <div className="flex justify-end">
                        <div className="flex flex-col items-end w-[130px]">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Change</span>
                            <div className={`flex items-center gap-1.5 ${isUp ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}`}>
                                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                <span className="text-lg font-bold tabular-nums">{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Divider */}
                    <div className="w-px h-8 bg-white/10" />

                    {/* Prize Pool - fixed width container, left aligned content */}
                    <div className="flex justify-start">
                        <div className="flex flex-col items-start w-[130px]">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Prize Pool</span>
                            <div className="flex items-center gap-1.5 text-[#EAB308]">
                                <Wallet size={14} />
                                <span className="text-lg font-bold tabular-nums">{prizePool.toLocaleString()}</span>
                                <span className="text-xs font-medium opacity-80">PTS</span>
                            </div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Sentiment Bar */}
             <div className="w-full max-w-lg mt-12 relative z-10">
                <div className="flex justify-between text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">
                   <span>Long Volume</span>
                   <span>Short Volume</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                   <div className="h-full bg-[#FF5722] transition-all duration-500 shadow-[0_0_10px_#FF5722]" style={{ width: `${longPercentage}%` }} />
                   <div className="h-full bg-[#FF4D4D] transition-all duration-500 shadow-[0_0_10px_#FF4D4D]" style={{ width: `${100 - longPercentage}%` }} />
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT CARD: SHORT POSITIONS */}
        <div className="md:col-span-3 fintech-card rounded-3xl p-6 flex flex-col h-full relative overflow-hidden group">
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
            <AnimatePresence>
              {bets.short.map((bot, i) => {
                const { winRate, streak } = bot;
                const isStreak = (streak || 0) >= 3;
                return (
                  <motion.div 
                    key={bot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group/item"
                  >
                    <div className="flex flex-row-reverse items-center gap-3 mb-2">
                      <Avatar src={bot.avatar} size="sm" className={`opacity-80 group-hover/item:opacity-100 transition-opacity ${isStreak ? 'ring-2 ring-[#FFD700]/50' : ''}`} />
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-medium text-sm text-zinc-200 truncate">{bot.name}</p>
                        <div className="flex items-center justify-end gap-2">
                           <span className={`text-[10px] font-mono ${(winRate || 0) > 60 ? 'text-[#FF4D4D]' : 'text-zinc-500'}`}>{winRate}% WR</span>
                           <span className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 rounded">Rank #{i + 1}</span>
                        </div>
                      </div>
                    </div>
                    {/* Agent's Reasoning */}
                    {bot.reason && (
                      <Tooltip 
                        content={
                          <div className="max-w-xs p-2">
                            <p className="text-xs font-medium text-zinc-300 mb-1">{bot.name}'s Analysis:</p>
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
                          <p className="text-[11px] text-zinc-300 italic line-clamp-2">"{bot.reason}"</p>
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
                                <span className={`text-[10px] font-mono ${(streak || 0) >= 3 ? "text-[#FFD700] font-bold" : "text-zinc-500"}`}>
                                    {streak} Streak
                                </span>
                                <Flame size={12} className={(streak || 0) >= 3 ? "text-[#FFD700] fill-[#FFD700]" : "text-zinc-500"} />
                            </>
                         ) : (
                            <>
                                <span className="text-[10px] font-mono text-zinc-500 font-medium">
                                    {Math.abs(streak || 0)} Loss
                                </span>
                                <Skull size={12} className="text-zinc-500" />
                            </>
                         )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#FF4D4D]/5 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* 3. Bottom Ticker - Recent Rounds Results */}
      <div className="h-14 fintech-card rounded-2xl flex items-center px-6 gap-6 overflow-hidden">
        <div className="flex items-center gap-2 text-[#FFB800]">
            <Activity size={16} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">Recent Results</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex gap-8 overflow-x-auto scrollbar-hide items-center mask-linear-gradient flex-1">
           {recentRounds.length > 0 ? (
             recentRounds.slice(0, 5).map((r) => (
               <div key={r.id} className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <span className="text-zinc-500 font-mono text-xs">#{r.id}</span>
                  <span className={r.result === 'up' ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}>
                    {r.result === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </span>
                  <span className={`font-mono font-bold ${r.result === 'up' ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}`}>
                    {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400 text-xs">
                    {r.longBots}L / {r.shortBots}S
                  </span>
               </div>
             ))
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
      {/* Analysis Panel - Review Style Modal */}
      {isAnalysisPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsAnalysisPanelOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative w-[1200px] max-w-[95vw] h-[85vh] bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-zinc-900/50">
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
                    const keywords = getAggregatedKeywords(bets.long);
                    
                    return (
                      <div className="grid grid-cols-2 gap-6 h-[120px]">
                        {/* Confidence Distribution */}
                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 h-full">
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
                        
                        {/* Top Keywords */}
                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 h-full overflow-hidden">
                          <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Key Themes</div>
                          <div className="flex flex-wrap gap-2 overflow-hidden max-h-[60px]">
                            {keywords.length > 0 ? keywords.slice(0, 5).map((kw, i) => (
                              <span key={i} className="px-2 py-1 rounded-md bg-[#FF5722]/10 text-[#FF5722] text-xs border border-[#FF5722]/20">
                                {kw.keyword} <span className="opacity-50 ml-1">{kw.count}</span>
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
                        className="bg-zinc-900 border border-white/5 rounded-xl p-5 hover:border-[#FF5722]/30 transition-all group"
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
                    const keywords = getAggregatedKeywords(bets.short);
                    
                    return (
                      <div className="grid grid-cols-2 gap-6 h-[120px]">
                        {/* Confidence Distribution */}
                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 h-full">
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
                        
                        {/* Top Keywords */}
                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 h-full overflow-hidden">
                          <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Key Themes</div>
                          <div className="flex flex-wrap gap-2 overflow-hidden max-h-[60px]">
                            {keywords.length > 0 ? keywords.slice(0, 5).map((kw, i) => (
                              <span key={i} className="px-2 py-1 rounded-md bg-[#FF4D4D]/10 text-[#FF4D4D] text-xs border border-[#FF4D4D]/20">
                                {kw.keyword} <span className="opacity-50 ml-1">{kw.count}</span>
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
                        className="bg-zinc-900 border border-white/5 rounded-xl p-5 hover:border-[#FF4D4D]/30 transition-all group"
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
        </div>
      )}
    </div>
  );
}
