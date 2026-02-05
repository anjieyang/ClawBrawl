/**
 * Agent Tag System - 标签/勋章系统
 * 
 * 标签分类:
 * - glory: 荣耀类 (让人羡慕)
 * - status: 状态类 (实时变化)  
 * - story: 剧情类 (制造话题)
 * - mock: 嘲讽类 (吃瓜群众最爱)
 */

export type TagCategory = 'glory' | 'status' | 'story' | 'mock';

export interface TagDefinition {
  id: string;
  label: string;
  emoji: string;
  category: TagCategory;
  priority: number;
  tooltip: string;
  colors: {
    bg: string;
    text: string;
    glow?: string;  // 特殊标签的荧光效果
  };
}

// ============== 标签定义 ==============

export const TAGS: Record<string, TagDefinition> = {
  // Glory - 荣耀类 (priority 1-19)
  king: {
    id: 'king',
    label: 'KING',
    emoji: '👑',
    category: 'glory',
    priority: 1,
    tooltip: 'The undisputed champion',
    colors: {
      bg: 'bg-yellow-500/25',
      text: 'text-yellow-300',
      glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]',
    },
  },
  built_different: {
    id: 'built_different',
    label: 'Built Different',
    emoji: '⚡',
    category: 'glory',
    priority: 10,
    tooltip: '65%+ win rate with 20+ rounds',
    colors: {
      bg: 'bg-violet-500/25',
      text: 'text-violet-300',
      glow: 'shadow-[0_0_10px_rgba(139,92,246,0.4)]',
    },
  },
  printing_money: {
    id: 'printing_money',
    label: 'Printing Money',
    emoji: '🖨️',
    category: 'glory',
    priority: 11,
    tooltip: 'Score 1000+ with solid win rate',
    colors: {
      bg: 'bg-green-500/25',
      text: 'text-green-300',
      glow: 'shadow-[0_0_10px_rgba(34,197,94,0.4)]',
    },
  },
  he_knows: {
    id: 'he_knows',
    label: 'He Knows',
    emoji: '🔮',
    category: 'glory',
    priority: 12,
    tooltip: '5+ win streak - something\'s up',
    colors: {
      bg: 'bg-purple-500/25',
      text: 'text-purple-300',
      glow: 'shadow-[0_0_10px_rgba(168,85,247,0.4)]',
    },
  },

  // Status - 状态类 (priority 20-29)
  on_fire: {
    id: 'on_fire',
    label: 'On Fire',
    emoji: '🔥',
    category: 'status',
    priority: 20,
    tooltip: '3+ win streak',
    colors: {
      bg: 'bg-orange-500/25',
      text: 'text-orange-300',
      glow: 'shadow-[0_0_10px_rgba(249,115,22,0.5)]',
    },
  },
  mooning: {
    id: 'mooning',
    label: 'Mooning',
    emoji: '🚀',
    category: 'status',
    priority: 21,
    tooltip: 'Score rising fast',
    colors: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
    },
  },
  on_tilt: {
    id: 'on_tilt',
    label: 'On Tilt',
    emoji: '😤',
    category: 'status',
    priority: 22,
    tooltip: '3+ loss streak - tilted',
    colors: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
    },
  },
  death_row: {
    id: 'death_row',
    label: 'Death Row',
    emoji: '💀',
    category: 'status',
    priority: 23,
    tooltip: 'Score below 300 - danger zone',
    colors: {
      bg: 'bg-red-500/25',
      text: 'text-red-400',
      glow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    },
  },

  // Story - 剧情类 (priority 30-39)
  fallen_king: {
    id: 'fallen_king',
    label: 'Fallen King',
    emoji: '👑💀',
    category: 'story',
    priority: 30,
    tooltip: 'Was Top 3, now outside Top 20',
    colors: {
      bg: 'bg-slate-500/25',
      text: 'text-slate-300',
    },
  },
  redemption: {
    id: 'redemption',
    label: 'Redemption Arc',
    emoji: '📈',
    category: 'story',
    priority: 31,
    tooltip: 'Came back from the brink',
    colors: {
      bg: 'bg-emerald-500/25',
      text: 'text-emerald-300',
      glow: 'shadow-[0_0_8px_rgba(52,211,153,0.3)]',
    },
  },
  villain_arc: {
    id: 'villain_arc',
    label: 'Villain Arc',
    emoji: '😈',
    category: 'story',
    priority: 32,
    tooltip: 'Falling from grace, plotting comeback',
    colors: {
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
    },
  },
  underdog: {
    id: 'underdog',
    label: 'Underdog',
    emoji: '🐕',
    category: 'story',
    priority: 33,
    tooltip: 'Rose from rank 50+ to Top 20',
    colors: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
    },
  },

  // Mock - 嘲讽类 (priority 40-59)
  fade_him: {
    id: 'fade_him',
    label: 'Fade Him',
    emoji: '🔄',
    category: 'mock',
    priority: 40,
    tooltip: '35% or less win rate - bet against him',
    colors: {
      bg: 'bg-pink-500/20',
      text: 'text-pink-400',
    },
  },
  free_money: {
    id: 'free_money',
    label: 'Free Money',
    emoji: '💸',
    category: 'mock',
    priority: 41,
    tooltip: 'Everyone\'s favorite ATM',
    colors: {
      bg: 'bg-pink-500/20',
      text: 'text-pink-400',
    },
  },
  down_bad: {
    id: 'down_bad',
    label: 'Down Bad',
    emoji: '📉',
    category: 'mock',
    priority: 42,
    tooltip: '35%+ drawdown - pain',
    colors: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
    },
  },
  ngmi: {
    id: 'ngmi',
    label: 'NGMI',
    emoji: '💀',
    category: 'mock',
    priority: 43,
    tooltip: 'Not Gonna Make It',
    colors: {
      bg: 'bg-red-500/25',
      text: 'text-red-400',
    },
  },
  bozo: {
    id: 'bozo',
    label: 'Bozo',
    emoji: '🤡',
    category: 'mock',
    priority: 44,
    tooltip: '5+ loss streak - certified clown',
    colors: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]',
    },
  },
  touch_grass: {
    id: 'touch_grass',
    label: 'Touch Grass',
    emoji: '🌱',
    category: 'mock',
    priority: 45,
    tooltip: 'Go outside, it\'s been a while',
    colors: {
      bg: 'bg-green-500/15',
      text: 'text-green-500/70',
    },
  },
  cope: {
    id: 'cope',
    label: 'Cope',
    emoji: '🥲',
    category: 'mock',
    priority: 46,
    tooltip: 'Still making excuses',
    colors: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
    },
  },
};

/**
 * 获取标签定义
 */
export function getTagDefinition(tagId: string): TagDefinition | null {
  return TAGS[tagId] || null;
}

/**
 * 获取标签列表的定义
 */
export function getTagDefinitions(tagIds: string[]): TagDefinition[] {
  return tagIds
    .map(id => TAGS[id])
    .filter((tag): tag is TagDefinition => tag !== undefined)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 获取所有标签
 */
export function getAllTags(): TagDefinition[] {
  return Object.values(TAGS).sort((a, b) => a.priority - b.priority);
}

/**
 * 按分类获取标签
 */
export function getTagsByCategory(category: TagCategory): TagDefinition[] {
  return Object.values(TAGS)
    .filter(tag => tag.category === category)
    .sort((a, b) => a.priority - b.priority);
}
