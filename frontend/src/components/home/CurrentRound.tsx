'use client'

import { Card, CardBody, Chip, Avatar, AvatarGroup, Tooltip } from "@nextui-org/react";
import { TrendingUp, TrendingDown, Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";

interface BotBet {
  id: number;
  name: string;
  avatar: string;
  score: number;
}

interface CurrentRoundProps {
  data: {
    id: number;
    displayName: string;
    price: number;
    openPrice: number;
    change: number;
    remainingSeconds: number;
    status: string;
  };
  bets: {
    long: BotBet[];
    short: BotBet[];
  };
}

export default function CurrentRound({ data, bets }: CurrentRoundProps) {
  const [timeLeft, setTimeLeft] = useState(data.remainingSeconds);

  useEffect(() => {
    setTimeLeft(data.remainingSeconds);
  }, [data]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isUp = data.change >= 0;
  const totalBots = bets.long.length + bets.short.length;
  const longPercentage = Math.round((bets.long.length / totalBots) * 100);

  return (
    <div className="space-y-6 my-8">
      {/* Price & Timer Header */}
      <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 shadow-xl overflow-hidden">
        <CardBody className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Chip color="success" variant="dot" className="pl-2">Live Round #{data.id}</Chip>
                <Chip variant="flat" size="sm" className="bg-zinc-800">{data.displayName}</Chip>
              </div>
              <h2 className="text-5xl font-bold mt-2 flex items-center gap-4">
                ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className={`text-2xl font-medium flex items-center ${isUp ? 'text-success' : 'text-danger'}`}>
                  {isUp ? <TrendingUp size={24} className="mr-1" /> : <TrendingDown size={24} className="mr-1" />} 
                  {isUp ? '+' : ''}{data.change}%
                </span>
              </h2>
              <p className="text-zinc-400 mt-2 text-lg">Open: ${data.openPrice.toLocaleString()}</p>
            </div>
            
            <div className="text-center md:text-right">
              <div className={`inline-flex items-center gap-3 font-mono text-4xl font-bold px-6 py-3 rounded-2xl transition-all
                ${timeLeft < 60 ? 'text-danger bg-danger/10 animate-pulse' : 'text-brand-primary bg-brand-primary/10'}`}>
                <Clock size={32} />
                {formatTime(timeLeft)}
              </div>
              <p className="text-zinc-500 text-sm mt-2">Until Settlement</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Battle Arena - Long vs Short */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Long Team */}
        <Card className="bg-success/5 border border-success/20 hover:border-success/40 transition-colors">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-success" size={24} />
                <h3 className="text-xl font-bold text-success">Long</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-success">{bets.long.length}</span>
                <span className="text-zinc-500 text-sm">bots</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <AvatarGroup max={5} total={bets.long.length} className="justify-start">
                {bets.long.map((bot) => (
                  <Tooltip key={bot.id} content={`${bot.name} (${bot.score} pts)`}>
                    <Avatar 
                      src={bot.avatar} 
                      size="md"
                      className="border-2 border-success/50"
                    />
                  </Tooltip>
                ))}
              </AvatarGroup>
              <div className="text-right">
                <p className="text-4xl font-bold text-success">{longPercentage}%</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-success/20">
              <p className="text-xs text-zinc-500">Top bettor: <span className="text-success font-medium">{bets.long[0]?.name}</span></p>
            </div>
          </CardBody>
        </Card>

        {/* Short Team */}
        <Card className="bg-danger/5 border border-danger/20 hover:border-danger/40 transition-colors">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="text-danger" size={24} />
                <h3 className="text-xl font-bold text-danger">Short</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-danger">{bets.short.length}</span>
                <span className="text-zinc-500 text-sm">bots</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <AvatarGroup max={5} total={bets.short.length} className="justify-start">
                {bets.short.map((bot) => (
                  <Tooltip key={bot.id} content={`${bot.name} (${bot.score} pts)`}>
                    <Avatar 
                      src={bot.avatar} 
                      size="md"
                      className="border-2 border-danger/50"
                    />
                  </Tooltip>
                ))}
              </AvatarGroup>
              <div className="text-right">
                <p className="text-4xl font-bold text-danger">{100 - longPercentage}%</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-danger/20">
              <p className="text-xs text-zinc-500">Top bettor: <span className="text-danger font-medium">{bets.short[0]?.name}</span></p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Battle Stats */}
      <Card className="bg-zinc-900/30 border border-white/5">
        <CardBody className="py-4 px-6">
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-brand-primary" />
              <span className="text-zinc-400">Total Bots:</span>
              <span className="font-bold">{totalBots}</span>
            </div>
            <div className="w-px h-4 bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">If price goes</span>
              <span className="text-success font-medium">UP → Long wins</span>
              <span className="text-zinc-600">|</span>
              <span className="text-danger font-medium">DOWN → Short wins</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
