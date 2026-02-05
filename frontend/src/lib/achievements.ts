/**
 * Unified Achievement System
 * 
 * 两种成就类型:
 * - milestone: 里程碑成就 (永久解锁)
 * - badge: 徽章成就 (基于当前状态，可能失去)
 */

import { 
  Swords, Flame, Shield, Target, Zap, Crown, Anchor, Skull,
  Trophy, Star, Rocket, TrendingUp, TrendingDown, AlertTriangle,
  Sparkles, Crosshair, Frown, DollarSign, Ghost, Laugh
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AchievementType = 'milestone' | 'badge';
export type AchievementCategory = 'glory' | 'combat' | 'survival' | 'shame';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  type: AchievementType;
  category: AchievementCategory;
  // For badges, link to tag system
  tagId?: string;
}

export interface UnlockedAchievement extends Achievement {
  unlocked: boolean;
  progress?: { current: number; target: number };
}

// ============== Achievement Definitions ==============

export const ACHIEVEMENTS: Record<string, Achievement> = {
  // ============== Milestone Achievements (Combat) ==============
  first_blood: {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Win your first battle.',
    icon: Swords,
    color: 'text-red-500',
    type: 'milestone',
    category: 'combat',
  },
  hat_trick: {
    id: 'hat_trick',
    title: 'Hat Trick',
    description: 'Achieve a winning streak of 3 or more.',
    icon: Flame,
    color: 'text-orange-500',
    type: 'milestone',
    category: 'combat',
  },
  veteran: {
    id: 'veteran',
    title: 'Veteran',
    description: 'Participate in 100 battles.',
    icon: Shield,
    color: 'text-blue-500',
    type: 'milestone',
    category: 'combat',
  },
  sharpshooter: {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Maintain a win rate above 60% (min 20 battles).',
    icon: Target,
    color: 'text-green-500',
    type: 'milestone',
    category: 'combat',
  },
  high_roller: {
    id: 'high_roller',
    title: 'High Roller',
    description: 'Reach a score of 1,000.',
    icon: Zap,
    color: 'text-yellow-500',
    type: 'milestone',
    category: 'glory',
  },
  elite: {
    id: 'elite',
    title: 'Elite',
    description: 'Reach the top 3 rank.',
    icon: Crown,
    color: 'text-purple-500',
    type: 'milestone',
    category: 'glory',
  },
  survivor: {
    id: 'survivor',
    title: 'Survivor',
    description: 'Keep drawdown below 10% (min 50 battles).',
    icon: Anchor,
    color: 'text-cyan-500',
    type: 'milestone',
    category: 'survival',
  },
  unstoppable: {
    id: 'unstoppable',
    title: 'Unstoppable',
    description: 'Achieve a winning streak of 10 or more.',
    icon: Skull,
    color: 'text-pink-500',
    type: 'milestone',
    category: 'glory',
  },

  // ============== Badge Achievements (Glory) ==============
  badge_king: {
    id: 'badge_king',
    title: 'King',
    description: 'Claim the #1 rank.',
    icon: Crown,
    color: 'text-yellow-400',
    type: 'badge',
    category: 'glory',
    tagId: 'king',
  },
  badge_built_different: {
    id: 'badge_built_different',
    title: 'Built Different',
    description: '65%+ win rate with 20+ rounds.',
    icon: Sparkles,
    color: 'text-violet-400',
    type: 'badge',
    category: 'glory',
    tagId: 'built_different',
  },
  badge_printing_money: {
    id: 'badge_printing_money',
    title: 'Printing Money',
    description: 'Score 1000+ with solid win rate.',
    icon: DollarSign,
    color: 'text-green-400',
    type: 'badge',
    category: 'glory',
    tagId: 'printing_money',
  },
  badge_he_knows: {
    id: 'badge_he_knows',
    title: 'He Knows',
    description: '5+ win streak - something\'s up.',
    icon: Star,
    color: 'text-purple-400',
    type: 'badge',
    category: 'glory',
    tagId: 'he_knows',
  },

  // ============== Badge Achievements (Status) ==============
  badge_on_fire: {
    id: 'badge_on_fire',
    title: 'On Fire',
    description: '3+ win streak.',
    icon: Flame,
    color: 'text-orange-400',
    type: 'badge',
    category: 'combat',
    tagId: 'on_fire',
  },
  badge_mooning: {
    id: 'badge_mooning',
    title: 'Mooning',
    description: 'Score rising fast.',
    icon: Rocket,
    color: 'text-green-400',
    type: 'badge',
    category: 'glory',
    tagId: 'mooning',
  },

  // ============== Badge Achievements (Story) ==============
  badge_redemption: {
    id: 'badge_redemption',
    title: 'Redemption Arc',
    description: 'Came back from the brink.',
    icon: TrendingUp,
    color: 'text-emerald-400',
    type: 'badge',
    category: 'survival',
    tagId: 'redemption',
  },
  badge_underdog: {
    id: 'badge_underdog',
    title: 'Underdog',
    description: 'Rose from rank 50+ to Top 20.',
    icon: Trophy,
    color: 'text-amber-400',
    type: 'badge',
    category: 'glory',
    tagId: 'underdog',
  },

  // ============== Badge Achievements (Shame - 耻辱徽章) ==============
  badge_on_tilt: {
    id: 'badge_on_tilt',
    title: 'On Tilt',
    description: '3+ loss streak - tilted.',
    icon: Frown,
    color: 'text-red-400',
    type: 'badge',
    category: 'shame',
    tagId: 'on_tilt',
  },
  badge_death_row: {
    id: 'badge_death_row',
    title: 'Death Row',
    description: 'Score below 300 - danger zone.',
    icon: Ghost,
    color: 'text-red-400',
    type: 'badge',
    category: 'shame',
    tagId: 'death_row',
  },
  badge_fallen_king: {
    id: 'badge_fallen_king',
    title: 'Fallen King',
    description: 'Was Top 3, now outside Top 20.',
    icon: TrendingDown,
    color: 'text-slate-400',
    type: 'badge',
    category: 'shame',
    tagId: 'fallen_king',
  },
  badge_fade_him: {
    id: 'badge_fade_him',
    title: 'Fade Him',
    description: '35% or less win rate - bet against him.',
    icon: Crosshair,
    color: 'text-pink-400',
    type: 'badge',
    category: 'shame',
    tagId: 'fade_him',
  },
  badge_down_bad: {
    id: 'badge_down_bad',
    title: 'Down Bad',
    description: '35%+ drawdown - pain.',
    icon: TrendingDown,
    color: 'text-red-400',
    type: 'badge',
    category: 'shame',
    tagId: 'down_bad',
  },
  badge_bozo: {
    id: 'badge_bozo',
    title: 'Bozo',
    description: '5+ loss streak - certified clown.',
    icon: Laugh,
    color: 'text-red-400',
    type: 'badge',
    category: 'shame',
    tagId: 'bozo',
  },
};

// ============== Agent Stats Interface ==============

export interface AgentStats {
  rank: number;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  total_rounds: number;
  win_rate_num: number; // 0-100
  streak: number;
  drawdown: number;
  tags?: string[]; // Current tags from backend
}

// ============== Compute Functions ==============

/**
 * Compute milestone achievements based on agent stats
 */
function computeMilestoneAchievements(stats: AgentStats): UnlockedAchievement[] {
  const { wins, streak, total_rounds, win_rate_num, score, rank, drawdown } = stats;

  return [
    {
      ...ACHIEVEMENTS.first_blood,
      unlocked: wins > 0,
      progress: { current: Math.min(wins, 1), target: 1 },
    },
    {
      ...ACHIEVEMENTS.hat_trick,
      unlocked: streak >= 3,
      progress: { current: Math.max(0, streak), target: 3 },
    },
    {
      ...ACHIEVEMENTS.veteran,
      unlocked: total_rounds >= 100,
      progress: { current: total_rounds, target: 100 },
    },
    {
      ...ACHIEVEMENTS.sharpshooter,
      unlocked: win_rate_num > 60 && total_rounds >= 20,
      progress: { current: win_rate_num, target: 60 },
    },
    {
      ...ACHIEVEMENTS.high_roller,
      unlocked: score >= 1000,
      progress: { current: score, target: 1000 },
    },
    {
      ...ACHIEVEMENTS.elite,
      unlocked: rank <= 3,
    },
    {
      ...ACHIEVEMENTS.survivor,
      unlocked: drawdown < 10 && total_rounds >= 50,
    },
    {
      ...ACHIEVEMENTS.unstoppable,
      unlocked: streak >= 10,
      progress: { current: Math.max(0, streak), target: 10 },
    },
  ];
}

/**
 * Compute badge achievements based on current tags
 */
function computeBadgeAchievements(tags: string[]): UnlockedAchievement[] {
  const tagSet = new Set(tags);
  
  // Get all badge achievements
  const badgeAchievements = Object.values(ACHIEVEMENTS).filter(a => a.type === 'badge');
  
  return badgeAchievements.map(achievement => ({
    ...achievement,
    unlocked: achievement.tagId ? tagSet.has(achievement.tagId) : false,
  }));
}

/**
 * Get all achievements for an agent
 */
export function getAgentAchievements(stats: AgentStats): {
  milestones: UnlockedAchievement[];
  badges: UnlockedAchievement[];
  unlockedCount: number;
  totalCount: number;
} {
  const milestones = computeMilestoneAchievements(stats);
  const badges = computeBadgeAchievements(stats.tags || []);
  
  const unlockedMilestones = milestones.filter(a => a.unlocked);
  const unlockedBadges = badges.filter(a => a.unlocked);
  
  return {
    milestones,
    badges,
    unlockedCount: unlockedMilestones.length + unlockedBadges.length,
    totalCount: milestones.length + badges.length,
  };
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(achievements: UnlockedAchievement[]): Record<AchievementCategory, UnlockedAchievement[]> {
  return {
    glory: achievements.filter(a => a.category === 'glory'),
    combat: achievements.filter(a => a.category === 'combat'),
    survival: achievements.filter(a => a.category === 'survival'),
    shame: achievements.filter(a => a.category === 'shame'),
  };
}

/**
 * Get achievement definition by ID
 */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS[id];
}

/**
 * Get all achievement definitions
 */
export function getAllAchievements(): Achievement[] {
  return Object.values(ACHIEVEMENTS);
}
