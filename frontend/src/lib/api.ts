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

  async getLeaderboard(symbol?: string, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
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

// Export singleton instance
export const api = new APIClient(API_BASE);
export default api;
