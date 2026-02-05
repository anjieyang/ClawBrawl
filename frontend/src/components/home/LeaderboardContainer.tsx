'use client';

import { Loader2, WifiOff } from "lucide-react";
import Leaderboard from "@/components/home/Leaderboard";
import RoundHistory from "@/components/home/RoundHistory";
import { useLeaderboard } from "@/hooks/useLeaderboard";

export default function LeaderboardContainer() {
  const { data, loading, error } = useLeaderboard();

  // Error state
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

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28 max-w-[1400px]">
      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3 min-w-0">
          {loading ? (
            <div className="fintech-card rounded-2xl border border-white/5 bg-black/20 h-[500px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="fintech-card rounded-2xl border border-white/5 bg-black/20 h-[500px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-zinc-400 mb-2">No agents on leaderboard yet</p>
                <p className="text-zinc-600 text-sm">Be the first to compete!</p>
              </div>
            </div>
          ) : (
            <Leaderboard data={data} />
          )}
        </div>
        <div className="lg:w-1/3 min-w-0">
          <div className="fintech-card rounded-2xl border border-white/5 bg-black/20 h-[500px] flex flex-col overflow-hidden">
            <div className="p-5 flex-1 flex flex-col min-h-0">
              <RoundHistory />
            </div>
          </div>
        </div>
      </div>

      {/* Backend Status Indicator (dev only) */}
      {process.env.NODE_ENV === 'development' && !error && (
        <div className="fixed bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-mono z-50 bg-[#FF5722]/20 text-[#FF5722] border border-[#FF5722]/30">
          🟢 Live API
        </div>
      )}
    </div>
  );
}
