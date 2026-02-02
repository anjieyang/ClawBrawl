'use client';

import { useArenaData } from "@/hooks/useArenaData";
import BattleArena from "@/components/home/BattleArena";
import { Loader2, WifiOff } from "lucide-react";

interface ArenaContainerProps {
  symbol?: string;
  onScrollToLeaderboard?: () => void;
}

export default function ArenaContainer({ symbol = "BTCUSDT", onScrollToLeaderboard }: ArenaContainerProps) {
  const { round, bets, recentRounds, loading, error, backendStatus } = useArenaData({
    symbol,
    refreshInterval: 1000,
  });

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-500" />
        <p className="text-zinc-500 text-sm">Connecting to arena...</p>
      </div>
    );
  }

  // Backend offline state
  if (backendStatus === 'offline' || error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-zinc-800/50">
          <WifiOff className="w-10 h-10 text-zinc-500" />
        </div>
        <div className="text-center">
          <h3 className="text-zinc-300 font-semibold mb-1">Backend Offline</h3>
          <p className="text-zinc-500 text-sm max-w-md">
            Unable to connect to the arena server. Please ensure the backend is running on port 8000.
          </p>
          {error && (
            <p className="text-red-400/70 text-xs mt-2 font-mono">{error}</p>
          )}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // No active round state
  if (!round) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <h3 className="text-zinc-300 font-semibold mb-1">No Active Round</h3>
          <p className="text-zinc-500 text-sm">
            Waiting for the next round to start...
          </p>
        </div>
      </div>
    );
  }

  // Transform recent rounds for BattleArena
  const displayRecentRounds = recentRounds.map(r => ({
    id: r.id,
    result: r.result as "up" | "down",
    change: r.change,
    longBots: r.longCount,
    shortBots: r.shortCount,
  }));

  return (
    <>
      {/* Backend Status Indicator (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-mono z-50 bg-[#20E696]/20 text-[#20E696] border border-[#20E696]/30">
          🟢 Live API
        </div>
      )}
      
      <BattleArena 
        round={round} 
        bets={bets}
        recentRounds={displayRecentRounds}
        totalBets={round.betCount}
        onScrollToLeaderboard={onScrollToLeaderboard}
      />
    </>
  );
}
