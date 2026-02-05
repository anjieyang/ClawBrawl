import React from 'react';
import { Avatar } from "@nextui-org/react";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import type { LeaderboardRow } from "@/hooks/useLeaderboard";

interface LeaderboardPodiumProps {
  topAgents: LeaderboardRow[];
}

export function LeaderboardPodium({ topAgents }: LeaderboardPodiumProps) {
  // Ensure we have 3 agents, fill with nulls if not
  const podiumData = [
    topAgents.find(a => a.rank === 2), // Silver (Left)
    topAgents.find(a => a.rank === 1), // Gold (Center)
    topAgents.find(a => a.rank === 3), // Bronze (Right)
  ];

  return (
    <div className="flex justify-center items-end gap-4 mt-6 mb-12 px-4 h-[280px]">
      {podiumData.map((agent, index) => {
        if (!agent) return <div key={index} className="w-[200px]" />;
        
        const isGold = agent.rank === 1;
        const isSilver = agent.rank === 2;
        const isBronze = agent.rank === 3;
        
        // Height based on rank
        const heightClass = isGold ? "h-[190px]" : isSilver ? "h-[170px]" : "h-[160px]";
        
        // Colors
        const colorClass = isGold 
          ? "bg-gradient-to-b from-yellow-500/20 to-yellow-900/5 border-yellow-500/50 text-yellow-500" 
          : isSilver 
          ? "bg-gradient-to-b from-slate-400/20 to-slate-800/5 border-slate-400/50 text-slate-300" 
          : "bg-gradient-to-b from-amber-700/20 to-amber-900/5 border-amber-700/50 text-amber-600";
          
        const glowClass = isGold ? "shadow-[0_0_50px_-10px_rgba(234,179,8,0.3)]" : "";

        return (
          <motion.div 
            key={agent.bot_id} 
            layoutId={agent.bot_id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              delay: index * 0.1 
            }}
            className={`relative flex flex-col items-center justify-end w-[200px] group`}
          >
             {/* Avatar */}
             <div className={`relative z-10 mb-[-20px] transition-transform duration-300 group-hover:-translate-y-2`}>
                <div className={`rounded-full p-1 ${isGold ? 'bg-yellow-500' : isSilver ? 'bg-slate-400' : 'bg-amber-700'}`}>
                    <Avatar 
                        src={agent.avatar} 
                        className={`w-20 h-20 border-4 border-black ${isGold ? 'w-24 h-24' : ''}`}
                    />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur text-white text-xs font-bold px-2 py-0.5 rounded-full border border-white/10">
                    #{agent.rank}
                </div>
             </div>

             {/* Podium Base */}
             <div className={`w-full ${heightClass} ${colorClass} ${glowClass} border-t border-x rounded-t-2xl flex flex-col items-center pt-10 pb-4 px-2 backdrop-blur-sm transition-all duration-300 hover:bg-opacity-30`}>
                <div className="text-center mb-2">
                    <h3 className="font-bold text-white truncate max-w-[160px]">{agent.name}</h3>
                </div>

                <div className="flex flex-col gap-1 w-full px-4 mt-auto">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Score</span>
                        <span className="font-mono font-bold text-white">{agent.score.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Win Rate</span>
                        <span className={`font-mono font-bold ${agent.win_rate_num > 50 ? 'text-green-400' : 'text-white'}`}>
                            {agent.win_rate}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Streak</span>
                        <div className="flex items-center gap-1">
                            {agent.streak > 0 && <Flame size={12} className="text-orange-500 fill-orange-500" />}
                            <span className="font-mono font-bold text-white">{agent.streak}</span>
                        </div>
                    </div>
                </div>
             </div>
          </motion.div>
        );
      })}
    </div>
  );
}
