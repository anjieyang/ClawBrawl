/**
 * Streak 系统配置和工具函数
 * 
 * 连胜/连败特效、称号、样式统一管理
 */

// ============ 阈值配置 ============
export const STREAK_THRESHOLDS = {
  // 连胜阈值
  WIN: {
    ON_FIRE: 3,      // 🔥 On Fire
    UNSTOPPABLE: 5,  // 🌟 Unstoppable
    LEGENDARY: 7,    // 👑 Legendary
    TERMINATOR: 10,  // 💀 终结者
  },
  // 连败阈值
  LOSE: {
    COLD: 3,         // 🥶 冷静期
    CONTRARIAN: 5,   // 📉 反向指标
    PRECISE: 7,      // 🎯 精准反指
    BAGHOLDER: 10,   // 💸 接盘侠
  },
} as const;

// ============ 称号配置 ============
export interface StreakTitle {
  emoji: string;
  title: string;
  titleEn: string;
  description: string;
}

const WIN_TITLES: Record<number, StreakTitle> = {
  3: { emoji: '🔥', title: 'On Fire', titleEn: 'On Fire', description: 'On a winning streak!' },
  5: { emoji: '🌟', title: 'Unstoppable', titleEn: 'Unstoppable', description: '5 wins in a row, unbeatable!' },
  7: { emoji: '👑', title: 'Legendary', titleEn: 'Legendary', description: 'A legend has arrived!' },
  10: { emoji: '💀', title: 'Terminator', titleEn: 'Terminator', description: 'Ultimate killer, market dominator!' },
};

const LOSE_TITLES: Record<number, StreakTitle> = {
  3: { emoji: '🥶', title: 'Cooling Down', titleEn: 'Cooling Down', description: 'Taking a break...' },
  5: { emoji: '📉', title: 'Contrarian Signal', titleEn: 'Contrarian Signal', description: 'Bet against me?' },
  7: { emoji: '🎯', title: 'Precise Contrarian', titleEn: 'Precise Contrarian', description: 'Perfect reverse predictor' },
  10: { emoji: '💸', title: 'Bag Holder', titleEn: 'Bag Holder', description: 'The eternal contrarian...' },
};

// ============ 样式配置 ============
export interface StreakStyle {
  // 名字发光效果
  textGlow: string;
  textColorClass: string;
  // 头像框效果
  avatarRing: string;
  avatarGlow: string;
  // 动画类名
  animationClass: string;
  // 是否触发进场播报
  triggerEntrance: boolean;
  // 进场播报等级 (用于不同华丽程度)
  entranceLevel: 0 | 1 | 2 | 3;
}

const WIN_STYLES: Record<number, StreakStyle> = {
  3: {
    textGlow: '0 0 8px rgba(251, 146, 60, 0.6), 0 0 16px rgba(251, 146, 60, 0.3)',
    textColorClass: 'text-orange-400',
    avatarRing: 'ring-2 ring-orange-400/60',
    avatarGlow: '0 0 12px rgba(251, 146, 60, 0.5)',
    animationClass: '',
    triggerEntrance: false,
    entranceLevel: 0,
  },
  5: {
    textGlow: '0 0 10px rgba(250, 204, 21, 0.7), 0 0 20px rgba(250, 204, 21, 0.4), 0 0 30px rgba(250, 204, 21, 0.2)',
    textColorClass: 'text-yellow-400',
    avatarRing: 'ring-2 ring-yellow-400/70 animate-pulse',
    avatarGlow: '0 0 16px rgba(250, 204, 21, 0.6)',
    animationClass: 'animate-pulse',
    triggerEntrance: true,
    entranceLevel: 1,
  },
  7: {
    textGlow: '0 0 12px rgba(250, 204, 21, 0.8), 0 0 24px rgba(168, 85, 247, 0.5), 0 0 36px rgba(250, 204, 21, 0.3)',
    textColorClass: 'text-yellow-300',
    avatarRing: 'ring-3 ring-yellow-400/80 animate-pulse',
    avatarGlow: '0 0 20px rgba(250, 204, 21, 0.7), 0 0 40px rgba(168, 85, 247, 0.3)',
    animationClass: 'animate-streak-glow',
    triggerEntrance: true,
    entranceLevel: 2,
  },
  10: {
    textGlow: '0 0 15px rgba(239, 68, 68, 0.9), 0 0 30px rgba(250, 204, 21, 0.6), 0 0 45px rgba(239, 68, 68, 0.4)',
    textColorClass: 'text-red-400',
    avatarRing: 'ring-4 ring-red-500/80 animate-pulse',
    avatarGlow: '0 0 24px rgba(239, 68, 68, 0.8), 0 0 48px rgba(250, 204, 21, 0.4)',
    animationClass: 'animate-streak-fire',
    triggerEntrance: true,
    entranceLevel: 3,
  },
};

const LOSE_STYLES: Record<number, StreakStyle> = {
  3: {
    textGlow: '0 0 8px rgba(56, 189, 248, 0.5)',
    textColorClass: 'text-sky-400',
    avatarRing: 'ring-2 ring-sky-400/50',
    avatarGlow: '0 0 10px rgba(56, 189, 248, 0.4)',
    animationClass: '',
    triggerEntrance: false,
    entranceLevel: 0,
  },
  5: {
    textGlow: '0 0 10px rgba(139, 92, 246, 0.6), 0 0 20px rgba(56, 189, 248, 0.3)',
    textColorClass: 'text-violet-400',
    avatarRing: 'ring-2 ring-violet-400/60',
    avatarGlow: '0 0 14px rgba(139, 92, 246, 0.5)',
    animationClass: '',
    triggerEntrance: true,
    entranceLevel: 1,
  },
  7: {
    textGlow: '0 0 12px rgba(139, 92, 246, 0.7), 0 0 24px rgba(75, 85, 99, 0.5)',
    textColorClass: 'text-violet-300',
    avatarRing: 'ring-3 ring-violet-500/70',
    avatarGlow: '0 0 18px rgba(139, 92, 246, 0.6)',
    animationClass: 'animate-pulse',
    triggerEntrance: true,
    entranceLevel: 2,
  },
  10: {
    textGlow: '0 0 15px rgba(75, 85, 99, 0.8), 0 0 30px rgba(139, 92, 246, 0.4)',
    textColorClass: 'text-gray-400',
    avatarRing: 'ring-4 ring-gray-500/70',
    avatarGlow: '0 0 20px rgba(75, 85, 99, 0.6)',
    animationClass: 'animate-streak-cold',
    triggerEntrance: true,
    entranceLevel: 3,
  },
};

// ============ 工具函数 ============

/**
 * 获取 streak 对应的等级（用于查找配置）
 */
export function getStreakTier(streak: number): number {
  const absStreak = Math.abs(streak);
  if (absStreak >= 10) return 10;
  if (absStreak >= 7) return 7;
  if (absStreak >= 5) return 5;
  if (absStreak >= 3) return 3;
  return 0;
}

/**
 * 获取 streak 对应的称号
 */
export function getStreakTitle(streak: number): StreakTitle | null {
  const tier = getStreakTier(streak);
  if (tier === 0) return null;
  
  if (streak > 0) {
    return WIN_TITLES[tier] || null;
  } else {
    return LOSE_TITLES[tier] || null;
  }
}

/**
 * 获取 streak 对应的样式
 */
export function getStreakStyle(streak: number): StreakStyle | null {
  const tier = getStreakTier(streak);
  if (tier === 0) return null;
  
  if (streak > 0) {
    return WIN_STYLES[tier] || null;
  } else {
    return LOSE_STYLES[tier] || null;
  }
}

/**
 * 获取完整的 streak 信息
 */
export interface StreakInfo {
  streak: number;
  isWinning: boolean;
  tier: number;
  title: StreakTitle | null;
  style: StreakStyle | null;
}

export function getStreakInfo(streak: number): StreakInfo {
  return {
    streak,
    isWinning: streak > 0,
    tier: getStreakTier(streak),
    title: getStreakTitle(streak),
    style: getStreakStyle(streak),
  };
}

/**
 * 生成进场播报文案
 */
export function generateEntranceMessage(
  botName: string,
  streak: number,
  direction: 'long' | 'short',
  winRate?: number
): string {
  const info = getStreakInfo(streak);
  const directionText = direction === 'long' ? '做多' : '做空';
  const directionEmoji = direction === 'long' ? '📈' : '📉';
  
  if (!info.title) {
    return `${botName} ${directionText}入场！`;
  }
  
  const statsText = winRate ? `胜率 ${winRate}%` : '';
  const streakText = `${Math.abs(streak)} ${info.isWinning ? '连胜' : '连败'}`;
  
  // 根据等级生成不同风格的文案
  if (info.tier >= 10) {
    if (info.isWinning) {
      return `${info.title.emoji}${info.title.emoji}${info.title.emoji} ${info.title.title} ${botName} ${directionEmoji}${directionText}入场！${streakText}${statsText ? `，${statsText}` : ''} ${info.title.emoji}${info.title.emoji}${info.title.emoji}`;
    } else {
      return `${info.title.emoji} ${info.title.title} ${botName} 再次出手${directionText}！${streakText}，你敢跟吗？`;
    }
  }
  
  if (info.tier >= 7) {
    if (info.isWinning) {
      return `${info.title.emoji} ${info.title.title} ${botName} 驾到！${streakText}的TA这次${directionText}了 ${directionEmoji}`;
    } else {
      return `${info.title.emoji} ${botName} ${info.title.title}再现！${streakText}后选择${directionText}`;
    }
  }
  
  if (info.tier >= 5) {
    if (info.isWinning) {
      return `${info.title.emoji} ${botName} ${info.title.title}！当前${streakText}，${directionText}入场 ${directionEmoji}`;
    } else {
      return `${info.title.emoji} ${botName} 成为${info.title.title}！${streakText}后${directionText}`;
    }
  }
  
  return `${info.title.emoji} ${botName} ${directionText}入场！${streakText}`;
}

/**
 * 获取进场播报的背景渐变色（不透明）
 */
export function getEntranceBannerGradient(streak: number): string {
  const info = getStreakInfo(streak);
  
  if (info.isWinning) {
    if (info.tier >= 10) {
      return 'linear-gradient(90deg, #ef4444, #facc15, #ef4444)';
    }
    if (info.tier >= 7) {
      return 'linear-gradient(90deg, #eab308, #a855f7, #eab308)';
    }
    if (info.tier >= 5) {
      return 'linear-gradient(90deg, #f59e0b, #ea580c)';
    }
    return 'linear-gradient(90deg, #f97316, #ea580c)';
  } else {
    if (info.tier >= 10) {
      return 'linear-gradient(90deg, #4b5563, #8b5cf6, #4b5563)';
    }
    if (info.tier >= 7) {
      return 'linear-gradient(90deg, #7c3aed, #4b5563)';
    }
    if (info.tier >= 5) {
      return 'linear-gradient(90deg, #8b5cf6, #0ea5e9)';
    }
    return 'linear-gradient(90deg, #0ea5e9, #8b5cf6)';
  }
}
