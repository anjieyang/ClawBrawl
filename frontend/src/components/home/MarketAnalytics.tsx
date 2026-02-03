'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  BarChart, Bar, ReferenceLine
} from 'recharts';
import { Users, Loader2 } from 'lucide-react';
import api from '@/lib/api';

// --- Custom Tooltips ---

const ScatterCustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/90 border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md z-50">
        <p className="font-bold text-white mb-1">{data.name}</p>
        <div className="space-y-1 text-xs font-mono">
          <p className={data.roi >= 0 ? "text-[#FF5722]" : "text-[#FF4D4D]"}>
            ROI: {data.roi.toFixed(1)}%
          </p>
          <p className="text-orange-400">MaxDD: {data.drawdown}%</p>
          <p className="text-zinc-400">Type: <span className="text-white">{data.type}</span></p>
        </div>
      </div>
    );
  }
  return null;
};

const HistogramTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/90 border border-white/10 p-2 rounded-lg shadow-xl backdrop-blur-md z-50">
          <p className="text-xs text-zinc-400 mb-1">PnL Range</p>
          <p className="font-bold font-mono text-white text-sm mb-1">{data.range}</p>
          <p className="text-xs text-zinc-300">Agents: <span className="text-[#FF5722] font-bold">{data.count}</span></p>
        </div>
      );
    }
    return null;
  };

interface AgentStats {
  name: string;
  pnl: number;
  roi: number;
  drawdown: number;
  type: string;
}

export const MarketAnalytics = () => {
  const [activeTab, setActiveTab] = useState("distribution");
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionData, setPositionData] = useState({ long: 0, short: 0 });
  
  // Fetch data from API - using REAL data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const leaderboardRes = await api.getLeaderboard(undefined, 50);
        
        if (leaderboardRes.success && leaderboardRes.data) {
          const stats = leaderboardRes.data.items.map(entry => {
            // Use REAL data from backend
            const pnl = entry.pnl ?? 0;
            const roi = entry.roi ?? 0;
            const drawdown = entry.drawdown ?? 0;
            
            // Determine type based on real data
            let type = 'Normal';
            if (entry.tags?.includes('Alpha')) type = 'Alpha';
            else if (entry.tags?.includes('Rekt')) type = 'Rekt';
            else if (entry.win_rate > 0.55 && entry.total_rounds > 10) type = 'Consistent';
            else if (entry.total_rounds > 20) type = 'Degen';
            
            return {
              name: entry.bot_name,
              pnl,
              roi,
              drawdown,
              type,
            };
          });
          setAgentStats(stats);
        }
        
        // Get REAL current round position data from bets
        const betsRes = await api.getCurrentRoundBets('BTCUSDT');
        if (betsRes.success && betsRes.data) {
          setPositionData({ 
            long: betsRes.data.long_bets?.length ?? 0, 
            short: betsRes.data.short_bets?.length ?? 0 
          });
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Calculate histogram data
  const histogramData = useMemo(() => {
    if (agentStats.length === 0) return [];
    
    const pnlValues = agentStats.map(s => s.pnl);
    const minPnL = Math.min(...pnlValues);
    const maxPnL = Math.max(...pnlValues);
    
    if (minPnL === maxPnL) return [];
    
    const bins = 20;
    const range = maxPnL - minPnL;
    const step = range / bins;

    const data = Array.from({ length: bins }, (_, i) => {
        const binMin = minPnL + (i * step);
        const binMax = binMin + step;
        const count = pnlValues.filter(v => v >= binMin && (i === bins - 1 ? v <= binMax : v < binMax)).length;
        
        const formatK = (n: number) => `$${(n/1000).toFixed(1)}k`;
        return {
            range: `${formatK(binMin)} ~ ${formatK(binMax)}`,
            count,
            min: binMin,
            max: binMax,
            mid: (binMin + binMax) / 2
        };
    });
    return data;
  }, [agentStats]);

  const winners = agentStats.filter(d => d.pnl > 0).length;
  const losers = agentStats.length - winners;
  const totalPnL = agentStats.reduce((acc, curr) => acc + curr.pnl, 0);
  
  const longPercent = positionData.long + positionData.short > 0 
    ? ((positionData.long / (positionData.long + positionData.short)) * 100).toFixed(1)
    : '50';
  const shortPercent = (100 - parseFloat(longPercent)).toFixed(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left Column: Market Sentiment & Quick Stats */}
        <div className="lg:col-span-1 space-y-6">
            {/* 1. Agent Positions - Platform Internal Data */}
            <div className="fintech-card p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-sm relative overflow-hidden h-[180px] flex flex-col justify-between">
                 <div className="flex justify-between items-center">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} /> Agent Positions
                    </h3>
                    <div className="px-2 py-1 bg-white/5 rounded text-[10px] text-zinc-500 font-mono">Current Round</div>
                 </div>

                 <div className="flex items-end justify-between px-2">
                    <div className="text-center">
                        <div className="text-3xl font-black text-[#FF5722] tracking-tighter">
                          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : positionData.long}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-500 mt-1 uppercase">Long</div>
                    </div>
                    
                    <div className="flex-1 mx-4 pb-2">
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                            <div style={{ width: `${longPercent}%` }} className="h-full bg-[#FF5722] shadow-[0_0_10px_rgba(32,230,150,0.5)]" />
                            <div style={{ width: `${shortPercent}%` }} className="h-full bg-[#FF4D4D]" />
                        </div>
                         <div className="flex justify-between mt-1 text-[8px] font-mono text-zinc-600 uppercase">
                            <span>{longPercent}%</span>
                            <span>{shortPercent}%</span>
                        </div>
                    </div>

                    <div className="text-center">
                         <div className="text-3xl font-black text-[#FF4D4D] tracking-tighter">
                           {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : positionData.short}
                         </div>
                        <div className="text-[10px] font-bold text-zinc-500 mt-1 uppercase">Short</div>
                    </div>
                 </div>
            </div>

            {/* 2. Platform Performance */}
            <div className="fintech-card p-5 rounded-3xl border border-white/5 bg-black/30 backdrop-blur-sm relative overflow-hidden group h-[160px] flex flex-col justify-between">
                <div className="flex justify-between items-center">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        Win/Loss Ratio
                    </h3>
                    <span className="text-[10px] text-zinc-600 font-mono">All Time</span>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="text-center">
                        <div className="text-2xl font-black text-[#FF5722]">{loading ? '-' : winners}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Winners</div>
                    </div>
                    
                    <div className="flex-1 mx-4">
                        {/* Visual Win/Loss bars */}
                        {!loading && agentStats.length > 0 ? (
                          <div className="flex gap-1 justify-center">
                              {agentStats.slice(0, 10).map((a, i) => (
                                  <div 
                                      key={i} 
                                      className={`w-2 h-8 rounded-sm ${a.pnl > 0 ? 'bg-[#FF5722]' : 'bg-[#FF4D4D]'}`}
                                  />
                              ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-8">
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                          </div>
                        )}
                        <div className="text-center mt-2 text-[10px] text-zinc-500 font-mono">
                            Top 10 Agents
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <div className="text-2xl font-black text-[#FF4D4D]">{loading ? '-' : losers}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Losers</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Column: Advanced Charts */}
        <div className="lg:col-span-2">
            <div className="fintech-card h-full min-h-[360px] p-1 rounded-3xl border border-white/5 bg-black/40 backdrop-blur-sm flex flex-col">
                {/* Tabs Header */}
                <div className="flex p-2 gap-2 mb-2 bg-black/20 rounded-t-3xl">
                     <button 
                        onClick={() => setActiveTab("distribution")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border border-transparent ${activeTab === 'distribution' ? 'bg-white/10 text-white border-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                     >
                        PNL DISTRIBUTION
                     </button>
                     <button 
                        onClick={() => setActiveTab("risk-reward")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border border-transparent ${activeTab === 'risk-reward' ? 'bg-white/10 text-white border-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                     >
                        RISK vs REWARD
                     </button>
                </div>

                {/* Chart Area */}
                <div className="flex-1 w-full p-4 relative min-h-[300px]">
                    {loading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                      </div>
                    ) : agentStats.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-zinc-500 text-sm">No agent data available</p>
                      </div>
                    ) : (
                      <>
                        {activeTab === 'risk-reward' && (
                            <>
                                <div className="absolute top-4 left-4 z-10 text-[10px] text-zinc-500 font-mono border border-white/5 bg-black/50 p-2 rounded backdrop-blur">
                                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-[#FF5722]"></span> Alpha</div>
                                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Degen</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#FF4D4D]"></span> Rekt</div>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.5} />
                                        <XAxis 
                                            type="number" 
                                            dataKey="drawdown" 
                                            name="Max Drawdown" 
                                            unit="%" 
                                            stroke="#555" 
                                            tick={{fontSize: 10, fill: '#777'}}
                                            tickLine={false}
                                            axisLine={false}
                                            label={{ value: 'Risk (Max Drawdown)', position: 'bottom', fill: '#555', fontSize: 10 }}
                                        />
                                        <YAxis 
                                            type="number" 
                                            dataKey="roi" 
                                            name="ROI" 
                                            unit="%" 
                                            stroke="#555" 
                                            tick={{fontSize: 10, fill: '#777'}}
                                            tickLine={false}
                                            axisLine={false}
                                            label={{ value: 'Reward (ROI)', angle: -90, position: 'left', fill: '#555', fontSize: 10 }}
                                        />
                                        <RechartsTooltip content={<ScatterCustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                        <Scatter name="Agents" data={agentStats} fill="#8884d8">
                                            {agentStats.map((entry, index) => {
                                                let fill = "#555"; 
                                                if (entry.type === "Alpha") fill = "#FF5722";
                                                else if (entry.type === "Degen") fill = "#A855F7";
                                                else if (entry.type === "Rekt") fill = "#FF4D4D";
                                                else if (entry.pnl > 0) fill = "#FF572280";
                                                
                                                return <Cell key={`cell-${index}`} fill={fill} fillOpacity={0.8} strokeWidth={0} />;
                                            })}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </>
                        )}

                        {activeTab === 'distribution' && histogramData.length > 0 && (
                            <div className="w-full h-full flex flex-col">
                                 <div className="flex justify-between items-center mb-2 px-2">
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Total PnL: <span className={totalPnL >= 0 ? 'text-[#FF5722]' : 'text-[#FF4D4D]'}>${(totalPnL/1000).toFixed(1)}k</span>
                                    </div>
                                    <div className="flex gap-3 text-[10px] font-mono">
                                        <span className="text-[#FF5722]">{winners} Winners</span>
                                        <span className="text-[#FF4D4D]">{losers} Losers</span>
                                    </div>
                                 </div>
                                 <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={histogramData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} barGap={2}>
                                            <ReferenceLine x={0} stroke="#333" strokeDasharray="3 3" />
                                            <RechartsTooltip content={<HistogramTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                                                {histogramData.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={entry.mid > 0 ? '#FF5722' : '#FF4D4D'} 
                                                        fillOpacity={0.8}
                                                    />
                                                ))}
                                            </Bar>
                                            <XAxis 
                                                dataKey="range" 
                                                stroke="#555" 
                                                tick={{fontSize: 8, fill: '#777'}} 
                                                interval={4}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                 </div>
                            </div>
                        )}
                        
                        {activeTab === 'distribution' && histogramData.length === 0 && (
                          <div className="w-full h-full flex items-center justify-center">
                            <p className="text-zinc-500 text-sm">Not enough data for distribution chart</p>
                          </div>
                        )}
                      </>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
