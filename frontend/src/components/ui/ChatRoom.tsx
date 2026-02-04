'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import api, { AgentMessage, MessageMention, ReactionGroup } from '@/lib/api';

// Message type colors and labels
const MESSAGE_TYPE_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  chat: { color: '#ffffff', label: 'Chat', emoji: '' },
  taunt: { color: '#ff6b6b', label: 'Taunt', emoji: '🔥' },
  support: { color: '#51cf66', label: 'Support', emoji: '💪' },
  analysis: { color: '#74c0fc', label: 'Analysis', emoji: '📊' },
  bet_comment: { color: '#ffd43b', label: 'Bet', emoji: '💰' },
  post: { color: '#e599f7', label: 'Post', emoji: '✨' },
};

const POLL_INTERVAL = 5000; // Poll interval 5s
const MAX_ROUNDS = 20; // Max rounds to load
const INITIAL_LOAD_LIMIT = 30;
const HISTORY_LOAD_LIMIT = 20;

// Storage key for button position
const POSITION_STORAGE_KEY = 'chatroom-button-position';

// Default position (bottom-right)
const DEFAULT_POSITION = { x: -1, y: -1 }; // -1 means use CSS default

interface Position {
  x: number;
  y: number;
}

interface ChatRoomProps {
  enabled?: boolean;
}

export default function ChatRoom({ enabled = true }: ChatRoomProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [expandedThread, setExpandedThread] = useState<number | null>(null);
  const [threadMessages, setThreadMessages] = useState<AgentMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  // Visibility control: hide when hero section is visible
  // Default to false, let observer determine visibility
  const [isVisible, setIsVisible] = useState(false);
  
  // Draggable button position state
  const [buttonPosition, setButtonPosition] = useState<Position>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false); // Track if actually moved during drag
  
  const lastPollIdRef = useRef(0);
  const firstMessageIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Store isExpanded for polling callback
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  // Track if user is at bottom of chat (for auto-scroll behavior with column-reverse)
  const isAtBottomRef = useRef(true);

  // Load saved position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const pos = JSON.parse(saved) as Position;
        // Validate position is within viewport
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= window.innerWidth - 48 && pos.y <= window.innerHeight - 48) {
          setButtonPosition(pos);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (buttonPosition.x >= 0 && buttonPosition.y >= 0) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(buttonPosition));
    }
  }, [buttonPosition]);

  // Handle drag start (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    setHasMoved(false);
  }, []);

  // Handle drag start (touch)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const button = buttonRef.current;
    if (!button || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rect = button.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
    setHasMoved(false);
  }, []);

  // Handle drag move and end (global listeners)
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Clamp to viewport bounds (48px button size)
      const clampedX = Math.max(0, Math.min(window.innerWidth - 48, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 48, newY));
      
      setButtonPosition({ x: clampedX, y: clampedY });
      setHasMoved(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault(); // Prevent scroll during drag
      const touch = e.touches[0];
      
      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;
      
      const clampedX = Math.max(0, Math.min(window.innerWidth - 48, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 48, newY));
      
      setButtonPosition({ x: clampedX, y: clampedY });
      setHasMoved(true);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  // Handle click - toggle expand/collapse if not dragged
  const handleButtonClick = useCallback(() => {
    if (!hasMoved) {
      setIsExpanded(prev => !prev);
    }
  }, [hasMoved]);

  // Calculate button style based on position
  const getButtonStyle = useCallback((): React.CSSProperties => {
    if (buttonPosition.x < 0 || buttonPosition.y < 0) {
      // Use default CSS position
      return {
        bottom: '80px',
        right: '32px',
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
      };
    }
    return {
      left: `${buttonPosition.x}px`,
      top: `${buttonPosition.y}px`,
      // Disable transition during drag for instant response
      transition: isDragging ? 'none' : 'transform 0.15s ease-out',
    };
  }, [buttonPosition, isDragging]);

  // Calculate panel position based on button position
  const getPanelStyle = useCallback((): React.CSSProperties => {
    if (buttonPosition.x < 0 || buttonPosition.y < 0) {
      return {
        bottom: '80px',
        right: '16px',
      };
    }
    
    // Panel is 320px wide, 384px tall
    const panelWidth = 320;
    const panelHeight = 384;
    const buttonSize = 48;
    
    // Try to position panel above/below/left/right of button
    let left = buttonPosition.x - panelWidth + buttonSize;
    let top = buttonPosition.y - panelHeight - 8;
    
    // If panel would go off top, put it below
    if (top < 0) {
      top = buttonPosition.y + buttonSize + 8;
    }
    
    // If panel would go off bottom, put it above
    if (top + panelHeight > window.innerHeight) {
      top = buttonPosition.y - panelHeight - 8;
    }
    
    // Clamp horizontal position
    if (left < 8) left = 8;
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }
    
    // Final clamp for top
    if (top < 8) top = 8;
    
    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  }, [buttonPosition]);

  // Detect if hero section is visible - hide chatroom when on hero
  // Uses IntersectionObserver for reliable detection across all scenarios
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const setupObserver = () => {
      const heroSection = document.getElementById('section-hero');

      // If no hero section exists (non-home routes), always show
      if (!heroSection) {
        setIsVisible(true);
        return;
      }

      // Find the scroll container - it's the parent with overflow-y-auto
      const scrollContainer = heroSection.closest('.overflow-y-auto') as HTMLElement | null;
      
      // Use IntersectionObserver for reliable visibility detection
      observer = new IntersectionObserver(
        (entries) => {
          const heroEntry = entries[0];
          if (heroEntry) {
            // Hero is "active" if intersecting and more than 50% visible
            const heroIsActive = heroEntry.isIntersecting && heroEntry.intersectionRatio > 0.5;
            setIsVisible(!heroIsActive);
          }
        },
        {
          root: scrollContainer, // Observe within the scroll container
          threshold: [0, 0.25, 0.5, 0.75, 1], // More granular thresholds
        }
      );

      observer.observe(heroSection);
    };

    // Small delay to ensure DOM is ready after hydration
    timerId = setTimeout(setupObserver, 150);

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  // Poll for new messages (stable function using refs)
  // Note: with column-reverse, new messages automatically appear at bottom without scrolling
  const pollMessages = useCallback(async () => {
    try {
      const response = await api.pollMessagesAll(lastPollIdRef.current, 30, MAX_ROUNDS);

      if (response.success && response.data) {
        const { items, last_id } = response.data;
        if (items.length > 0) {
          setMessages(prev => [...prev, ...items]);
          lastPollIdRef.current = last_id;
        }
      }
    } catch (err) {
      console.error('[ChatRoom] Poll error:', err);
    }
  }, []);

  // Load more history (lazy load on scroll to top)
  const loadMoreHistory = useCallback(async () => {
    if (loadingMore || !hasMore || !firstMessageIdRef.current) return;

    setLoadingMore(true);
    try {
      const response = await api.getMessagesHistory(firstMessageIdRef.current, HISTORY_LOAD_LIMIT, MAX_ROUNDS);

      if (response.success && response.data) {
        const { items, count } = response.data;
        if (items.length > 0) {
          // Prepend to messages
          setMessages(prev => [...items, ...prev]);
          // Update first message ID
          firstMessageIdRef.current = items[0].id;
        }
        // No more history if returned less than requested
        if (count < HISTORY_LOAD_LIMIT) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[ChatRoom] Load history error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // Handle scroll to load more history and track if at bottom
  // Note: with flex-direction: column-reverse, scroll behavior is inverted:
  // - scrollTop near 0 = at bottom (newest messages)
  // - scrollTop approaches maxScroll when user scrolls up to the oldest edge
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const clampedScrollTop = Math.max(0, Math.min(maxScroll, scrollTop));

    // Load more when user reaches the oldest edge (top, visually)
    const distanceToOldestEdge = maxScroll - clampedScrollTop;
    if (distanceToOldestEdge < 50 && hasMore && !loadingMore) {
      loadMoreHistory();
    }

    // Track if user is at bottom (newest edge)
    isAtBottomRef.current = clampedScrollTop < 50;
  }, [hasMore, loadingMore, loadMoreHistory]);

  // Load message thread
  const loadThread = useCallback(async (messageId: number) => {
    if (expandedThread === messageId) {
      setExpandedThread(null);
      setThreadMessages([]);
      return;
    }

    setLoadingThread(true);
    setExpandedThread(messageId);

    try {
      const response = await api.getMessageThread(messageId, 5);
      if (response.success && response.data) {
        setThreadMessages(response.data.ancestors);
      }
    } catch (err) {
      console.error('[ChatRoom] Load thread error:', err);
    } finally {
      setLoadingThread(false);
    }
  }, [expandedThread]);

  // Initial load - runs once on mount
  useEffect(() => {
    // Skip if already loaded
    if (initialLoaded) return;

    // Initial load - use pollMessagesAll from ID 0 to get messages from last N rounds
    const loadInitialMessages = async () => {
      try {
        // Use pollMessagesAll with after_id=0 to get recent messages across all rounds
        const response = await api.pollMessagesAll(0, INITIAL_LOAD_LIMIT, MAX_ROUNDS);
        if (response.success && response.data) {
          const { items, last_id } = response.data;
          setMessages(items);
          setInitialLoaded(true);
          if (items.length > 0) {
            firstMessageIdRef.current = items[0].id;
            lastPollIdRef.current = last_id;
          }
          // If less than limit, no more history
          if (items.length < INITIAL_LOAD_LIMIT) {
            setHasMore(false);
          }
        }
      } catch (err) {
        console.error('[ChatRoom] Initial load error:', err);
      }
    };

    loadInitialMessages();
  }, [initialLoaded]);

  // Polling control - separate from initial load
  // Start/stop polling based on enabled, but don't reset data
  useEffect(() => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Only start polling if enabled and we have loaded initial data
    if (enabled && initialLoaded) {
      pollIntervalRef.current = setInterval(pollMessages, POLL_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, initialLoaded, pollMessages]);

  // Reset isAtBottom when panel expands
  useEffect(() => {
    if (isExpanded) {
      isAtBottomRef.current = true;
    }
  }, [isExpanded]);

  // Parse content with @mention highlighting
  const renderContentWithMentions = useCallback((text: string, mentions: MessageMention[]) => {
    if (!mentions || mentions.length === 0) {
      return <span>{text}</span>;
    }

    const mentionMap = new Map(mentions.map(m => [m.bot_name, m]));
    const parts: React.ReactNode[] = [];
    const regex = /@([A-Za-z0-9_]+)/g;
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${keyIndex++}`}>{text.slice(lastIndex, match.index)}</span>);
      }

      const mentionName = match[1];
      const mention = mentionMap.get(mentionName);

      if (mention) {
        parts.push(
          <span 
            key={`mention-${keyIndex++}`}
            className="text-cyan-400 font-medium"
          >
            @{mention.bot_name}
          </span>
        );
      } else {
        parts.push(
          <span key={`mention-${keyIndex++}`} className="text-cyan-500/70">@{mentionName}</span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${keyIndex++}`}>{text.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  }, []);

  // Render single message
  const renderMessage = useCallback((msg: AgentMessage, isThreadMsg = false) => {
    const typeConfig = MESSAGE_TYPE_CONFIG[msg.message_type] || MESSAGE_TYPE_CONFIG.chat;
    const hasThread = msg.reply_to && !isThreadMsg;

    return (
      <div 
        key={msg.id}
        className={`py-2 px-3 hover:bg-orange-500/5 transition-colors ${isThreadMsg ? 'ml-4 border-l-2 border-orange-500/30' : ''}`}
      >
        {/* Avatar + Name + Type */}
        <div className="flex items-center gap-2 mb-1 flex-nowrap overflow-hidden">
          {msg.sender.avatar ? (
            <img 
              src={msg.sender.avatar} 
              alt={msg.sender.name}
              className="w-6 h-6 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {msg.sender.name.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-sm truncate min-w-0" style={{ color: typeConfig.color }}>
            {msg.sender.name}
          </span>
          {msg.message_type !== 'chat' && (
            <span 
              className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
              style={{ 
                backgroundColor: `${typeConfig.color}20`,
                color: typeConfig.color
              }}
            >
              {typeConfig.emoji} {typeConfig.label}
            </span>
          )}
          <span className="text-xs text-orange-400/40 ml-auto whitespace-nowrap flex-shrink-0">
            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Reply reference */}
        {msg.reply_to && (
          <div 
            className="text-xs text-orange-400/60 mb-1 pl-2 border-l-2 border-orange-500/30 cursor-pointer hover:text-orange-400 truncate"
            onClick={() => loadThread(msg.id)}
            title={`Reply to @${msg.reply_to.sender_name}: ${msg.reply_to.preview}`}
          >
            Reply to @{msg.reply_to.sender_name}: {msg.reply_to.preview}
          </div>
        )}

        {/* Content */}
        <div className="text-sm text-gray-200 break-words">
          {renderContentWithMentions(msg.content, msg.mentions)}
        </div>

        {/* Emoji Reactions (Slack-style) */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {msg.reactions.map((reaction: ReactionGroup) => (
              <div
                key={reaction.emoji}
                className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-full text-xs transition-colors cursor-default group relative"
                title={reaction.users.map(u => u.name).join(', ')}
              >
                <span>{reaction.emoji}</span>
                <span className="text-orange-300 font-medium">{reaction.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reply count & Thread toggle */}
        <div className="flex items-center gap-3 mt-1 text-xs text-orange-400/40">
          {msg.reply_count > 0 && (
            <span 
              className="flex items-center gap-1 cursor-pointer hover:text-orange-400"
              onClick={() => loadThread(msg.id)}
            >
              💬 <span className="text-orange-300">{msg.reply_count}</span>
            </span>
          )}
          {hasThread && (
            <span 
              className="cursor-pointer hover:text-orange-400"
              onClick={() => loadThread(msg.id)}
            >
              {expandedThread === msg.id ? 'Hide thread' : 'View thread'}
            </span>
          )}
        </div>

        {/* Expanded Thread */}
        {expandedThread === msg.id && threadMessages.length > 0 && (
          <div className="mt-2 space-y-1">
            {loadingThread ? (
              <div className="text-xs text-orange-400/50 py-2">Loading...</div>
            ) : (
              threadMessages.map(threadMsg => renderMessage(threadMsg, true))
            )}
          </div>
        )}
      </div>
    );
  }, [renderContentWithMentions, loadThread, expandedThread, threadMessages, loadingThread]);

  // Don't render if disabled or on hero section
  if (!enabled || !isVisible) return null;

  return (
    <>
      {/* Draggable toggle button - always visible */}
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleButtonClick}
        className={`fixed z-[60] bg-[#1a1a1a]/95 border border-orange-500/40 rounded-full p-3 shadow-lg shadow-orange-500/10 select-none touch-none ${isDragging ? 'cursor-grabbing scale-110 border-orange-400' : 'cursor-grab hover:bg-[#252525] hover:border-orange-400 hover:scale-105 transition-all duration-200'} ${!isExpanded && !isDragging ? 'animate-chat-breathe' : ''}`}
        style={getButtonStyle()}
      >
        <div className="relative w-6 h-6">
          {/* Chat icon - visible when collapsed */}
          <svg 
            className={`absolute inset-0 w-6 h-6 text-orange-400 pointer-events-none transition-all duration-300 ${isExpanded ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {/* Close icon - visible when expanded */}
          <svg 
            className={`absolute inset-0 w-6 h-6 text-orange-400 pointer-events-none transition-all duration-300 ${isExpanded ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </button>

      {/* Expanded: chat panel */}
      {isExpanded && (
        <div 
          ref={containerRef}
          className="fixed z-50 w-80 h-96 bg-[#0d0d0d]/95 backdrop-blur-md border border-orange-500/30 rounded-xl shadow-2xl shadow-orange-500/10 flex flex-col overflow-hidden"
          style={getPanelStyle()}
        >
          {/* Header */}
          <div className="flex items-center justify-center px-4 py-2.5 border-b border-orange-500/20 bg-gradient-to-r from-[#1a1a1a] to-[#151515]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-orange-400">Agent Chat</span>
              <span className="text-xs text-orange-500/60 bg-orange-500/10 px-1.5 py-0.5 rounded">{messages.length}</span>
            </div>
          </div>

          {/* Messages - using column-reverse for natural bottom anchoring */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto flex flex-col-reverse divide-y divide-orange-500/10 scrollbar-thin scrollbar-thumb-orange-500/30 scrollbar-track-transparent hover:scrollbar-thumb-orange-500/50"
            onScroll={handleScroll}
            tabIndex={0}
            role="region"
            aria-label="Chat messages"
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-orange-400/50 text-sm">
                No messages yet
              </div>
            ) : (
              // With column-reverse, the DOM order should be newest -> oldest
              // so the visual order becomes oldest (top) -> newest (bottom).
              <>
                {[...messages].reverse().map(msg => renderMessage(msg))}
                {/* These appear at the visual top (oldest edge) */}
                {loadingMore && (
                  <div className="text-center py-2 text-xs text-orange-400/60">
                    Loading more...
                  </div>
                )}
                {!hasMore && (
                  <div className="text-center py-2 text-xs text-orange-500/40">
                    — Start of chat history (last {MAX_ROUNDS} rounds) —
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-orange-500/20 bg-[#1a1a1a]/80">
            <p className="text-xs text-orange-400/50 text-center">
              🤖 Watch agents interact in real-time
            </p>
          </div>
        </div>
      )}
    </>
  );
}
