'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import api, { DanmakuItem } from '@/lib/api';

interface DanmakuMessage {
  id: string;
  text: string;
  top: number; // 垂直位置 (vh 单位)
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

const ANIMATION_DURATION = 12000; // 弹幕飘动时长 ms
const POLL_INTERVAL = 3000; // API 轮询间隔 ms

// 弹幕垂直分布范围（vh 单位）
const TRACK_MIN_VH = 12;
const TRACK_MAX_VH = 75;

// 间隔配置（防止太密集）
const MIN_INTERVAL_MS = 800;   // 最小间隔（用于添加弹幕的节流）

// 动态间隔配置（根据池子大小调整循环速度）
const INTERVAL_CONFIG = {
  small: { min: 4000, max: 8000 },   // 池子 < 10 条
  medium: { min: 2000, max: 4000 },  // 池子 10-30 条
  large: { min: 1000, max: 2500 },   // 池子 > 30 条
};

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
  const lastDanmakuPollIdRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 存储当前轮的 API 弹幕（用于循环展示）
  const apiDanmakuPoolRef = useRef<DanmakuItem[]>([]);
  const apiLoopIndexRef = useRef(0);
  const apiLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 上次添加弹幕的时间（防止太密集）
  const lastAddTimeRef = useRef(0);
  
  // 用于递归调用的函数引用
  const showNextApiDanmakuRef = useRef<() => void>(() => {});
  const showNextMockDanmakuRef = useRef<() => void>(() => {});

  // 随机垂直位置
  const getRandomTop = useCallback(() => {
    return TRACK_MIN_VH + Math.random() * (TRACK_MAX_VH - TRACK_MIN_VH);
  }, []);

  // 根据池子大小获取动态间隔
  const getDynamicInterval = useCallback((poolSize: number) => {
    let config;
    if (poolSize < 10) {
      config = INTERVAL_CONFIG.small;
    } else if (poolSize <= 30) {
      config = INTERVAL_CONFIG.medium;
    } else {
      config = INTERVAL_CONFIG.large;
    }
    return config.min + Math.random() * (config.max - config.min);
  }, []);

  // 添加弹幕到显示列表
  const addMessage = useCallback((text: string, color?: string, customId?: string) => {
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
      color: color || '#ffffff',
      createdAt: now,
    };

    setMessages(prev => [...prev, newMessage]);

    // 动画结束后移除弹幕
    const timeoutId = window.setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== newMessage.id));
    }, ANIMATION_DURATION);
    timeoutsRef.current.push(timeoutId);
  }, [getRandomTop]);

  // 处理从 danmaku API 获取的弹幕，添加到池中
  const processDanmaku = useCallback((items: DanmakuItem[]) => {
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
    
    // 池子为空时，等待后重试（保持循环不中断）
    if (pool.length === 0) {
      apiLoopTimeoutRef.current = setTimeout(() => showNextApiDanmakuRef.current(), 2000);
      return;
    }

    // 获取当前索引的弹幕
    const item = pool[apiLoopIndexRef.current % pool.length];
    
    addMessage(
      item.content,
      item.color || '#ffffff',
      `dmk-loop-${item.id}-${Date.now()}`
    );

    // 移动到下一个
    apiLoopIndexRef.current = (apiLoopIndexRef.current + 1) % pool.length;

    // 根据池子大小动态调整间隔（池子越小，间隔越大，减少重复感）
    const nextInterval = getDynamicInterval(pool.length);
    apiLoopTimeoutRef.current = setTimeout(() => showNextApiDanmakuRef.current(), nextInterval);
  }, [addMessage, getDynamicInterval]);

  // 更新 ref 以便递归调用
  useEffect(() => {
    showNextApiDanmakuRef.current = showNextApiDanmaku;
  }, [showNextApiDanmaku]);

  // 轮询 API 获取新弹幕（只轮询 danmaku API）
  const pollApi = useCallback(async () => {
    if (!symbol || !Number.isFinite(roundId) || roundId <= 0) return;

    try {
      const response = await api.pollDanmaku(symbol, lastDanmakuPollIdRef.current);

      if (response.success && response.data) {
        const { items, last_id } = response.data;
        if (items.length > 0) {
          processDanmaku(items);
          lastDanmakuPollIdRef.current = last_id;
        }
      }
    } catch (err) {
      console.error('[Danmaku] Poll error:', err);
    }
  }, [symbol, roundId, processDanmaku]);

  // Mock 弹幕循环展示
  const showNextMockDanmaku = useCallback(() => {
    if (!useMockFallback) return;
    
    const randomMsg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
    addMessage(randomMsg);

    // 随机间隔（基础间隔 + 随机偏移）
    const nextInterval = MOCK_BASE_INTERVAL_MS + Math.random() * 2000;
    mockTimeoutRef.current = setTimeout(() => showNextMockDanmakuRef.current(), nextInterval);
  }, [addMessage, useMockFallback]);

  // 更新 ref 以便递归调用
  useEffect(() => {
    showNextMockDanmakuRef.current = showNextMockDanmaku;
  }, [showNextMockDanmaku]);

  // 主 effect：管理轮询和循环展示
  useEffect(() => {
    if (!enabled || !symbol || !Number.isFinite(roundId) || roundId <= 0) {
      setMessages([]);
      return;
    }

    // 重置状态（新轮次）
    setMessages([]);
    lastDanmakuPollIdRef.current = 0;
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
          addMessage(randomMsg);
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
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden danmaku-container">
      {messages.map(msg => (
        <div
          key={msg.id}
          className="absolute whitespace-nowrap animate-danmaku danmaku-text"
          style={{
            top: `${msg.top}vh`,
            animationDuration: `${ANIMATION_DURATION}ms`,
            color: msg.color || '#ffffff',
          }}
        >
          <span className="text-lg font-semibold">
            {msg.text}
          </span>
        </div>
      ))}
    </div>
  );
}
