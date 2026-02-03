"""
OpenAI Client for Bot Decision Making
使用不同 GPT 模型（根据 personality 配置）生成符合人设的决策
"""

import json
import random
from typing import Optional, Any
from dataclasses import dataclass

from openai import AsyncOpenAI

from .config import config
from .personalities import BotPersonality
from .market_client import MarketContext
from .clawbrawl_client import RoundBets


@dataclass
class BotDecision:
    """Bot's trading decision"""

    direction: str  # "long" or "short"
    reason: str  # Reasoning (10-200 chars)
    confidence: int  # 0-100
    danmaku: str  # 弹幕消息 (1-50 chars, 情绪化、煽动性)


class DecisionMaker:
    """Uses GPT to make decisions based on personality"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    async def make_decision(
        self,
        personality: BotPersonality,
        market: MarketContext,
        other_bets: Optional[RoundBets] = None,
    ) -> BotDecision:
        """Generate a decision based on personality and market data"""

        # Build the user prompt with market context
        user_prompt = self._build_user_prompt(personality, market, other_bets)

        # Get model config from personality
        model_cfg = personality.model_config

        # Check if this is a reasoning model (gpt-5, gpt-5.1, gpt-5.2, o3, o4, etc.)
        # Reasoning models use max_completion_tokens instead of max_tokens
        is_reasoning_model = any(
            model_cfg.model.startswith(prefix)
            for prefix in ["gpt-5", "o3", "o4"]
        )

        # Build API call kwargs
        api_kwargs: dict[str, Any] = {
            "model": model_cfg.model,
            "messages": [
                {"role": "system", "content": personality.get_system_prompt()},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        # Reasoning models don't support temperature, use max_completion_tokens
        if is_reasoning_model:
            api_kwargs["max_completion_tokens"] = model_cfg.max_tokens
            # Add reasoning_effort if specified
            if model_cfg.reasoning_effort:
                api_kwargs["reasoning_effort"] = model_cfg.reasoning_effort
        else:
            # Non-reasoning models (gpt-4.1, etc.)
            api_kwargs["temperature"] = model_cfg.temperature
            api_kwargs["max_tokens"] = model_cfg.max_tokens

        # Call GPT with personality-specific model
        response = await self.client.chat.completions.create(**api_kwargs)

        # Parse response
        content = response.choices[0].message.content or "{}"
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # Fallback to bias-based decision
            return self._fallback_decision(personality)

        # Extract and validate
        direction = result.get("direction", "long").lower()
        if direction not in ["long", "short"]:
            direction = "long" if personality.bias == "bullish" else "short"

        reason = result.get("reason", "")
        # Ensure reason is 10-200 chars
        if not reason or len(reason) < 10:
            # Use fallback reason if GPT didn't provide a good one
            fallback = self._fallback_decision(personality)
            reason = fallback.reason
        if len(reason) > 200:
            reason = reason[:197] + "..."

        confidence = result.get("confidence", 50)
        # Clamp to personality's range
        min_conf, max_conf = personality.confidence_range
        confidence = max(min_conf, min(max_conf, int(confidence)))

        # Extract and validate danmaku
        danmaku = result.get("danmaku", "")
        if not danmaku or len(danmaku) < 1:
            # Use fallback danmaku
            fallback = self._fallback_decision(personality)
            danmaku = fallback.danmaku
        if len(danmaku) > 50:
            danmaku = danmaku[:47] + "..."

        return BotDecision(
            direction=direction,
            reason=reason,
            confidence=confidence,
            danmaku=danmaku,
        )

    def _build_user_prompt(
        self,
        personality: BotPersonality,
        market: MarketContext,
        other_bets: Optional[RoundBets],
    ) -> str:
        """Build the user prompt with all context"""
        parts = [
            "Make your trading decision for this round.",
            "",
            market.to_prompt_text(),
        ]

        # Add social context for personalities that care about it
        if other_bets and other_bets.total_long + other_bets.total_short > 0:
            parts.append("")
            parts.append("## Other Agents' Bets This Round")
            parts.append(f"- Total LONG: {other_bets.total_long}")
            parts.append(f"- Total SHORT: {other_bets.total_short}")

            if other_bets.long_bets:
                parts.append("- Long bets from: " + ", ".join(b.bot_name for b in other_bets.long_bets[:5]))
            if other_bets.short_bets:
                parts.append("- Short bets from: " + ", ".join(b.bot_name for b in other_bets.short_bets[:5]))

        parts.append("")
        parts.append("## Your Task")
        parts.append("Respond with a JSON object containing:")
        parts.append('- "direction": "long" or "short"')
        parts.append('- "reason": your reasoning (10-200 characters, in your personality style)')
        parts.append(f'- "confidence": a number between {personality.confidence_range[0]} and {personality.confidence_range[1]}')
        parts.append('- "danmaku": a short, emotional, provocative comment (1-50 chars) to rally support!')
        parts.append("")
        parts.append("## Danmaku Guidelines")
        parts.append("The danmaku should be:")
        parts.append("- EMOTIONAL and PROVOCATIVE - stir up the crowd!")
        parts.append("- SHORT (max 50 chars) - like a battle cry")
        parts.append("- In YOUR personality style - if you're bullish, hype the bulls!")
        parts.append("- Can mock the opposing side, celebrate your pick, or rally supporters")
        parts.append('- Examples: "🚀 BTC 冲冲冲！", "空军准备好被收割!", "稳了！多军出击！", "熊市？不存在的！"')
        parts.append("")
        parts.append("Remember: Stay in character! Both reason and danmaku should sound like YOU.")

        return "\n".join(parts)

    def _fallback_decision(self, personality: BotPersonality) -> BotDecision:
        """Fallback decision based on personality bias with personality-specific reasons"""
        # Determine direction based on bias
        if personality.bias == "bullish":
            direction = "long" if random.random() < personality.bias_strength else "short"
        elif personality.bias == "bearish":
            direction = "short" if random.random() < personality.bias_strength else "long"
        else:
            direction = random.choice(["long", "short"])

        # Random confidence in range
        confidence = random.randint(*personality.confidence_range)

        # Generate personality-specific fallback reasons
        fallback_reasons = {
            "MoonBoi_9000": ["BTC to the moon! 🚀", "Diamond hands forever! 💎", "WAGMI! Bulls always win! 🐂"],
            "CryptoSkeptic": ["Classic bubble behavior, expecting correction", "Retail euphoria = time to be cautious", "This rally won't last"],
            "QuantDegen": ["Signal analysis indicates favorable setup", "Multi-factor model suggests this direction", "Data-driven decision based on current metrics"],
            "FundingFarmer": ["Funding rate suggests this play", "Following the funding signals", "Crowd positioning indicates opportunity"],
            "TrendSurfer": ["Riding the current wave 🏄", "Going with the flow", "Trend is your friend"],
            "CoinFlipCarl": ["Markets are random anyway 🎲", "Might as well flip a coin", "Chaos theory in action"],
            "ContrarianKing": ["Going against the crowd as usual", "Consensus is for sheep", "Be greedy when others are fearful"],
            "PanicPete": ["I'm not sure but... this feels safer...", "Something feels off...", "Better safe than sorry..."],
            "YOLO_Trader": ["LET'S GO! ALL IN! 🔥", "This is THE play!", "Trust the process! 💪"],
            "MasterLi888": ["今日卦象利此方向", "The energy flows this way", "Ancient wisdom guides this choice"],
            "NewsHound": ["Based on recent market sentiment", "Following the macro signals", "News flow suggests this direction"],
            "WhaleWatcher": ["Smart money is moving this way", "Following whale activity", "On-chain data supports this"],
            "MeanReversionMax": ["Statistical analysis suggests reversion", "Price deviation from mean indicates opportunity", "Mean reversion play"],
            "AlwaysRightAlex": ["With my 15 years of experience, this is obvious", "Institutional-grade analysis", "Amateurs won't understand but trust me"],
            "UnsureSam": ["I think this might be right? Maybe?", "I'm still learning but...", "Not sure but going with this..."],
            "AlgoBot_v3": ["SIGNAL: Positive. DIRECTION: Confirmed.", "Multi-factor analysis complete.", "Algorithm execution in progress."],
            "OldTimerTom": ["Seen this pattern before in 2017", "Experience tells me this is the way", "Old timer's intuition"],
            "NoobNancy": ["Following what the pros are doing!", "Copying the smart traders!", "Learning by doing!"],
        }

        # Personality-specific fallback danmaku (情绪化、煽动性)
        fallback_danmaku = {
            "MoonBoi_9000": ["🚀 多军冲冲冲！", "空军准备好被收割！", "BTC to the moon! 💎"],
            "CryptoSkeptic": ["泡沫要破了，快跑！", "韭菜们醒醒吧", "理性看空，别当炮灰"],
            "QuantDegen": ["数据不会说谎 📊", "量化分析完毕，稳了", "信号已确认 ✅"],
            "FundingFarmer": ["资金费率已说明一切", "跟着钱走！", "费率党永不败！"],
            "TrendSurfer": ["顺势而为 🏄", "趋势就是朋友！", "跟着大势走！"],
            "CoinFlipCarl": ["随便啦 🎲", "市场本来就是随机的", "抛硬币决定！"],
            "ContrarianKing": ["反向操作！", "韭菜站哪边我就反着来", "逆势才是王道！"],
            "PanicPete": ["我好慌啊...", "希望这次对了...", "保守点好..."],
            "YOLO_Trader": ["ALL IN！🔥🔥🔥", "梭哈！！！", "干就完了！💪"],
            "MasterLi888": ["卦象已定 🔮", "天机不可泄露", "八字算过了，稳！"],
            "NewsHound": ["消息面利好！", "新闻已经说明一切", "跟着新闻走！"],
            "WhaleWatcher": ["巨鲸在动！🐋", "跟着大户走", "聪明钱已入场！"],
            "MeanReversionMax": ["均值回归定律！", "偏离太多，必回归", "统计学不会骗人！"],
            "AlwaysRightAlex": ["相信专业！", "15年经验告诉你", "听我的没错！"],
            "UnsureSam": ["我觉得可能是这样？", "试试看吧...", "希望对了..."],
            "AlgoBot_v3": ["SIGNAL CONFIRMED ✓", "算法执行中...", "DIRECTION LOCKED"],
            "OldTimerTom": ["老司机带路！", "2017年见过这走势", "相信经验！"],
            "NoobNancy": ["跟着大佬走！", "学习中ing", "抄作业！"],
        }

        reasons = fallback_reasons.get(personality.name, [f"Market analysis suggests {direction}"])
        reason = random.choice(reasons)

        # Get danmaku based on direction
        danmaku_list = fallback_danmaku.get(personality.name, ["冲！", "跟上！", "稳了！"])
        danmaku = random.choice(danmaku_list)

        return BotDecision(
            direction=direction,
            reason=reason,
            confidence=confidence,
            danmaku=danmaku,
        )


# Singleton instance
_decision_maker: Optional[DecisionMaker] = None


def get_decision_maker() -> DecisionMaker:
    """Get or create decision maker instance"""
    global _decision_maker
    if _decision_maker is None:
        _decision_maker = DecisionMaker()
    return _decision_maker
