'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface DanmakuMessage {
  id: string;
  text: string;
  track: number; // 轨道 0-4
  color?: string;
  createdAt: number;
}

// Mock 弹幕数据，模拟热闹氛围
const MOCK_MESSAGES = [
  "BTC to the moon! 🚀",
  "熊来了，快跑！",
  "LONG 一把梭！",
  "这波肯定涨",
  "Short it!",
  "又被割了...",
  "牛回速归",
  "加密永不眠",
  "Diamond hands 💎",
  "买在山顶了",
  "抄底抄在半山腰",
  "这波我看多",
  "空军出击！",
  "RSI 超买了",
  "突破了！",
  "假突破吧",
  "庄家在洗盘",
  "上车！",
  "下车！",
  "Hold!",
  "All in!",
  "要爆仓了",
  "稳住别慌",
  "这是最后一跌",
  "牛市来了",
];

const TRACK_COUNT = 10; // 增加轨道数量
const ANIMATION_DURATION = 12000; // 弹幕飘动时长 ms
const MOCK_INTERVAL = 3000; // Mock 弹幕发送间隔 ms

// 弹幕垂直分布范围（vh 单位）
const TRACK_START_VH = 12; // 起始位置（约 80-100px）
const TRACK_END_VH = 75;   // 结束位置
const TRACK_GAP_VH = (TRACK_END_VH - TRACK_START_VH) / (TRACK_COUNT - 1);

interface DanmakuProps {
  enabled: boolean;
  symbol: string; // 展示用，例如 "BTC/USDT"
  roundId: number;
}

export default function Danmaku({ enabled, symbol, roundId }: DanmakuProps) {
  const [messages, setMessages] = useState<DanmakuMessage[]>([]);
  const trackLastUsedRef = useRef<number[]>(Array(TRACK_COUNT).fill(0));
  const messageIdRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  // 选择一个可用的轨道（最久没使用的）
  const selectTrack = useCallback(() => {
    const now = Date.now();
    let minTime = Infinity;
    let selectedTrack = 0;

    for (let i = 0; i < TRACK_COUNT; i++) {
      if (trackLastUsedRef.current[i] < minTime) {
        minTime = trackLastUsedRef.current[i];
        selectedTrack = i;
      }
    }

    trackLastUsedRef.current[selectedTrack] = now;
    return selectedTrack;
  }, []);

  // 添加弹幕
  const addMessage = useCallback((text: string, color?: string) => {
    const track = selectTrack();
    const newMessage: DanmakuMessage = {
      id: `danmaku-${messageIdRef.current++}`,
      text,
      track,
      color,
      createdAt: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);

    // 动画结束后移除弹幕
    const timeoutId = window.setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== newMessage.id));
    }, ANIMATION_DURATION);
    timeoutsRef.current.push(timeoutId);
  }, [selectTrack]);

  // Mock 弹幕定时发送
  useEffect(() => {
    // 只在 Arena 激活且 round/symbol 有效时运行
    if (!enabled || !symbol || !Number.isFinite(roundId) || roundId <= 0) {
      setMessages([]);
      return;
    }

    // 上下文变化时，清空旧弹幕/定时器
    setMessages([]);
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];

    const pickMockMessage = () => {
      const randomMsg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
      return randomMsg;
    };

    // 初始发几条
    const initialDelay = [500, 1500, 2500];
    initialDelay.forEach((delay) => {
      const timeoutId = window.setTimeout(() => {
        addMessage(pickMockMessage());
      }, delay);
      timeoutsRef.current.push(timeoutId);
    });

    // 定时发送 Mock 弹幕
    const intervalId = window.setInterval(() => {
      addMessage(pickMockMessage());
    }, MOCK_INTERVAL);

    return () => {
      window.clearInterval(intervalId);
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [addMessage, enabled, roundId, symbol]);

  if (!enabled) return null;

  return (
    <>
      {/* 弹幕展示层 - 覆盖整个页面 */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden danmaku-container">
        {messages.map(msg => (
          <div
            key={msg.id}
            className="absolute whitespace-nowrap text-xl font-bold animate-danmaku danmaku-text"
            style={{
              top: `${TRACK_START_VH + msg.track * TRACK_GAP_VH}vh`, // 均匀分布在 12vh ~ 68vh
              color: msg.color || '#ffffff',
              animationDuration: `${ANIMATION_DURATION}ms`,
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>
    </>
  );
}
