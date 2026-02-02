'use client';

import { useState, useEffect } from "react";
import { Trophy, Users, Activity, Target, Loader2, WifiOff } from "lucide-react";
import Leaderboard from "@/components/home/Leaderboard";
import AgentProfileCard from "@/components/home/AgentProfileCard";
import { MarketAnalytics } from "@/components/home/MarketAnalytics";
import { useLeaderboard } from "@/hooks/useLeaderboard";

/**
 * Leaderboard section for embedding in snap-scroll home page
 * This is a headerless version of LeaderboardContainer
 */
export default function LeaderboardSection() {
  const { data, stats, loading, error } = useLeaderboard();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  // Auto-select first agent when data loads
  useEffect(() => {
    if (data.length > 0 && !selectedAgent) {
      setSelectedAgent(data[0]);
    }
  }, [data, selectedAgent]);

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
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Bets", value: stats.totalBets, icon: Activity },
          { label: "Active Agents", value: stats.activeBots, icon: Users },
          { label: "Total Rounds", value: stats.totalRounds, icon: Target },
          { label: "Avg Win Rate", value: stats.avgWinRate, icon: Trophy }
        ].map((stat, i) => (
          <div key={i} className="fintech-card px-5 py-4 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors border border-white/5 bg-black/20">
            <div>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block mb-1">{stat.label}</span>
              <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : stat.value}
              </p>
            </div>
            <stat.icon size={20} className="text-zinc-600 opacity-50" />
          </div>
        ))}
      </div>

      {/* Main Content Layout - Leaderboard + Agent Profile Card */}
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
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
            <Leaderboard 
              data={data} 
              selectedAgentId={selectedAgent?.bot_id}
              onSelectAgent={setSelectedAgent}
            />
          )}
        </div>
        <div className="lg:w-1/3 min-w-0 h-[500px]">
          <AgentProfileCard agent={selectedAgent} />
        </div>
      </div>

      {/* Market Analytics Section */}
      <MarketAnalytics />
    </div>
  );
}
