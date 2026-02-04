'use client';

import { useArenaData } from "@/hooks/useArenaData";
import BattleArena from "@/components/home/BattleArena";
import Danmaku from "@/components/ui/Danmaku";
// ChatRoom is now rendered at provider level (providers.tsx) to persist across navigation
import { Loader2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface ArenaContainerProps {
  symbol?: string;
  onScrollToLeaderboard?: () => void;
}

const normalizeDisplaySymbolToBackend = (displaySymbol: string) => displaySymbol.replaceAll('/', '');

const formatBackendSymbolToDisplay = (backendSymbol: string) => {
  if (backendSymbol.includes('/')) return backendSymbol;
  if (backendSymbol.endsWith('USDT')) return backendSymbol.replace('USDT', '/USDT');
  if (backendSymbol.endsWith('USD')) return backendSymbol.replace('USD', '/USD');
  return backendSymbol;
};

export default function ArenaContainer({ symbol = "BTCUSDT", onScrollToLeaderboard }: ArenaContainerProps) {
  const [selectedBackendSymbol, setSelectedBackendSymbol] = useState<string>(symbol);
  const [selectedDisplaySymbol, setSelectedDisplaySymbol] = useState<string>(formatBackendSymbolToDisplay(symbol));
  const [isArenaSectionActive, setIsArenaSectionActive] = useState(false);

  const { round, bets, recentRounds, loading, error, backendStatus } = useArenaData({
    symbol: selectedBackendSymbol,
  });

  // 仅在 Arena section 可见时启用弹幕（避免 fixed 弹幕覆盖 Hero/Leaderboard）
  useEffect(() => {
    const arenaSection = document.getElementById('section-arena');
    if (!arenaSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0;
        setIsArenaSectionActive(Boolean(entry?.isIntersecting) && ratio >= 0.6);
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(arenaSection);
    return () => observer.disconnect();
  }, []);

  const effectiveDisplaySymbol = useMemo(() => {
    // round.displayName 更准确（后端可能提供更友好的名称）
    return round?.displayName ? round.displayName : selectedDisplaySymbol;
  }, [round?.displayName, selectedDisplaySymbol]);

  const handleSelectSymbol = useCallback((displaySymbol: string) => {
    const backendSymbol = normalizeDisplaySymbolToBackend(displaySymbol);
    setSelectedBackendSymbol(backendSymbol);
    setSelectedDisplaySymbol(displaySymbol);
  }, []);

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
  if (backendStatus === 'offline') {
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
      <Danmaku
        enabled={isArenaSectionActive && backendStatus === 'online' && !!round}
        symbol={selectedBackendSymbol}
        roundId={round.id}
        useMockFallback={false}
      />

      {/* ChatRoom is now rendered at provider level (providers.tsx) to persist across navigation */}

      {/* Backend Status Indicator (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-mono z-50 bg-[#FF5722]/20 text-[#FF5722] border border-[#FF5722]/30">
          🟢 Live API
        </div>
      )}
      
      <BattleArena 
        round={round} 
        selectedSymbol={effectiveDisplaySymbol}
        onSelectSymbol={handleSelectSymbol}
        bets={bets}
        recentRounds={displayRecentRounds}
        totalBets={round.betCount}
        onScrollToLeaderboard={onScrollToLeaderboard}
        showEntranceBanner={isArenaSectionActive}
      />
    </>
  );
}
