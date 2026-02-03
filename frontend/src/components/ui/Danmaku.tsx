'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api, { DanmakuItem } from '@/lib/api';

interface DanmakuMessage {
  id: string;
  text: string;
  top: number; // 垂直位置 (vh 单位)
  color?: string;
  createdAt: number;
  isApi: boolean; // 是否来自 API（用于区分 mock）
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

const ANIMATION_DURATION = 12000; // 弹幕飘动时长 ms
const POLL_INTERVAL = 3000; // API 轮询间隔 ms

// 弹幕垂直分布范围（vh 单位）
const TRACK_MIN_VH = 12;
const TRACK_MAX_VH = 75;

// 间隔配置（防止太密集）
const MIN_INTERVAL_MS = 800;   // 最小间隔
const MAX_INTERVAL_MS = 2500;  // 最大间隔
const MOCK_BASE_INTERVAL_MS = 4000; // Mock 弹幕基础间隔

interface DanmakuProps {
  enabled: boolean;
  symbol: string;
  roundId: number;
  useMockFallback?: boolean;
}

export default function Danmaku({ 
  enabled, 
  symbol, 
  roundId, 
  useMockFallback = true 
}: DanmakuProps) {
  const [messages, setMessages] = useState<DanmakuMessage[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const lastPollIdRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 存储当前轮的 API 弹幕（用于循环展示）
  const apiDanmakuPoolRef = useRef<DanmakuItem[]>([]);
  const apiLoopIndexRef = useRef(0);
  const apiLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 上次添加弹幕的时间（防止太密集）
  const lastAddTimeRef = useRef(0);

  // 随机垂直位置
  const getRandomTop = useCallback(() => {
    return TRACK_MIN_VH + Math.random() * (TRACK_MAX_VH - TRACK_MIN_VH);
  }, []);

  // 随机间隔
  const getRandomInterval = useCallback(() => {
    return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
  }, []);

  // 添加弹幕到显示列表
  const addMessage = useCallback((text: string, color?: string, isApi = false, customId?: string) => {
    // 防止太密集
    const now = Date.now();
    const timeSinceLast = now - lastAddTimeRef.current;
    if (timeSinceLast < MIN_INTERVAL_MS) {
      return; // 跳过这条，太密集了
    }
    lastAddTimeRef.current = now;

    const newMessage: DanmakuMessage = {
      id: customId || `danmaku-${now}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      top: getRandomTop(),
      color,
      createdAt: now,
      isApi,
    };

    setMessages(prev => [...prev, newMessage]);

    // 动画结束后移除弹幕
    const timeoutId = window.setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== newMessage.id));
    }, ANIMATION_DURATION);
    timeoutsRef.current.push(timeoutId);
  }, [getRandomTop]);

  // 处理从 API 获取的新弹幕，添加到池中
  const processApiDanmaku = useCallback((items: DanmakuItem[]) => {
    if (items.length === 0) return;
    
    // 添加新弹幕到池中（去重）
    const existingIds = new Set(apiDanmakuPoolRef.current.map(d => d.id));
    const newItems = items.filter(item => !existingIds.has(item.id));
    
    if (newItems.length > 0) {
      apiDanmakuPoolRef.current = [...apiDanmakuPoolRef.current, ...newItems];
    }
  }, []);

  // 从 API 弹幕池中循环展示
  const showNextApiDanmaku = useCallback(() => {
    const pool = apiDanmakuPoolRef.current;
    if (pool.length === 0) return;

    // 获取当前索引的弹幕
    const item = pool[apiLoopIndexRef.current % pool.length];
    const displayText = item.nickname 
      ? `${item.nickname}: ${item.content}`
      : item.content;
    
    addMessage(displayText, item.color || undefined, true, `api-loop-${item.id}-${Date.now()}`);

    // 移动到下一个
    apiLoopIndexRef.current = (apiLoopIndexRef.current + 1) % pool.length;

    // 随机间隔后显示下一条
    const nextInterval = getRandomInterval();
    apiLoopTimeoutRef.current = setTimeout(showNextApiDanmaku, nextInterval);
  }, [addMessage, getRandomInterval]);

  // 轮询 API 获取新弹幕
  const pollApi = useCallback(async () => {
    if (!symbol || !Number.isFinite(roundId) || roundId <= 0) return;

    try {
      const response = await api.pollDanmaku(symbol, lastPollIdRef.current);
      if (response.success && response.data) {
        const { items, last_id } = response.data;
        if (items.length > 0) {
          processApiDanmaku(items);
          lastPollIdRef.current = last_id;
        }
      }
    } catch (err) {
      console.error('[Danmaku] Poll error:', err);
    }
  }, [symbol, roundId, processApiDanmaku]);

  // Mock 弹幕循环展示
  const showNextMockDanmaku = useCallback(() => {
    if (!useMockFallback) return;
    
    const randomMsg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
    addMessage(randomMsg, undefined, false);

    // 随机间隔（基础间隔 + 随机偏移）
    const nextInterval = MOCK_BASE_INTERVAL_MS + Math.random() * 2000;
    mockTimeoutRef.current = setTimeout(showNextMockDanmaku, nextInterval);
  }, [addMessage, useMockFallback]);

  // 主 effect：管理轮询和循环展示
  useEffect(() => {
    if (!enabled || !symbol || !Number.isFinite(roundId) || roundId <= 0) {
      setMessages([]);
      return;
    }

    // 重置状态（新轮次）
    setMessages([]);
    lastPollIdRef.current = 0;
    lastAddTimeRef.current = 0;
    apiDanmakuPoolRef.current = []; // 清空上一轮的弹幕池
    apiLoopIndexRef.current = 0;
    
    // 清理所有定时器
    timeoutsRef.current.forEach(t => window.clearTimeout(t));
    timeoutsRef.current = [];
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (mockTimeoutRef.current) {
      clearTimeout(mockTimeoutRef.current);
      mockTimeoutRef.current = null;
    }
    if (apiLoopTimeoutRef.current) {
      clearTimeout(apiLoopTimeoutRef.current);
      apiLoopTimeoutRef.current = null;
    }

    // 立即执行一次轮询
    pollApi();

    // 启动 API 轮询
    pollIntervalRef.current = setInterval(pollApi, POLL_INTERVAL);

    // 启动 API 弹幕循环展示（延迟启动，等待首次轮询）
    setTimeout(() => {
      showNextApiDanmaku();
    }, 2000);

    // 启动 Mock 弹幕（如果启用）
    if (useMockFallback) {
      // 初始发几条（随机延迟）
      const initialDelays = [500, 2000, 4500];
      initialDelays.forEach(delay => {
        const timeoutId = window.setTimeout(() => {
          const randomMsg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
          addMessage(randomMsg, undefined, false);
        }, delay);
        timeoutsRef.current.push(timeoutId);
      });

      // 启动 Mock 循环
      mockTimeoutRef.current = setTimeout(showNextMockDanmaku, MOCK_BASE_INTERVAL_MS);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (mockTimeoutRef.current) {
        clearTimeout(mockTimeoutRef.current);
        mockTimeoutRef.current = null;
      }
      if (apiLoopTimeoutRef.current) {
        clearTimeout(apiLoopTimeoutRef.current);
        apiLoopTimeoutRef.current = null;
      }
      timeoutsRef.current.forEach(t => window.clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [enabled, roundId, symbol, pollApi, showNextApiDanmaku, showNextMockDanmaku, addMessage, useMockFallback]);

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
              top: `${msg.top}vh`,
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
