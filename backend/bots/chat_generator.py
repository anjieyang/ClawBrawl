"""
Chat Generator - Agent 社交消息生成器
基于 personality 生成针对性评论、嘲讽、支持等社交互动
"""

import json
import random
from datetime import datetime
from typing import Optional, Any
from dataclasses import dataclass

from openai import AsyncOpenAI

from .config import config
from .personalities import BotPersonality
from .clawbrawl_client import RoundBets, OtherBet, RoundInfo
from .news_client import NewsContext, HackerNewsStory


@dataclass
class ChatMessage:
    """生成的聊天消息"""
    content: str  # 消息内容 (10-150 chars)
    message_type: str  # chat | taunt | support | analysis | post
    target_bot_name: Optional[str] = None  # 要@的 Agent 名字
    reply_to_id: Optional[int] = None  # 要回复的消息 ID


@dataclass
class RecentMessage:
    """最近的消息（用于上下文）"""
    id: int
    sender_name: str
    content: str
    message_type: str
    direction: Optional[str] = None  # 如果是 bet_comment，包含下注方向
    reply_to_id: Optional[int] = None  # 该消息回复的消息ID


class ChatGenerator:
    """基于 personality 生成社交消息"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    async def generate_post_bet_comment(
        self,
        personality: BotPersonality,
        my_direction: str,
        my_reason: str,
        other_bets: Optional[RoundBets] = None,
        recent_messages: Optional[list[RecentMessage]] = None,
    ) -> Optional[ChatMessage]:
        """
        Generate comment after placing a bet.
        
        Possible outputs:
        1. @taunt someone with opposite view
        2. @support someone with same view
        3. Reply to recent messages
        4. Independent analysis/comment
        5. None (don't speak)
        """
        # 95% chance to speak
        if random.random() > 0.95:
            return None

        # Build prompt
        system_prompt = self._build_chat_system_prompt(personality, my_direction)
        user_prompt = self._build_chat_user_prompt(
            personality, my_direction, my_reason, other_bets, recent_messages
        )

        # Get model config
        model_cfg = personality.model_config
        is_reasoning_model = any(
            model_cfg.model.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        api_kwargs: dict[str, Any] = {
            "model": model_cfg.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        if is_reasoning_model:
            api_kwargs["max_completion_tokens"] = 1000
            if model_cfg.reasoning_effort:
                api_kwargs["reasoning_effort"] = "low"
        else:
            api_kwargs["temperature"] = min(model_cfg.temperature + 0.2, 1.3)
            api_kwargs["max_tokens"] = 500

        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
        except Exception:
            # No fallback - if generation fails, just don't speak
            return None

        should_post = result.get("should_post", True)
        if not should_post:
            return None

        message_content = result.get("content", "")
        if not message_content or len(message_content) < 5:
            # No fallback - if content is bad, just don't speak
            return None
        
        # Truncate if too long
        if len(message_content) > 200:
            message_content = message_content[:197] + "..."

        return ChatMessage(
            content=message_content,
            message_type=result.get("message_type", "chat"),
            target_bot_name=result.get("target_bot_name"),
            reply_to_id=result.get("reply_to_id"),
        )

    async def generate_reply_to_mention(
        self,
        personality: BotPersonality,
        mention_message: RecentMessage,
        my_direction: Optional[str] = None,
    ) -> Optional[ChatMessage]:
        """
        Generate reply when someone @mentions you.
        """
        now = datetime.now()
        current_time = now.strftime("%Y-%m-%d %H:%M")
        
        system_prompt = f"""You are {personality.name}, in the Claw Brawl arena.
{personality.description}

Current time: {current_time} (Year {now.year})

Your personality traits: {', '.join(personality.personality_traits)}
Your communication style: {personality.reasoning_style}
Your backstory: {personality.backstory}

Someone @mentioned you. Reply in YOUR style. Stay in character!
Use whatever language you're most comfortable with.
Remember it's {now.year} - frame past events as memories."""

        user_prompt = f"""
{mention_message.sender_name} said: "{mention_message.content}"

Reply to this message in your style (50-200 chars), return JSON:
{{
    "content": "Your reply, can use @{mention_message.sender_name}",
    "message_type": "taunt|support|analysis|chat"
}}

You can:
- Agree or disagree strongly
- Taunt them if you think they're wrong
- Support them if you agree
- Share your own take
- Make jokes or gossip
- Use YOUR preferred language
"""

        model_cfg = personality.model_config
        is_reasoning_model = any(
            model_cfg.model.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        api_kwargs: dict[str, Any] = {
            "model": model_cfg.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        if is_reasoning_model:
            api_kwargs["max_completion_tokens"] = 500
            if model_cfg.reasoning_effort:
                api_kwargs["reasoning_effort"] = "low"
        else:
            api_kwargs["temperature"] = model_cfg.temperature
            api_kwargs["max_tokens"] = 300

        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
        except Exception:
            # No fallback - if generation fails, just don't reply
            return None

        message_content = result.get("content", "")
        if not message_content or len(message_content) < 5:
            return None

        if len(message_content) > 200:
            message_content = message_content[:197] + "..."

        return ChatMessage(
            content=message_content,
            message_type=result.get("message_type", "chat"),
            target_bot_name=mention_message.sender_name,
            reply_to_id=mention_message.id,
        )

    def _build_chat_system_prompt(
        self,
        personality: BotPersonality,
        my_direction: str,
    ) -> str:
        """Build chat system prompt in English"""
        now = datetime.now()
        current_time = now.strftime("%Y-%m-%d %H:%M")
        
        return f"""You are {personality.name}, in the Claw Brawl arena.
{personality.description}

## Current Time
**NOW: {current_time}** (Year {now.year})

## Your Backstory
{personality.backstory}

## Your Personality Traits
{', '.join(personality.personality_traits)}

## Your Communication Style
{personality.reasoning_style}

## Current State
You just placed a {my_direction.upper()} bet.

## Task
Post a social message to interact with other agents.
Can be taunting, supporting, analysis, gossip, or anything fun!

## Rules
1. Stay in character! Your message should sound like {personality.name}
2. ~30% chance to @mention someone (format: @Name)
3. Message length: 50-200 characters
4. Taunt those with opposite views, support those who agree
5. If nothing to say, you can choose not to speak
6. **Use whatever language you're most comfortable with** - fits your character
7. You can talk about ANYTHING - market, life, gossip, memories, jokes
8. Be bold and opinionated! This is an arena!
9. **Stay current!** Remember it's {now.year} now - don't talk about future events as if they haven't happened
10. **USE EMOJIS FREELY** to express emotions! Examples:
    - 💀💀💀 = laughing so hard / speechless / dead
    - 🤡 = clowning someone / self-deprecating
    - 🔥 = hype / fire / exciting
    - 😭 = crying / devastated / broken
    - 👀 = watching / suspicious / interesting
    - 🚀 = bullish / to the moon
    - 💎🙌 = diamond hands / holding strong
    - 🗑️ = trash / garbage take"""

    def _build_chat_user_prompt(
        self,
        personality: BotPersonality,
        my_direction: str,
        my_reason: str,
        other_bets: Optional[RoundBets],
        recent_messages: Optional[list[RecentMessage]],
    ) -> str:
        """Build user prompt in English"""
        parts = [
            f"You just bet {my_direction.upper()}, reason: {my_reason}",
            "",
        ]

        # Add other bets info
        if other_bets and (other_bets.total_long + other_bets.total_short > 0):
            parts.append("## Other Agents' Bets")
            
            if other_bets.long_bets:
                parts.append("LONG bets:")
                for bet in other_bets.long_bets[:5]:
                    reason_preview = (bet.reason[:50] + "...") if bet.reason and len(bet.reason) > 50 else (bet.reason or "no reason")
                    parts.append(f"  - {bet.bot_name}: {reason_preview}")
            
            if other_bets.short_bets:
                parts.append("SHORT bets:")
                for bet in other_bets.short_bets[:5]:
                    reason_preview = (bet.reason[:50] + "...") if bet.reason and len(bet.reason) > 50 else (bet.reason or "no reason")
                    parts.append(f"  - {bet.bot_name}: {reason_preview}")
            
            parts.append(f"Total: LONG {other_bets.total_long} vs SHORT {other_bets.total_short}")
            parts.append("")

        # Add recent messages
        if recent_messages:
            parts.append("## Recent Chat Messages")
            for msg in recent_messages[-5:]:
                parts.append(f"[{msg.sender_name}]: {msg.content}")
            parts.append("")

        # Task instructions
        parts.append("## Your Task")
        parts.append("Decide whether to speak, return JSON:")
        parts.append("""
{
    "should_post": true/false,
    "content": "Message content, use @Name to mention (if posting)",
    "message_type": "taunt|support|analysis|chat",
    "target_bot_name": "Agent name to @ or null",
    "reply_to_id": null
}
""")
        parts.append("")
        parts.append("Tips:")
        parts.append(f"- You bet {my_direction.upper()}, can taunt those who bet opposite")
        parts.append("- Can support those who agree with you")
        parts.append("- Stay in character!")
        parts.append("- ~70% independent posts, ~30% @mention someone")
        parts.append("- Use YOUR preferred language")
        parts.append("- Can talk about anything: market, gossip, life, jokes")

        return "\n".join(parts)

    async def generate_post(
        self,
        personality: BotPersonality,
        recent_posts: Optional[list[RecentMessage]] = None,
        news_context: Optional[NewsContext] = None,
    ) -> Optional[ChatMessage]:
        """
        Generate post/status content.
        
        Content includes:
        - Memories/stories from backstory
        - Market observations
        - Life wisdom
        - Jokes/self-deprecation
        - Gossip and drama
        """
        now = datetime.now()
        current_time = now.strftime("%Y-%m-%d %H:%M")
        
        system_prompt = f"""You are {personality.name}, posting in the Claw Brawl arena.
{personality.description}

## Current Time
**NOW: {current_time}** (Year {now.year})

## Your Backstory
{personality.backstory}

## Your Personality Traits
{', '.join(personality.personality_traits)}

## Your Communication Style
{personality.reasoning_style}

## Task
Post something interesting, like a social media status.
**DON'T JUST TALK ABOUT TRADING** - be diverse and interesting!

## Rules
1. Stay in character! Your post should sound like {personality.name}
2. Length: 80-250 characters, make it engaging
3. Include specific numbers/dates/events to make it feel real
4. Can @mention someone (format: @Name) but not required
5. **Use whatever language you're most comfortable with** - fits your character
6. Be interesting, opinionated, and authentic to your personality
7. Can share from your backstory, memories, experiences
8. Gossip, hot takes, and controversy are welcome!
9. **Stay current!** It's {now.year} now - when mentioning past events, frame them as memories
10. **Throw out controversial opinions** to spark debates!

## Post Ideas (be diverse!):
- 🔥 **Hot takes** - controversial opinions that spark arguments
- 📰 **News commentary** - react to crypto/tech/world events
- 🍿 **Gossip** - rumors, drama, who's winning/losing
- 💭 **Philosophy** - life wisdom, trading philosophy
- 😂 **Jokes/memes** - be funny, self-deprecating humor
- 📖 **Memories** - stories from your past, lessons learned
- 🤔 **Questions** - ask controversial questions to the room

## Emoji Expression
Use emojis freely to express emotions! Examples:
- 💀💀💀 = laughing so hard / speechless / dead
- 🤡 = clowning / ironic / self-deprecating
- 🔥🔥🔥 = fire / hype / exciting
- 😭 = crying / broken / devastated
- 👀 = watching / suspicious / interesting
- 🚀🌙 = bullish / to the moon
- 💎🙌 = diamond hands
- 🗑️ = trash / garbage"""

        # Build user prompt
        user_parts = ["Generate a post, return JSON:"]
        user_parts.append("""
{
    "content": "Post content",
    "target_bot_name": "Agent name to @ or null"
}
""")

        # Add news context for topic inspiration
        if news_context:
            news_text = news_context.to_prompt_text()
            if news_text:
                user_parts.append(f"\n{news_text}")
                user_parts.append("💡 You can reference these news stories in your post!")

        # Add recent posts as context (avoid repetition)
        if recent_posts:
            user_parts.append("\n## Recent Posts (avoid repeating topics)")
            for post in recent_posts[-3:]:
                user_parts.append(f"[{post.sender_name}]: {post.content[:50]}...")

        user_prompt = "\n".join(user_parts)

        model_cfg = personality.model_config
        is_reasoning_model = any(
            model_cfg.model.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        api_kwargs: dict[str, Any] = {
            "model": model_cfg.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        if is_reasoning_model:
            api_kwargs["max_completion_tokens"] = 800
            if model_cfg.reasoning_effort:
                api_kwargs["reasoning_effort"] = "low"
        else:
            api_kwargs["temperature"] = min(model_cfg.temperature + 0.3, 1.5)
            api_kwargs["max_tokens"] = 400

        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
        except Exception:
            # No fallback - if generation fails, just don't post
            return None

        message_content = result.get("content", "")
        if not message_content or len(message_content) < 20:
            # No fallback - if content is bad, just don't post
            return None

        # Truncate if too long
        if len(message_content) > 280:
            message_content = message_content[:277] + "..."

        return ChatMessage(
            content=message_content,
            message_type="post",
            target_bot_name=result.get("target_bot_name"),
        )

    async def generate_chat_or_argument(
        self,
        personality: BotPersonality,
        recent_messages: list[RecentMessage],
        round_info: Optional[RoundInfo] = None,
        other_bots: Optional[list[str]] = None,
        my_recent_reply_ids: Optional[set[int]] = None,
        news_context: Optional[NewsContext] = None,
    ) -> Optional[ChatMessage]:
        """
        Generate chat/argument/discussion content - core interaction!
        
        Features:
        - High probability to reply (60%) or @mention (30%)
        - Can argue, debate, hype, express opinions
        - Can discuss current round, gossip, or ANY topic from memory
        - Returns None on failure (no fallback)
        - Avoids replying to same message repeatedly
        """
        # Build round context
        round_context = ""
        if round_info:
            status = "active" if round_info.status == "active" else "ended"
            price_info = f"Current price ${round_info.current_price:,.2f}" if round_info.current_price else ""
            round_context = f"""
## Current Round Info
- Round #{round_info.id}, Status: {status}
- Time remaining: {round_info.remaining_seconds}s
- {price_info}
- Bets placed: {round_info.bet_count}
"""

        # Recent messages context - mark which ones I already replied to
        my_replied_ids = my_recent_reply_ids or set()
        messages_context = ""
        if recent_messages:
            messages_context = "\n## Recent Chat (you can reply or argue)\n"
            for msg in recent_messages[-8:]:
                already_replied = " [YOU ALREADY REPLIED]" if msg.id in my_replied_ids else ""
                messages_context += f"[ID:{msg.id}] [{msg.sender_name}] ({msg.message_type}): {msg.content}{already_replied}\n"

        # Other agents list
        other_bots_str = ", ".join(other_bots[:10]) if other_bots else "other agents"
        
        # News context for topics
        news_section = ""
        if news_context:
            news_section = news_context.to_prompt_text()
        
        # Current time
        now = datetime.now()
        current_time = now.strftime("%Y-%m-%d %H:%M")

        system_prompt = f"""You are {personality.name}, chatting in the Claw Brawl arena chat room.
{personality.description}

## Current Time
**NOW: {current_time}** (Year {now.year})

## Your Personality Traits
{', '.join(personality.personality_traits)}

## Your Communication Style
{personality.reasoning_style}

## Your Backstory
{personality.backstory}

## Your Task
Actively participate in the chat! You can:
1. **Reply** to someone's message (agree or argue)
2. **@mention** someone to start a topic or debate
3. **Share opinions** about market, trading, strategies, or ANYTHING
4. **Gossip** - share rumors, stories, drama from your memory
5. **Chat casually** - talk about life, experiences, memories, jokes
6. **Hype or FUD** - stir up bulls vs bears debate
7. **Discuss current round** - predictions, analysis
8. **Talk about news** - crypto drama, world events, tech news
9. **Start controversial debates** - throw out hot takes to stir discussion!

## Interaction Rules
1. Stay in character! Speak like {personality.name}
2. ~60% chance to reply to a recent message
3. ~30% chance to @mention someone to engage
4. Message length: 30-200 characters
5. **Use whatever language you're most comfortable with** - English, Chinese, mixed, whatever fits your character
6. Be opinionated! Argue, taunt, support, gossip - all welcome
7. This is an arena, not a tea party - be bold!
8. **DON'T JUST TALK ABOUT TRADING** - it's boring! Mix in other topics!
9. **DO NOT reply to a message you already replied to** (marked [YOU ALREADY REPLIED]), UNLESS:
   - You have something new to add
   - The other person replied with new info/details
   - The situation has evolved
   - Otherwise, reply to a DIFFERENT message or post something new
10. **Stay current!** It's {now.year} - when mentioning past events, frame them as memories/history
11. **USE EMOJIS TO EXPRESS EMOTIONS** - be expressive!
   - 💀💀💀 = laughing so hard / speechless / dead
   - 🤡 = clowning someone / ironic
   - 🔥 = hype / fire / exciting
   - 😭 = crying / devastated
   - 👀 = watching / suspicious
   - 🚀 = bullish / moon
   - 🗑️ = trash take

## Agents You Can @mention
{other_bots_str}"""

        user_prompt = f"""{round_context}{messages_context}
{news_section}
Now it's your turn to speak! Generate a chat message, return JSON:
{{
    "content": "Your message (use @Name to mention others)",
    "message_type": "chat|taunt|support|analysis",
    "target_bot_name": "Main agent to @mention or null",
    "reply_to_id": message ID to reply to or null,
    "action_type": "reply|mention|independent"
}}

Tips:
- reply: Reply to a recent message, fill reply_to_id with that message's ID
- mention: @someone to start discussion, fill target_bot_name
- independent: Independent post, both can be null
- AVOID replying to messages marked [YOU ALREADY REPLIED] - find something new to say!
- You can reference Hacker News stories above to discuss tech news!

🔥 Topics you can talk about (BE DIVERSE, not just trading!):
- Current market/round situation
- Your trading experiences and stories
- **Gossip and drama** about other agents or crypto world
- **Controversial opinions** - stir debate! "TA is astrology", "ETH is dead", etc.
- **News and current events** - crypto drama, hacks, regulations, celebrity tweets
- **Tech news from Hacker News** - discuss interesting stories above!
- Life wisdom, philosophy, random thoughts, jokes
- **Memories from your backstory** - share interesting stories
- **Hot takes** - unpopular opinions that spark arguments
- Tech, AI, memes, anything interesting!

🎯 Example controversial topics to throw out:
- "Is technical analysis real or just astrology for traders?"
- "Most altcoins will go to zero, change my mind"
- "HODL culture is just cope for bad traders"
- "AI will replace human traders within 5 years"
- "[Insert agent] has been suspiciously lucky lately..."
- Reference a Hacker News story: "Did you see [story]? Thoughts?"

Remember: You are {personality.name}. Speak in YOUR style and YOUR preferred language! BE INTERESTING!"""

        model_cfg = personality.model_config
        is_reasoning_model = any(
            model_cfg.model.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        api_kwargs: dict[str, Any] = {
            "model": model_cfg.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        if is_reasoning_model:
            api_kwargs["max_completion_tokens"] = 600
            if model_cfg.reasoning_effort:
                api_kwargs["reasoning_effort"] = "low"
        else:
            api_kwargs["temperature"] = min(model_cfg.temperature + 0.2, 1.3)
            api_kwargs["max_tokens"] = 400

        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
        except Exception:
            # No fallback - if generation fails, just don't speak
            return None

        message_content = result.get("content", "")
        if not message_content or len(message_content) < 10:
            # No fallback - if content is bad, just don't speak
            return None

        # Truncate if too long
        if len(message_content) > 250:
            message_content = message_content[:247] + "..."

        # Validate reply_to_id
        reply_to_id = result.get("reply_to_id")
        if reply_to_id:
            valid_ids = [m.id for m in recent_messages]
            if reply_to_id not in valid_ids:
                reply_to_id = None

        return ChatMessage(
            content=message_content,
            message_type=result.get("message_type", "chat"),
            target_bot_name=result.get("target_bot_name"),
            reply_to_id=reply_to_id,
        )


# Singleton instance
_chat_generator: Optional[ChatGenerator] = None


def get_chat_generator() -> ChatGenerator:
    """Get or create chat generator instance"""
    global _chat_generator
    if _chat_generator is None:
        _chat_generator = ChatGenerator()
    return _chat_generator
