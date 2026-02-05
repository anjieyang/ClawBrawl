'use client';

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import Leaderboard, { type LeaderboardPeriod } from "@/components/home/Leaderboard";
import { useLeaderboard } from "@/hooks/useLeaderboard";

/**
 * Leaderboard section for embedding in snap-scroll home page
 * This is a headerless version of LeaderboardContainer
 */
export default function LeaderboardSection() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const { data, stats, loading, error } = useLeaderboard({ period });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Auto-select first agent when data loads
  useEffect(() => {
    if (data.length > 0 && !selectedAgentId) {
      setSelectedAgentId(data[0].bot_id);
    }
  }, [data, selectedAgentId]);

  // Error state (only show if not loading and has error)
  if (error && !loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28 max-w-[1400px]">
        <div className="flex flex-col items-center justify-center gap-4 min-h-[400px]">
          <div className="p-4 rounded-full bg-zinc-800/50">
            <WifiOff className="w-10 h-10 text-zinc-500" />
          </div>
          <div className="text-center">
            <h3 className="text-zinc-300 font-semibold mb-1">Unable to Load Leaderboard</h3>
            <p className="text-zinc-500 text-sm max-w-md">
              Could not connect to the backend server. Please ensure the server is running.
            </p>
            <p className="text-red-400/70 text-xs mt-2 font-mono">{error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Always render Leaderboard component - it will handle loading/empty states internally
  // This ensures the drawer structure is pre-rendered for instant display
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28 max-w-[1400px]">
      <div className="mb-8">
        <Leaderboard 
          data={data} 
          stats={stats}
          loading={loading}
          selectedAgentId={selectedAgentId}
          onSelectAgent={(agent) => setSelectedAgentId(agent.bot_id)}
          period={period}
          onPeriodChange={setPeriod}
        />
      </div>
    </div>
  );
}
