'use client'

import React from 'react';
import { TrendingUp, TrendingDown, Clock, Users, Loader2, WifiOff } from 'lucide-react';
import { useRoundHistory } from '@/hooks/useRoundHistory';

// Symbol color mapping
const SYMBOL_COLORS: Record<string, { bg: string; text: string }> = {
  BTCUSDT: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  ETHUSDT: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  SOLUSDT: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  BNBUSDT: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
};

const getSymbolStyle = (symbol: string) => {
  return SYMBOL_COLORS[symbol] || { bg: 'bg-zinc-500/10', text: 'text-zinc-400' };
};

interface RoundHistoryProps {
  symbol?: string;
  limit?: number;
}

export default function RoundHistory({ symbol, limit = 10 }: RoundHistoryProps) {
  const { rounds, loading, error } = useRoundHistory({ symbol, limit });

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <WifiOff className="w-6 h-6 text-zinc-600" />
        <p className="text-zinc-500 text-xs text-center">Unable to load history</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
       {/* Header */}
       <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} className="text-zinc-500" /> Round History
        </h3>
      </div>

      {/* Recent Rounds List - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {rounds.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No rounds completed yet
          </div>
        ) : (
          rounds.map((round) => {
            const isUp = round.result === "up";
            const symbolStyle = getSymbolStyle(round.symbol);
            const displaySymbol = round.symbol.replace('USDT', '');
            const winnersCount = isUp ? round.longBots : round.shortBots;
            
            return (
              <div 
                key={round.id}
                className="rounded-xl p-3 border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`${isUp ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}`}>
                      {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${symbolStyle.bg} ${symbolStyle.text}`}>
                          {displaySymbol}
                        </span>
                        <span className="text-zinc-500 text-[10px] font-mono">#{round.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                        <Users size={10} />
                        <span className="text-[#FF5722]">{round.longBots}L</span>
                        <span>/</span>
                        <span className="text-[#FF4D4D]">{round.shortBots}S</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-base font-bold font-mono ${isUp ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}`}>
                      {isUp ? '+' : ''}{typeof round.change === 'number' ? round.change.toFixed(2) : round.change}%
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {winnersCount} winner{winnersCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
