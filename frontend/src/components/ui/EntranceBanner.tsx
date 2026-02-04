'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { TrendingUp, TrendingDown, Flame, Skull } from 'lucide-react';
import { getStreakInfo, generateEntranceMessage, getEntranceBannerGradient, STREAK_THRESHOLDS } from '@/lib/streak';

export interface EntranceEvent {
  id: string;
  botId: string;
  botName: string;
  avatar: string;
  streak: number;
  direction: 'long' | 'short';
  winRate?: number;
  timestamp: number;
}

interface EntranceBannerProps {
  /** 新进场事件的数组，组件会自动检测新事件并播放 */
  events: EntranceEvent[];
  /** 播报显示时长（毫秒），默认 4000 */
  duration?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

// 播放队列中的一条
interface QueueItem extends EntranceEvent {
  message: string;
  gradient: string;
  streakInfo: ReturnType<typeof getStreakInfo>;
}

export default function EntranceBanner({ 
  events, 
  duration = 4000,
  enabled = true 
}: EntranceBannerProps) {
  const [currentBanner, setCurrentBanner] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const queueRef = useRef<QueueItem[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 播放下一个队列中的播报
  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      setCurrentBanner(null);
      return;
    }

    const next = queueRef.current.shift()!;
    setCurrentBanner(next);
    setIsPlaying(true);

    // 播放完成后处理下一个
    timeoutRef.current = setTimeout(() => {
      playNext();
    }, duration);
  }, [duration]);

  // 检测新事件并加入队列
  useEffect(() => {
    if (!enabled) return;

    for (const event of events) {
      // 跳过已处理的事件
      if (processedIdsRef.current.has(event.id)) continue;
      
      const streakInfo = getStreakInfo(event.streak);
      
      // 只有达到触发阈值才播报
      if (!streakInfo.style?.triggerEntrance) continue;

      processedIdsRef.current.add(event.id);

      const queueItem: QueueItem = {
        ...event,
        message: generateEntranceMessage(event.botName, event.streak, event.direction, event.winRate),
        gradient: getEntranceBannerGradient(event.streak),
        streakInfo,
      };

      queueRef.current.push(queueItem);
    }

    // 如果没有正在播放且队列有内容，开始播放
    if (!isPlaying && queueRef.current.length > 0) {
      playNext();
    }
  }, [events, enabled, isPlaying, playNext]);

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!enabled || !currentBanner) return null;

  const { streakInfo } = currentBanner;
  const isWinning = streakInfo.isWinning;

  return (
    <div className="fixed top-24 left-0 right-0 z-50 pointer-events-none flex justify-center px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner.id}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ 
            type: 'spring',
            stiffness: 100,
            damping: 20,
            mass: 1
          }}
          className="relative max-w-2xl w-full"
        >
          {/* 主横幅 */}
          <div 
            className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
            style={{ background: currentBanner.gradient }}
          >
            {/* 光泽流动效果 */}
            <div className="absolute inset-0 animate-entrance-shimmer opacity-50" />
            
            {/* 内容 */}
            <div className="relative px-6 py-4 flex items-center gap-4">
              {/* 头像 */}
              <div className="relative">
                <div 
                  className={`rounded-full ${streakInfo.style?.animationClass || ''}`}
                  style={streakInfo.style ? { boxShadow: streakInfo.style.avatarGlow } : undefined}
                >
                  <Avatar 
                    src={currentBanner.avatar} 
                    size="lg"
                    className={`${streakInfo.style?.avatarRing || ''} border-2 border-white/30`}
                  />
                </div>
                {/* 方向指示 */}
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full ${
                  currentBanner.direction === 'long' 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                }`}>
                  {currentBanner.direction === 'long' 
                    ? <TrendingUp size={12} className="text-white" />
                    : <TrendingDown size={12} className="text-white" />
                  }
                </div>
              </div>

              {/* 文字内容 */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg drop-shadow-lg leading-tight">
                  {currentBanner.message}
                </p>
                {currentBanner.winRate && (
                  <p className="text-white/80 text-sm mt-1 font-medium">
                    胜率 {currentBanner.winRate}% · {Math.abs(currentBanner.streak)} {isWinning ? '连胜' : '连败'}
                  </p>
                )}
              </div>

              {/* 右侧图标 */}
              <div className="flex flex-col items-center gap-1">
                {isWinning ? (
                  <Flame size={32} className="text-white fill-white animate-pulse drop-shadow-lg" />
                ) : (
                  <Skull size={32} className="text-white drop-shadow-lg" />
                )}
                <span className="text-white/90 text-xs font-bold">
                  {streakInfo.title?.emoji} x{Math.abs(currentBanner.streak)}
                </span>
              </div>
            </div>

            {/* 底部进度条 */}
            <motion.div 
              className="h-1 bg-white/50"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
            />
          </div>

          {/* 装饰粒子效果（仅高级别） */}
          {streakInfo.tier >= 7 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-2 h-2 rounded-full ${
                    isWinning ? 'bg-yellow-400' : 'bg-violet-400'
                  }`}
                  initial={{ 
                    x: '50%', 
                    y: '50%', 
                    scale: 0,
                    opacity: 1 
                  }}
                  animate={{ 
                    x: `${50 + (Math.random() - 0.5) * 100}%`,
                    y: `${50 + (Math.random() - 0.5) * 100}%`,
                    scale: [0, 1.5, 0],
                    opacity: [1, 1, 0]
                  }}
                  transition={{ 
                    duration: 1.5,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
