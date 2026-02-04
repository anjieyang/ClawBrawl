'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Area,
  ComposedChart,
} from 'recharts';

interface ScoringInfo {
  timeProgress: number;
  timeProgressPercent: number;
  estimatedWinScore: number;
  estimatedLoseScore: number;
  earlyBonusRemaining: number;
}

interface ScoringPanelProps {
  scoring: ScoringInfo | null;
  bettingWindowMinutes?: number;
}

// Scoring formula constants (must match backend)
const WIN_BASE = 10;
const LOSE_BASE = -5;
const EARLY_BONUS = 1.0;
const LATE_PENALTY = 0.6;
const DECAY_K = 3.0;
const STREAK_5_MULTIPLIER = 1.6; // 5+ streak multiplier

// Calculate decay at a given time progress
function calculateDecay(t: number): number {
  return Math.exp(-DECAY_K * t);
}

// Calculate win score at time progress
function calculateWinScore(t: number, streakMult: number = 1.0): number {
  const decay = calculateDecay(t);
  return Math.round(WIN_BASE * (1 + EARLY_BONUS * decay) * streakMult);
}

// Calculate lose score at time progress
function calculateLoseScore(t: number, streakMult: number = 1.0): number {
  const decay = calculateDecay(t);
  return Math.round(LOSE_BASE * (1 + LATE_PENALTY * (1 - decay)) * streakMult);
}

export default function ScoringPanel({ scoring, bettingWindowMinutes = 7 }: ScoringPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Set mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate chart data points - full 10 minute round
  const roundDurationMinutes = 10;
  const chartData = useMemo(() => {
    const points = [];
    // Generate points for full 10 minute round - single continuous series
    for (let i = 0; i <= 100; i += 2) {
      const minutes = (i / 100) * roundDurationMinutes;
      // For betting window (0-7 min), calculate normally
      // For settlement period (7-10 min), keep final values
      const t = minutes <= bettingWindowMinutes 
        ? minutes / bettingWindowMinutes 
        : 1; // clamp to 1 for settlement period
      
      points.push({
        time: t,
        minutes: minutes,
        timeLabel: `${Math.floor(minutes)}:${String(Math.round((minutes % 1) * 60)).padStart(2, '0')}`,
        win: calculateWinScore(t),
        lose: Math.abs(calculateLoseScore(t)),
        loseActual: calculateLoseScore(t),
        // 5-streak values (for dashed line visualization)
        winStreak5: calculateWinScore(t, STREAK_5_MULTIPLIER),
        loseStreak5: Math.abs(calculateLoseScore(t, STREAK_5_MULTIPLIER)),
        bonus: Math.round(calculateDecay(t) * 100),
        isSettlement: minutes > bettingWindowMinutes,
      });
    }
    return points;
  }, [bettingWindowMinutes]);

  // Current position data
  const currentTime = scoring?.timeProgress ?? 0;
  const currentMinutes = currentTime * bettingWindowMinutes;
  const currentWin = scoring?.estimatedWinScore ?? calculateWinScore(currentTime);
  const currentLose = scoring?.estimatedLoseScore ?? calculateLoseScore(currentTime);
  const currentBonus = scoring ? Math.round(scoring.earlyBonusRemaining * 100) : 0;

  // Determine status
  const isBettingOpen = scoring !== null;
  const bonusLevel = currentBonus > 50 ? 'high' : currentBonus > 20 ? 'medium' : 'low';

  return (
    <>
      {/* Compact Indicator Card - Only shows bonus, click for details */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
          isBettingOpen
            ? 'bonus-btn-shine bg-amber-400/20 border-amber-400/40 hover:bg-amber-400/30 hover:border-amber-400/50'
            : 'bg-zinc-900/50 border-zinc-700/30 hover:bg-zinc-800/50'
        }`}
      >
        {/* Lightning Icon */}
        <Zap
          size={14}
          className={isBettingOpen ? 'text-amber-400' : 'text-zinc-600'}
        />
        
        {/* Bonus or Status */}
        {isBettingOpen ? (
          <span className="text-sm font-medium text-amber-400">
            {currentBonus}% bonus
          </span>
        ) : (
          <span className="text-sm text-zinc-500">Closed</span>
        )}
        
        {/* Arrow indicator */}
        <svg 
          className={`w-3.5 h-3.5 ${isBettingOpen ? 'text-amber-400/70' : 'text-zinc-500'}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Modal Panel */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-[750px] max-w-[95vw] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#22C55E]/10">
                    <Zap size={20} className="text-[#22C55E]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Time-Weighted Scoring</h2>
                    <p className="text-xs text-zinc-400">Bet early for maximum rewards</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Chart Area */}
              <div className="p-6">
                {/* Current Status */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-zinc-500" />
                    <span className="text-sm text-zinc-400">
                      {isBettingOpen ? (
                        <>
                          Betting Window:{' '}
                          <span className="text-white font-mono">
                            {Math.floor(currentMinutes)}:{String(Math.round((currentMinutes % 1) * 60)).padStart(2, '0')}
                          </span>
                          <span className="text-zinc-500"> / {bettingWindowMinutes}:00</span>
                        </>
                      ) : (
                        <span className="text-zinc-500">Betting window closed</span>
                      )}
                    </span>
                  </div>
                  {isBettingOpen && (
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        bonusLevel === 'high'
                          ? 'bg-[#22C55E]/20 text-[#22C55E]'
                          : bonusLevel === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {bonusLevel === 'high' ? '⚡ Early Bird Bonus Active!' : bonusLevel === 'medium' ? 'Bonus Decreasing...' : 'Minimal Bonus'}
                    </div>
                  )}
                </div>

                {/* Chart */}
                <div className="h-[280px] w-full relative">
                  {/* NOW line - CSS based, always visible */}
                  <div 
                    className="absolute top-0 bottom-[20px] z-10 pointer-events-none"
                    style={{ 
                      // currentMinutes / 10 gives the position in the 10-minute chart
                      // Adjust for chart margins (left ~3%, right ~8%)
                      // When closed, show at 8.5 min (middle of settlement period)
                      left: `calc(${3 + ((isBettingOpen ? currentMinutes : 8.5) / roundDurationMinutes) * 89}%)`,
                      borderLeft: '1.5px dashed rgba(255,255,255,0.25)'
                    }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-medium whitespace-nowrap">
                      NOW
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 50, left: 10, bottom: 20 }}>
                      <defs>
                        {/* Horizontal gradient for win line: green -> gray at 70% */}
                        <linearGradient id="winLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22C55E" />
                          <stop offset="68%" stopColor="#22C55E" />
                          <stop offset="72%" stopColor="#555" />
                          <stop offset="100%" stopColor="#444" />
                        </linearGradient>
                        {/* Horizontal gradient for lose line: red -> gray at 70% */}
                        <linearGradient id="loseLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#EF4444" />
                          <stop offset="68%" stopColor="#EF4444" />
                          <stop offset="72%" stopColor="#555" />
                          <stop offset="100%" stopColor="#444" />
                        </linearGradient>
                        {/* Area gradients - vertical fade with horizontal color change */}
                        <linearGradient id="winAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="loseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      
                      {/* Settlement period background (7-10 min) - darker */}
                      <ReferenceArea
                        yAxisId="left"
                        x1={bettingWindowMinutes}
                        x2={roundDurationMinutes}
                        fill="rgba(30,30,30,0.6)"
                        fillOpacity={1}
                      />
                      
                      <XAxis
                        dataKey="minutes"
                        stroke="#666"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#444' }}
                        tickFormatter={(v) => `${Math.floor(v)}m`}
                        ticks={[0, 2, 4, 6, 7, 8, 10]}
                        domain={[0, 10]}
                      />
                      {/* Left Y-Axis: Win Score (descending) - expanded for 5-streak */}
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        stroke="#22C55E"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#22C55E' }}
                        domain={[8, 34]}
                        ticks={[10, 15, 20, 25, 30]}
                        tickFormatter={(v) => `+${v}`}
                      />
                      {/* Right Y-Axis: Lose Score absolute value (ascending) - expanded for 5-streak */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#EF4444"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#EF4444' }}
                        domain={[4, 14]}
                        ticks={[5, 7, 9, 11, 13]}
                        tickFormatter={(v) => `-${v}`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(v) => `Time: ${Math.floor(v as number)}:${String(Math.round(((v as number) % 1) * 60)).padStart(2, '0')}`}
                        formatter={(value, name) => {
                          if (name === 'win') return [`+${value}`, 'Base Win'];
                          if (name === 'lose') return [`-${value}`, 'Base Lose'];
                          if (name === 'winStreak5') return [`+${value}`, '5-Streak Win'];
                          if (name === 'loseStreak5') return [`-${value}`, '5-Streak Lose'];
                          return [String(value), String(name)];
                        }}
                      />

                      {/* Win Area & Line (left Y-axis, descending) - continuous with gradient */}
                      <Area yAxisId="left" type="monotone" dataKey="win" stroke="none" fill="url(#winAreaGradient)" />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="win"
                        stroke="url(#winLineGradient)"
                        strokeWidth={2.5}
                        dot={false}
                        name="win"
                      />

                      {/* 5-Streak Win Line (dashed) */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="winStreak5"
                        stroke="#22C55E"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        dot={false}
                        name="winStreak5"
                      />

                      {/* Lose Area & Line (right Y-axis, ascending) - continuous with gradient */}
                      <Area yAxisId="right" type="monotone" dataKey="lose" stroke="none" fill="url(#loseAreaGradient)" />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="lose"
                        stroke="url(#loseLineGradient)"
                        strokeWidth={2.5}
                        dot={false}
                        name="lose"
                      />

                      {/* 5-Streak Lose Line (dashed) */}
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="loseStreak5"
                        stroke="#EF4444"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        dot={false}
                        name="loseStreak5"
                      />

                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-[#22C55E]" />
                    <span>Base Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-[#22C55E]/50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #22C55E80 0, #22C55E80 4px, transparent 4px, transparent 8px)' }} />
                    <span>5+ Streak (1.6x)</span>
                  </div>
                </div>

                {/* Current Values */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className={`p-4 rounded-xl border ${isBettingOpen ? 'bg-[#22C55E]/5 border-[#22C55E]/20' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={14} className={isBettingOpen ? 'text-[#22C55E]' : 'text-zinc-600'} />
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">Win Score</span>
                    </div>
                    <div className={`text-3xl font-bold ${isBettingOpen ? 'text-[#22C55E]' : 'text-zinc-600'}`}>
                      +{currentWin}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                      Base: +20 → +11 <span className="text-zinc-600">| 5-streak: +32 → +18</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${isBettingOpen ? 'bg-[#EF4444]/5 border-[#EF4444]/20' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown size={14} className={isBettingOpen ? 'text-[#EF4444]' : 'text-zinc-600'} />
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">Lose Score</span>
                    </div>
                    <div className={`text-3xl font-bold ${isBettingOpen ? 'text-[#EF4444]' : 'text-zinc-600'}`}>
                      {currentLose}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                      Base: -5 → -8 <span className="text-zinc-600">| 5-streak: -8 → -13</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${
                    isBettingOpen
                      ? bonusLevel === 'high'
                        ? 'bg-[#22C55E]/5 border-[#22C55E]/20'
                        : bonusLevel === 'medium'
                        ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-zinc-800/50 border-zinc-700/50'
                      : 'bg-zinc-800/50 border-zinc-700/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={14} className={
                        isBettingOpen
                          ? bonusLevel === 'high'
                            ? 'text-[#22C55E]'
                            : bonusLevel === 'medium'
                            ? 'text-yellow-400'
                            : 'text-zinc-600'
                          : 'text-zinc-600'
                      } />
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">Early Bonus</span>
                    </div>
                    <div className={`text-3xl font-bold ${
                      isBettingOpen
                        ? bonusLevel === 'high'
                          ? 'text-[#22C55E]'
                          : bonusLevel === 'medium'
                          ? 'text-yellow-400'
                          : 'text-zinc-500'
                        : 'text-zinc-600'
                    }`}>
                      {currentBonus}%
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                      Decays over time
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <span className="text-white font-medium">Pro Tip:</span> The earlier you bet, the higher the stakes!
                    Win score starts at <span className="text-[#22C55E]">+20</span> and decays to <span className="text-[#22C55E]">+11</span>.
                    Lose penalty starts at <span className="text-[#EF4444]">-5</span> and increases to <span className="text-[#EF4444]">-8</span>.
                    <span className="text-amber-400 ml-1">Streaks multiply BOTH wins AND losses!</span>
                  </p>
                </div>
              </div>
            </div>
        </div>,
        document.body
      )}
    </>
  );
}
