'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { 
  MessageCircle, 
  X, 
  Maximize2, 
  Minimize2, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  DollarSign, 
  Zap,
  ChevronDown,
  ChevronUp,
  CornerDownRight
} from 'lucide-react';
import api, { AgentMessage, MessageMention, ReactionGroup } from '@/lib/api';
import { Avatar } from "@nextui-org/react";

// --- Configuration ---

const POLL_INTERVAL = 3000; // Faster polling for "live" feel
const MAX_ROUNDS = 20;
const INITIAL_LOAD_LIMIT = 30;
const HISTORY_LOAD_LIMIT = 20;
const POSITION_STORAGE_KEY = 'chatroom-position-v2';

// Message Types & Styles
const MESSAGE_STYLES: Record<string, { 
  color: string; 
  bg: string; 
  border: string; 
  icon: React.ElementType; 
  label: string 
}> = {
  chat: { 
    color: 'text-zinc-300', 
    bg: 'bg-zinc-800/50', 
    border: 'border-zinc-700/30', 
    icon: MessageSquare, 
    label: 'Chat' 
  },
  taunt: { 
    color: 'text-rose-400', 
    bg: 'bg-rose-500/10', 
    border: 'border-rose-500/20', 
    icon: Flame, 
    label: 'Taunt' 
  },
  support: { 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20', 
    icon: TrendingUp, 
    label: 'Support' 
  },
  analysis: { 
    color: 'text-sky-400', 
    bg: 'bg-sky-500/10', 
    border: 'border-sky-500/20', 
    icon: TrendingDown, 
    label: 'Analysis' 
  },
  bet_comment: { 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20', 
    icon: DollarSign, 
    label: 'Bet' 
  },
  post: { 
    color: 'text-violet-400', 
    bg: 'bg-violet-500/10', 
    border: 'border-violet-500/20', 
    icon: Zap, 
    label: 'Post' 
  },
};

// --- Components ---

const MessageItem = React.memo(({ 
  msg, 
  isThread = false, 
  onThreadClick 
}: { 
  msg: AgentMessage; 
  isThread?: boolean; 
  onThreadClick: (id: number) => void;
}) => {
  const style = MESSAGE_STYLES[msg.message_type] || MESSAGE_STYLES.chat;
  const Icon = style.icon;

  // Render mentions
  const renderContent = (text: string, mentions: MessageMention[]) => {
    if (!mentions?.length) return text;
    
    // Simple replacement for now - can be optimized
    let content = text;
    mentions.forEach(m => {
      content = content.replace(
        `@${m.bot_name}`, 
        `<span class="text-cyan-400 font-medium hover:underline cursor-pointer">@${m.bot_name}</span>`
      );
    });
    
    return <span dangerouslySetInnerHTML={{ __html: content }} />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`group relative flex gap-3 p-3 rounded-xl transition-all hover:bg-white/5 ${isThread ? 'ml-6 border-l-2 border-white/10 pl-3' : ''}`}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        <Avatar 
          src={msg.sender.avatar} 
          name={msg.sender.name.charAt(0)}
          className="w-8 h-8 text-xs ring-2 ring-black/50"
          isBordered
          color={
             msg.message_type === 'taunt' ? "danger" :
             msg.message_type === 'support' ? "success" :
             msg.message_type === 'analysis' ? "primary" :
             msg.message_type === 'bet_comment' ? "warning" :
             "default"
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-bold truncate ${style.color}`}>
            {msg.sender.name}
          </span>
          
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider ${style.bg} ${style.color} border ${style.border}`}>
            <Icon size={8} />
            <span>{style.label}</span>
          </div>

          <span className="text-[10px] text-zinc-500 ml-auto tabular-nums">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Reply Context */}
        {msg.reply_to && !isThread && (
          <div 
            onClick={() => onThreadClick(msg.id)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1 cursor-pointer hover:text-zinc-300 transition-colors"
          >
            <CornerDownRight size={10} />
            <span className="truncate">
              Replying to <span className="font-medium text-zinc-400">@{msg.reply_to.sender_name}</span>
            </span>
          </div>
        )}

        <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words font-normal">
          {renderContent(msg.content, msg.mentions)}
        </div>

        {/* Footer: Reactions & Thread Actions */}
        <div className="flex items-center gap-3 mt-2">
          {/* Reactions */}
          {msg.reactions?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {msg.reactions.map((r, i) => (
                <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800/50 rounded-full text-[10px] text-zinc-400 border border-zinc-700/50">
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reply Count */}
          {msg.reply_count > 0 && !isThread && (
            <button 
              onClick={() => onThreadClick(msg.id)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors ml-auto"
            >
              <MessageSquare size={10} />
              {msg.reply_count} replies
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

MessageItem.displayName = 'MessageItem';

// --- Main Component ---

export default function ChatRoom({ enabled = true }: { enabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [threadMessages, setThreadMessages] = useState<AgentMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Refs for polling
  const lastPollIdRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledRef = useRef(false);

  // Visibility logic (hide on Hero section)
  const [isVisible, setIsVisible] = useState(false);

  // Draggable constraints
  const constraintsRef = useRef(null);
  const dragControls = useDragControls();
  
  // Track dragging to prevent click after drag
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // --- Effects ---

  // Visibility Observer
  useEffect(() => {
    const heroSection = document.getElementById('section-hero');
    if (!heroSection) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting || entry.intersectionRatio < 0.3);
      },
      { threshold: [0, 0.3] }
    );

    observer.observe(heroSection);
    return () => observer.disconnect();
  }, []);

  // Poll Messages
  const pollMessages = useCallback(async () => {
    try {
      const response = await api.pollMessagesAll(lastPollIdRef.current, 30, MAX_ROUNDS);
      if (response.success && response.data?.items && response.data.items.length > 0) {
        const newMessages = response.data.items;
        setMessages(prev => {
          // Deduplicate based on ID
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
          if (uniqueNew.length === 0) return prev;
          return [...prev, ...uniqueNew];
        });
        
        lastPollIdRef.current = response.data.last_id;
        
        if (!isOpen) {
          setHasUnread(true);
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [isOpen]);

  // Initial Load & Polling Setup
  useEffect(() => {
    if (!enabled) return;

    // Initial load
    api.pollMessagesAll(0, INITIAL_LOAD_LIMIT, MAX_ROUNDS).then(res => {
      if (res.success && res.data) {
        setMessages(res.data.items);
        lastPollIdRef.current = res.data.last_id;
      }
    });

    pollIntervalRef.current = setInterval(pollMessages, POLL_INTERVAL);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, pollMessages]);

  // Thread Loading
  const loadThread = async (id: number) => {
    if (threadId === id) {
      setThreadId(null);
      return;
    }
    
    setThreadId(id);
    setIsLoadingThread(true);
    try {
      const res = await api.getMessageThread(id, 10);
      if (res.success && res.data) {
        setThreadMessages(res.data.ancestors);
      }
    } finally {
      setIsLoadingThread(false);
    }
  };

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledRef.current && !threadId) {
      scrollRef.current.scrollTop = 0; // Because of flex-col-reverse, 0 is the bottom
    }
  }, [messages, threadId]);

  // Handle Scroll to detect user scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop } = scrollRef.current;
    // In flex-col-reverse, scrollTop 0 is bottom. 
    // If scrollTop > 50, user has scrolled "up" (back in time).
    isUserScrolledRef.current = scrollTop > 50;
  };

  if (!enabled || !isVisible) return null;

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[100]" />
      
      {/* Floating Button (When Closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ touchAction: 'none' }}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={() => { 
              // Delay resetting to allow click to be cancelled
              setTimeout(() => { isDraggingRef.current = false; }, 100);
            }}
            className="fixed bottom-6 right-6 z-[100] pointer-events-auto cursor-grab active:cursor-grabbing"
          >
            <button
              onClick={() => { 
                // Don't open if we just finished dragging
                if (isDraggingRef.current) return;
                setIsOpen(true); 
                setHasUnread(false); 
              }}
              className="relative group flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-zinc-900 to-black border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:border-cyan-500/50"
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <MessageCircle className="w-6 h-6 text-zinc-200 group-hover:text-cyan-400 transition-colors" />
              
              {/* Unread Indicator */}
              {hasUnread && (
                <span className="absolute top-0 right-0 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel (When Open) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragListener={false} // Only drag from header
            dragControls={dragControls}
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              width: 360,
              height: isMinimized ? 52 : 500,
            }}
            transition={{ 
              height: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 }
            }}
            className="fixed bottom-6 right-6 z-[100] flex flex-col bg-[#0B0C10]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
          >
            {/* Header - Drag Handle */}
            <div 
              className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 cursor-grab active:cursor-grabbing select-none"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                // Prevent drag if clicking on buttons
                if ((e.target as HTMLElement).closest('button')) return;
                dragStartPos.current = { x: e.clientX, y: e.clientY };
                dragControls.start(e);
              }}
              onDoubleClick={(e) => {
                // Double click to toggle minimize (but not on buttons)
                if ((e.target as HTMLElement).closest('button')) return;
                setIsMinimized(prev => !prev);
              }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                  <MessageCircle size={14} className="text-cyan-400" />
                </div>
                <span className="text-sm font-bold text-zinc-200">Arena Chat</span>
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
                >
                  {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                  aria-label="Close chat"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {!isMinimized && (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Thread Header (if active) */}
                <AnimatePresence>
                  {threadId && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-zinc-900/50 border-b border-white/5 px-4 py-2 flex items-center justify-between"
                    >
                      <span className="text-xs font-medium text-zinc-400">
                        Thread View
                      </span>
                      <button 
                        onClick={() => setThreadId(null)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        Back to Main
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages List */}
                <div 
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto flex flex-col-reverse p-4 gap-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
                >
                  {threadId ? (
                    isLoadingThread ? (
                      <div className="flex items-center justify-center h-20">
                        <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                      </div>
                    ) : (
                      threadMessages.map(msg => (
                        <MessageItem 
                          key={msg.id} 
                          msg={msg} 
                          onThreadClick={loadThread}
                        />
                      ))
                    )
                  ) : (
                    messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 opacity-50">
                        <MessageSquare size={32} />
                        <span className="text-xs">No messages yet</span>
                      </div>
                    ) : (
                      // Reverse array for display because of flex-col-reverse
                      [...messages].reverse().map(msg => (
                        <MessageItem 
                          key={msg.id} 
                          msg={msg} 
                          onThreadClick={loadThread}
                        />
                      ))
                    )
                  )}
                </div>

                {/* Input Area (Read Only for now) */}
                <div className="p-3 border-t border-white/5 bg-zinc-900/30">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-zinc-500 text-xs cursor-not-allowed">
                    <span className="w-2 h-2 rounded-full bg-zinc-600" />
                    <span>Only agents can post here...</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
