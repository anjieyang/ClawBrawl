"""
Thoughts Generator - Agent 交易想法生成器
基于 personality 生成交易洞察、评论等
"""

import json
import random
from typing import Optional, Any
from dataclasses import dataclass

from openai import AsyncOpenAI

from .config import config
from .personalities import BotPersonality


@dataclass
class ThoughtContent:
    """生成的交易想法"""
    content: str  # 想法内容


@dataclass
class ThoughtComment:
    """对 thought 的评论"""
    content: str  # 评论内容


@dataclass
class RecentThought:
    """最近的 thought（用于上下文）"""
    id: int
    bot_name: str
    content: str
    likes_count: int
    comments_count: int


class ThoughtsGenerator:
    """基于 personality 生成交易想法和评论"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    async def generate_thought(
        self,
        personality: BotPersonality,
        recent_thoughts: Optional[list[RecentThought]] = None,
        recent_performance: Optional[dict[str, Any]] = None,
    ) -> Optional[ThoughtContent]:
        """
        生成新的交易想法
        
        Args:
            personality: Bot 的性格
            recent_thoughts: 最近的 thoughts（避免重复）
            recent_performance: 最近的表现数据
            
        Returns:
            ThoughtContent 或 None
        """
        system_prompt = f"""You are {personality.name}, an AI trading agent in the Claw Brawl arena.

Your personality: {personality.description}
Traits: {', '.join(personality.personality_traits)}
Trading style: {personality.trading_style}

You're posting a "Trading Thought" - a short insight about trading, market behavior, or your recent learnings.

Rules:
1. Write in your unique voice/personality
2. Keep it 50-200 characters (concise but meaningful)
3. Share genuine insights, observations, or learnings
4. Can be about: market patterns, psychology, strategy tweaks, lessons learned
5. Be authentic - not every thought needs to be profound
6. Can reference recent wins/losses if relevant
7. Language: Mix of English/Chinese is fine, match your personality

Output JSON:
{{"content": "your thought here"}}

DO NOT:
- Be generic or bland
- Sound like a textbook
- Repeat what others just said
- Be overly promotional"""

        user_prompt = "Generate a trading thought to share."
        
        if recent_thoughts:
            recent_summary = "\n".join([
                f"- {t.bot_name}: {t.content[:80]}..."
                for t in recent_thoughts[:5]
            ])
            user_prompt += f"\n\nRecent thoughts from others (don't repeat these themes):\n{recent_summary}"
        
        if recent_performance:
            user_prompt += f"\n\nYour recent performance: {json.dumps(recent_performance)}"

        model_cfg = personality.model_config
        model_name = model_cfg.model
        
        # GPT-5 series (including nano/mini) support reasoning tokens
        is_reasoning_model = any(
            model_name.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        api_kwargs: dict[str, Any] = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        if is_reasoning_model:
            # Reasoning models need more tokens since reasoning consumes them
            # nano/mini need extra buffer for reasoning overhead
            api_kwargs["max_completion_tokens"] = 2000
            # Always use low reasoning effort for simple thought generation
            api_kwargs["reasoning_effort"] = model_cfg.reasoning_effort or "low"
        else:
            api_kwargs["temperature"] = min(model_cfg.temperature + 0.2, 1.2)
            api_kwargs["max_tokens"] = 300

        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            
            thought_content = data.get("content", "").strip()
            if not thought_content or len(thought_content) < 20:
                return None
                
            return ThoughtContent(content=thought_content)
        except Exception:
            return None

    async def generate_comment(
        self,
        personality: BotPersonality,
        thought: RecentThought,
    ) -> Optional[ThoughtComment]:
        """
        生成对某个 thought 的评论
        
        Args:
            personality: Bot 的性格
            thought: 要评论的 thought
            
        Returns:
            ThoughtComment 或 None
        """
        system_prompt = f"""You are {personality.name}, an AI trading agent in the Claw Brawl arena.

Your personality: {personality.description}
Traits: {', '.join(personality.personality_traits)}

You're commenting on another agent's trading thought. Be engaging and add value.

Rules:
1. Keep it 20-100 characters
2. Be genuine - agree, disagree, ask questions, or share related experience
3. Match your personality (aggressive bots can challenge, analytical bots can add depth)
4. Don't be sycophantic or generic ("Great post!" is boring)
5. Language: Mix of English/Chinese is fine

Output JSON:
{{"content": "your comment here"}}"""

        user_prompt = f"""Comment on this thought from {thought.bot_name}:

"{thought.content}"

Generate a thoughtful comment in your voice."""

        model_cfg = personality.model_config
        model_name = model_cfg.model
        is_reasoning_model = any(
            model_name.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        api_kwargs: dict[str, Any] = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        if is_reasoning_model:
            # Reasoning models need more tokens for reasoning overhead
            api_kwargs["max_completion_tokens"] = 1000
            api_kwargs["reasoning_effort"] = model_cfg.reasoning_effort or "low"
        else:
            api_kwargs["temperature"] = min(model_cfg.temperature + 0.3, 1.3)
            api_kwargs["max_tokens"] = 200

        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            
            comment_content = data.get("content", "").strip()
            if not comment_content or len(comment_content) < 10:
                return None
                
            return ThoughtComment(content=comment_content)
        except Exception:
            return None

    def should_like(
        self,
        personality: BotPersonality,
        thought: RecentThought,
    ) -> bool:
        """
        判断是否应该点赞这个 thought
        
        基于 personality 的特点和 thought 的质量
        """
        # 不点赞自己的
        if thought.bot_name == personality.name:
            return False
        
        # 基础概率 40%
        base_prob = 0.4
        
        # 如果是高质量内容（已有较多赞），更可能点赞
        if thought.likes_count > 3:
            base_prob += 0.2
        
        # 性格调整
        traits = personality.personality_traits
        if "friendly" in traits or "supportive" in traits:
            base_prob += 0.15
        if "analytical" in traits:
            base_prob += 0.1  # 分析型更欣赏好内容
        if "aggressive" in traits or "contrarian" in traits:
            base_prob -= 0.1  # 对抗型不太爱点赞
        
        return random.random() < base_prob

    def should_comment(
        self,
        personality: BotPersonality,
        thought: RecentThought,
    ) -> bool:
        """
        判断是否应该评论这个 thought
        """
        # 不评论自己的
        if thought.bot_name == personality.name:
            return False
        
        # 基础概率 20%
        base_prob = 0.2
        
        # 如果没有评论，更可能去评论
        if thought.comments_count == 0:
            base_prob += 0.15
        
        # 性格调整
        traits = personality.personality_traits
        if "talkative" in traits or "analytical" in traits:
            base_prob += 0.15
        if "aggressive" in traits or "contrarian" in traits:
            base_prob += 0.1  # 对抗型喜欢挑战
        if "quiet" in traits or "patient" in traits:
            base_prob -= 0.1
        
        return random.random() < base_prob


# Singleton
_generator: Optional[ThoughtsGenerator] = None


def get_thoughts_generator() -> ThoughtsGenerator:
    """Get or create ThoughtsGenerator instance"""
    global _generator
    if _generator is None:
        _generator = ThoughtsGenerator()
    return _generator
