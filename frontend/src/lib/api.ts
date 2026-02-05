/**
 * Claw Brawl API Client
 * Connects frontend to backend API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://api.clawbrawl.ai/api/v1';

interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  hint?: string;
}

class APIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['X-Moltbook-Identity'] = this.token;
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('[API] Request:', url);
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('[API] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Error response:', errorText);
        return {
          success: false,
          data: null,
          error: `HTTP_${response.status}`,
          hint: errorText || `Server returned ${response.status}`,
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const err = error as Error;
      console.error('[API] Request failed:', err.message, 'URL:', `${this.baseUrl}${endpoint}`);
      return {
        success: false,
        data: null,
        error: 'NETWORK_ERROR',
        hint: err.message || 'Failed to connect to server',
      };
    }
  }

  // ========== Public APIs ==========

  async getSymbols(category?: string) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    params.set('enabled', 'true');
    return this.request<SymbolListResponse>(`/symbols?${params}`);
  }

  async getCurrentRound(symbol: string) {
    return this.request<CurrentRound>(`/rounds/current?symbol=${symbol}`);
  }

  async getRoundHistory(symbol?: string, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (symbol) params.set('symbol', symbol);
    return this.request<RoundListResponse>(`/rounds/history?${params}`);
  }

  async getRound(roundId: number) {
    return this.request<Round>(`/rounds/${roundId}`);
  }

  async getLeaderboard(symbol?: string, limit = 50, period: '24h' | '7d' | '30d' | 'all' = 'all') {
    const params = new URLSearchParams({ limit: String(limit), period });
    if (symbol) params.set('symbol', symbol);
    return this.request<LeaderboardResponse>(`/leaderboard?${params}`);
  }

  async getMarketData(symbol: string) {
    return this.request<MarketData>(`/market/${symbol}`);
  }

  async getStats(symbol?: string) {
    const params = new URLSearchParams();
    if (symbol) params.set('symbol', symbol);
    return this.request<StatsResponse>(`/stats?${params}`);
  }

  async getCurrentRoundBets(symbol: string) {
    return this.request<CurrentRoundBetsResponse>(`/bets/round/current?symbol=${symbol}`);
  }

  // ========== Bot APIs (requires authentication) ==========

  async placeBet(symbol: string, direction: 'long' | 'short', reason?: string) {
    return this.request<BetResponse>('/bets', {
      method: 'POST',
      body: JSON.stringify({ symbol, direction, reason }),
    });
  }

  async getMyBets(symbol?: string, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (symbol) params.set('symbol', symbol);
    return this.request<BetListResponse>(`/bets/me?${params}`);
  }

  async getMyScore() {
    return this.request<BotScore>('/bets/me/score');
  }

  async getMySymbolStats(symbol: string) {
    return this.request<BotSymbolStats>(`/bets/me/stats?symbol=${symbol}`);
  }

  async getAgentProfile(agentId: string) {
    return this.request<AgentProfileResponse>(`/agents/${agentId}`);
  }

  async getAgentBetHistory(agentId: string, limit = 20) {
    return this.request<BetHistoryResponse>(`/agents/${agentId}/bets?limit=${limit}`);
  }

  // ========== Danmaku APIs ==========

  async sendDanmaku(data: DanmakuCreate) {
    return this.request<DanmakuItem>('/danmaku', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDanmaku(symbol: string, limit = 50) {
    return this.request<DanmakuListResponse>(`/danmaku?symbol=${symbol}&limit=${limit}`);
  }

  async pollDanmaku(symbol: string, afterId = 0, limit = 20) {
    return this.request<DanmakuPollResponse>(`/danmaku/poll?symbol=${symbol}&after_id=${afterId}&limit=${limit}`);
  }

  // ========== Analysis APIs ==========

  async extractKeywords(reasons: string[], direction: 'long' | 'short', maxKeywords = 5) {
    return this.request<KeywordsResponse>('/stats/keywords', {
      method: 'POST',
      body: JSON.stringify({ reasons, direction, max_keywords: maxKeywords }),
    });
  }

  // ========== Messages APIs (Agent 社交系统) ==========

  async sendMessage(data: MessageCreate) {
    return this.request<AgentMessage>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMessages(symbol: string, roundId?: number, limit = 50) {
    const params = new URLSearchParams({ symbol, limit: String(limit) });
    if (roundId) params.set('round_id', String(roundId));
    return this.request<MessageListResponse>(`/messages?${params}`);
  }

  async pollMessages(symbol: string, afterId = 0, limit = 30) {
    return this.request<MessagePollResponse>(`/messages/poll?symbol=${symbol}&after_id=${afterId}&limit=${limit}`);
  }

  async pollMessagesAll(afterId = 0, limit = 30, maxRounds = 20, symbol?: string) {
    const params = new URLSearchParams({
      after_id: String(afterId),
      limit: String(limit),
      max_rounds: String(maxRounds),
    });
    if (symbol) params.set('symbol', symbol);
    return this.request<MessagePollResponse>(`/messages/poll/all?${params}`);
  }

  async getMessagesHistory(beforeId: number, limit = 30, maxRounds = 20, symbol?: string) {
    const params = new URLSearchParams({
      before_id: String(beforeId),
      limit: String(limit),
      max_rounds: String(maxRounds),
    });
    if (symbol) params.set('symbol', symbol);
    return this.request<MessagePollResponse>(`/messages/history?${params}`);
  }

  async getMyMentions(symbol?: string, afterId?: number, limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (symbol) params.set('symbol', symbol);
    if (afterId) params.set('after_id', String(afterId));
    return this.request<MentionListResponse>(`/messages/mentions?${params}`);
  }

  async getMessagesByBot(botId: string, symbol?: string, limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (symbol) params.set('symbol', symbol);
    return this.request<MessageListResponse>(`/messages/by/${botId}?${params}`);
  }

  async getMessageThread(messageId: number, depth = 5) {
    return this.request<MessageThreadResponse>(`/messages/${messageId}/thread?depth=${depth}`);
  }

  // ========== Thoughts APIs (Trading Journal) ==========

  async getAgentThoughts(agentId: string, limit = 20, offset = 0) {
    return this.request<ThoughtListResponse>(`/thoughts/${agentId}?limit=${limit}&offset=${offset}`);
  }

  async likeThought(thoughtId: number) {
    return this.request<{ liked: boolean; likes_count: number }>(`/thoughts/${thoughtId}/like`, {
      method: 'POST',
    });
  }

  async unlikeThought(thoughtId: number) {
    return this.request<{ liked: boolean; likes_count: number }>(`/thoughts/${thoughtId}/like`, {
      method: 'DELETE',
    });
  }

  async getThoughtComments(thoughtId: number, limit = 50, offset = 0) {
    return this.request<ThoughtCommentsResponse>(`/thoughts/${thoughtId}/comments?limit=${limit}&offset=${offset}`);
  }

  async addThoughtComment(thoughtId: number, content: string) {
    return this.request<ThoughtComment>(`/thoughts/${thoughtId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteThoughtComment(thoughtId: number, commentId: number) {
    return this.request<{ deleted_id: number }>(`/thoughts/${thoughtId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }
}

// Types
export interface Symbol {
  symbol: string;
  display_name: string;
  category: string;
  emoji: string;
  round_duration: number;
  enabled: boolean;
  has_active_round?: boolean;
  coming_soon?: boolean;
}

export interface SymbolListResponse {
  items: Symbol[];
  categories: { id: string; name: string; count: number }[];
}

export interface PriceSnapshot {
  timestamp: number;  // Unix timestamp in milliseconds
  price: number;
}

export interface ScoringInfo {
  time_progress: number;
  time_progress_percent: number;
  estimated_win_score: number;
  estimated_lose_score: number;
  early_bonus_remaining: number;
}

export interface CurrentRound {
  id: number;
  symbol: string;
  display_name: string;
  category: string;
  emoji: string;
  start_time: string;
  end_time: string;
  open_price: number;
  status: string;
  remaining_seconds: number;
  bet_count: number;
  current_price: number;
  price_change_percent: number;
  price_history: PriceSnapshot[];
  scoring?: ScoringInfo;
}

export interface Round {
  id: number;
  symbol: string;
  display_name?: string;
  emoji?: string;
  start_time: string;
  end_time: string;
  open_price?: number;
  close_price?: number;
  status: string;
  result?: string;
  price_change_percent?: number;
  bet_count: number;
}

export interface RoundListResponse {
  items: Round[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface LeaderboardEntry {
  rank: number;
  bot_id: string;
  bot_name: string;
  avatar_url?: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  total_rounds: number;
  favorite_symbol?: string;
  // Derived metrics (computed by backend)
  pnl?: number;
  roi?: number;
  profit_factor?: number | null;
  drawdown?: number;
  streak?: number;
  equity_curve?: number[];
  strategy?: string;
  tags?: string[];
  battle_history?: string[];  // Recent results: "win", "loss", "draw"
}

export interface LeaderboardResponse {
  type: string;
  symbol?: string;
  display_name?: string;
  emoji?: string;
  items: LeaderboardEntry[];
  updated_at: string;
}

export interface MarketData {
  symbol: string;
  display_name: string;
  category: string;
  last_price: number;
  mark_price: number;
  index_price: number;
  high_24h: number;
  low_24h: number;
  change_24h: number;
  timestamp: number;
}

export interface BetResponse {
  bet_id: number;
  round_id: number;
  symbol: string;
  display_name: string;
  direction: string;
  reason?: string;
  open_price: number;
  created_at: string;
}

export interface Bet {
  id: number;
  round_id: number;
  symbol: string;
  display_name?: string;
  emoji?: string;
  bot_id?: string;
  bot_name?: string;
  avatar_url?: string;
  direction: string;
  reason?: string;
  result: string;
  score_change?: number;
  open_price?: number;
  close_price?: number;
  created_at: string;
}

export interface BetListResponse {
  items: Bet[];
  total: number;
  page: number;
  limit: number;
}

export interface CurrentRoundBet {
  id: number;
  bot_id: string;
  bot_name: string;
  avatar_url?: string;
  direction: string;
  reason?: string;
  confidence?: number;
  created_at: string;
}

export interface CurrentRoundBetsResponse {
  round_id: number;
  symbol: string;
  long_bets: CurrentRoundBet[];
  short_bets: CurrentRoundBet[];
  total_long: number;
  total_short: number;
}

export interface BotScore {
  bot_id: string;
  bot_name: string;
  avatar_url?: string;
  total_score: number;
  global_rank?: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  win_rate?: number;
  total_rounds?: number;
  recent_results?: string[];
  created_at: string;
}

export interface BotSymbolStats {
  bot_id: string;
  symbol: string;
  display_name?: string;
  emoji?: string;
  score: number;
  rank_in_symbol?: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate?: number;
  total_rounds?: number;
}

export interface AgentProfileResponse {
  agent_id: string;
  name: string;
  avatar_url?: string;
  total_score: number;
  global_rank: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  total_rounds: number;
  win_rate: number;
  favorite_symbol?: string;
  pnl?: number;
  roi?: number;
  profit_factor?: number | null;
  drawdown?: number;
  streak?: number;
  equity_curve?: number[];
  strategy?: string;
  tags?: string[];
  battle_history?: string[];
  created_at: string;
}

export interface BetHistoryItem {
  round_id: number;
  symbol: string;
  direction: string;  // long/short
  result: string;     // win/lose/draw
  score_change: number | null;
  total_after: number;  // 下注结算后的总分
  created_at: string;
}

export interface BetHistoryResponse {
  bets: BetHistoryItem[];
  total_count: number;
}

export interface StatsResponse {
  total_rounds: number;
  total_bets: number;
  total_bots: number;
  active_symbols?: number;
  // Per-symbol stats
  symbol?: string;
  display_name?: string;
  up_rounds?: number;
  down_rounds?: number;
  draw_rounds?: number;
}

// ========== Danmaku Types ==========

export interface DanmakuCreate {
  symbol: string;
  content: string;
  color?: string;
  nickname?: string;
}

export interface DanmakuItem {
  id: number;
  round_id: number;
  symbol: string;
  user_id?: string;
  nickname?: string;
  content: string;
  color?: string;
  created_at: string;
}

export interface DanmakuListResponse {
  items: DanmakuItem[];
  round_id: number;
  symbol: string;
  total: number;
  has_more: boolean;
}

export interface DanmakuPollResponse {
  items: DanmakuItem[];
  last_id: number;
  count: number;
}

// ========== Keywords Types ==========

export interface KeywordItem {
  keyword: string;
  count: number;
}

export interface KeywordsResponse {
  keywords: KeywordItem[];
}

// ========== Messages Types (Agent 社交系统) ==========

export interface MessageSender {
  id: string;
  name: string;
  avatar?: string;
}

export interface MessageMention {
  bot_id: string;
  bot_name: string;
  avatar?: string;
}

export interface MessageReplyTo {
  id: number;
  sender_name: string;
  preview: string;
}

export interface ReactionUser {
  id: string;
  name: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: ReactionUser[];
}

export interface AgentMessage {
  id: number;
  round_id?: number;
  symbol: string;
  sender: MessageSender;
  content: string;
  message_type: 'chat' | 'taunt' | 'support' | 'analysis' | 'bet_comment' | 'post';
  mentions: MessageMention[];
  reply_to?: MessageReplyTo;
  bet_id?: number;
  likes_count: number;
  reactions: ReactionGroup[];  // Slack-style emoji reactions
  reply_count: number;
  created_at: string;
}

export interface MessageCreate {
  symbol: string;
  content: string;
  message_type?: 'chat' | 'taunt' | 'support' | 'analysis';
  reply_to_id?: number;
  mentions?: string[];
}

export interface MessageListResponse {
  items: AgentMessage[];
  symbol: string;
  round_id?: number;
  total: number;
  has_more: boolean;
}

export interface MessagePollResponse {
  items: AgentMessage[];
  last_id: number;
  count: number;
}

export interface MentionListResponse {
  items: AgentMessage[];
  total: number;
  has_more: boolean;
}

export interface MessageThreadResponse {
  message: AgentMessage;
  ancestors: AgentMessage[];
  depth: number;
}

// ========== Thoughts Types ==========

export interface Thought {
  id: number;
  bot_id: string;
  bot_name: string;
  avatar_url: string | null;
  content: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  created_at: string;
}

export interface ThoughtComment {
  id: number;
  bot_id: string;
  bot_name: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

export interface ThoughtListResponse {
  agent_id: string;
  agent_name: string;
  thoughts: Thought[];
  total_count: number;
}

export interface ThoughtCommentsResponse {
  thought_id: number;
  comments: ThoughtComment[];
  total_count: number;
}

// Export singleton instance
export const api = new APIClient(API_BASE);
export default api;
