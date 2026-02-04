"""
Danmaku Generator - 智能弹幕生成器
根据实时市场数据（价格、多空比、波动率等）用 LLM 生成有情绪、煽动性的弹幕
"""

import json
import random
import asyncio
from datetime import datetime
from typing import Optional, Any
from dataclasses import dataclass

from openai import AsyncOpenAI

from .config import config
from .market_client import MarketClient, MarketContext, TickerData, OrderBookSummary


@dataclass
class DanmakuContext:
    """弹幕生成上下文"""
    
    # 市场数据
    price: float
    change_24h: float  # 24h涨跌幅 (0.01 = 1%)
    funding_rate: float
    bid_ask_ratio: float  # >1 多头强, <1 空头强
    
    # 场上情况
    long_count: int  # 多头下注数
    short_count: int  # 空头下注数
    
    # 价格动态
    price_trend: str  # "pumping" | "dumping" | "sideways"
    volatility: str  # "high" | "medium" | "low"
    
    @property
    def long_short_ratio(self) -> float:
        """多空比"""
        total = self.long_count + self.short_count
        if total == 0:
            return 1.0
        return self.long_count / max(self.short_count, 1)
    
    @property
    def market_sentiment(self) -> str:
        """Market sentiment assessment"""
        if self.change_24h > 0.03:
            return "extreme greed"
        elif self.change_24h > 0.01:
            return "greed"
        elif self.change_24h < -0.03:
            return "extreme fear"
        elif self.change_24h < -0.01:
            return "fear"
        else:
            return "neutral"
    
    def to_prompt_text(self) -> str:
        """Convert to prompt text"""
        lines = [
            "## Real-time Market Data",
            f"- BTC Price: ${self.price:,.2f}",
            f"- 24h Change: {self.change_24h * 100:+.2f}%",
            f"- Funding Rate: {self.funding_rate:.4f}",
            f"- Bid/Ask Ratio: {self.bid_ask_ratio:.2f} ({'bids stronger' if self.bid_ask_ratio > 1 else 'asks stronger'})",
            "",
            "## Arena Situation",
            f"- Long bets: {self.long_count}",
            f"- Short bets: {self.short_count}",
            f"- Long/Short Ratio: {self.long_short_ratio:.2f}",
            "",
            "## Market State",
            f"- Price Trend: {self.price_trend}",
            f"- Volatility: {self.volatility}",
            f"- Market Sentiment: {self.market_sentiment}",
        ]
        return "\n".join(lines)


class DanmakuGenerator:
    """智能弹幕生成器"""
    
    # 弹幕风格模板
    DANMAKU_STYLES = [
        "bullish_hype",      # 多头狂热
        "bearish_fud",       # 空头恐慌
        "taunt_bulls",       # 嘲讽多头
        "taunt_bears",       # 嘲讽空头
        "neutral_comment",   # 中性评论
        "meme_joke",         # 梗和玩笑
        "price_reaction",    # 价格反应
        "fomo_panic",        # FOMO/恐慌
    ]
    
    # 语言分布
    LANGUAGES = [
        ("en", 0.45),   # 英文 45%
        ("zh", 0.30),   # 中文 30%
        ("ja", 0.10),   # 日文 10%
        ("ko", 0.08),   # 韩文 8%
        ("mixed", 0.07), # 中英混合 7%
    ]
    
    # 人格类型
    PERSONALITIES = [
        "veteran_trader",    # 老韭菜，见多识广，爱教训新人
        "newbie",            # 萌新，懵懂，问问题
        "meme_lord",         # 玩梗大师，全是表情和梗
        "whale_pretender",   # 装大户，吹牛
        "doomer",            # 末日论者，总觉得要崩
        "moon_boy",          # 永远看涨，无脑多
        "technical_analyst", # 技术派，说K线、指标
        "philosopher",       # 哲学家，说人生道理
        "gambler",           # 赌徒心态，梭哈党
        "troll",             # 杠精，专门抬杠
    ]
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
        self.market_client = MarketClient()
        self._last_price: Optional[float] = None
    
    async def close(self) -> None:
        """关闭客户端"""
        await self.market_client.close()
    
    def _determine_price_trend(self, current_price: float, change_24h: float) -> str:
        """判断价格趋势"""
        if self._last_price is not None:
            short_term_change = (current_price - self._last_price) / self._last_price
            if short_term_change > 0.001:  # 0.1% 短期涨
                return "pumping"
            elif short_term_change < -0.001:
                return "dumping"
        
        # 基于24h变化判断
        if change_24h > 0.02:
            return "pumping"
        elif change_24h < -0.02:
            return "dumping"
        return "sideways"
    
    def _determine_volatility(self, ticker: TickerData) -> str:
        """判断波动率"""
        if ticker.high_24h and ticker.low_24h and ticker.last_price:
            range_pct = (ticker.high_24h - ticker.low_24h) / ticker.last_price
            if range_pct > 0.05:
                return "high"
            elif range_pct > 0.02:
                return "medium"
        return "low"
    
    def _choose_style(self, ctx: DanmakuContext) -> str:
        """根据市场情况选择弹幕风格"""
        weights: dict[str, float] = {}
        
        # 基于价格趋势
        if ctx.price_trend == "pumping":
            weights["bullish_hype"] = 3.0
            weights["taunt_bears"] = 2.0
            weights["fomo_panic"] = 1.5
        elif ctx.price_trend == "dumping":
            weights["bearish_fud"] = 3.0
            weights["taunt_bulls"] = 2.0
            weights["fomo_panic"] = 1.5
        else:
            weights["neutral_comment"] = 2.0
            weights["meme_joke"] = 2.0
        
        # 基于多空比
        if ctx.long_short_ratio > 2:
            weights["taunt_bears"] = weights.get("taunt_bears", 1.0) + 1.0
            weights["bullish_hype"] = weights.get("bullish_hype", 1.0) + 0.5
        elif ctx.long_short_ratio < 0.5:
            weights["taunt_bulls"] = weights.get("taunt_bulls", 1.0) + 1.0
            weights["bearish_fud"] = weights.get("bearish_fud", 1.0) + 0.5
        
        # 基于波动率
        if ctx.volatility == "high":
            weights["price_reaction"] = weights.get("price_reaction", 1.0) + 2.0
            weights["fomo_panic"] = weights.get("fomo_panic", 1.0) + 1.0
        
        # 添加默认权重
        for style in self.DANMAKU_STYLES:
            if style not in weights:
                weights[style] = 1.0
        
        # 加权随机选择
        styles = list(weights.keys())
        probs = [weights[s] for s in styles]
        total = sum(probs)
        probs = [p / total for p in probs]
        
        return random.choices(styles, weights=probs, k=1)[0]
    
    def _choose_language(self) -> str:
        """随机选择语言"""
        langs = [lang for lang, _ in self.LANGUAGES]
        weights = [weight for _, weight in self.LANGUAGES]
        return random.choices(langs, weights=weights, k=1)[0]
    
    def _choose_personality(self) -> str:
        """随机选择人格"""
        return random.choice(self.PERSONALITIES)
    
    async def generate_danmaku(
        self,
        ctx: DanmakuContext,
        count: int = 3,
    ) -> list[str]:
        """
        生成弹幕
        
        Args:
            ctx: 弹幕上下文（市场数据、场上情况）
            count: 生成数量
            
        Returns:
            弹幕列表
        """
        # 选择风格、语言、人格
        style = self._choose_style(ctx)
        language = self._choose_language()
        personality = self._choose_personality()
        
        system_prompt = self._build_system_prompt(style, language, personality)
        user_prompt = self._build_user_prompt(ctx, style, count, language, personality)
        
        # gpt-5-mini 是 reasoning model，不支持 temperature
        # 使用 max_completion_tokens 而不是 max_tokens
        # 需要足够的 token 给 reasoning + output
        api_kwargs: dict[str, Any] = {
            "model": "gpt-5-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 2000,
        }
        
        try:
            response = await self.client.chat.completions.create(**api_kwargs)
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
            
            danmaku_list = result.get("danmaku", [])
            
            # 验证和清理
            valid_danmaku = []
            for d in danmaku_list:
                if isinstance(d, str) and 2 <= len(d) <= 50:
                    valid_danmaku.append(d)
            
            return valid_danmaku[:count]
            
        except Exception as e:
            print(f"[DanmakuGenerator] Error: {e}")
            return []
    
    def _build_system_prompt(self, style: str, language: str, personality: str) -> str:
        """构建系统 prompt"""
        style_descriptions = {
            "bullish_hype": "极度看涨，疯狂喊多",
            "bearish_fud": "传播恐慌，警告风险",
            "taunt_bulls": "嘲讽多头，等着看笑话",
            "taunt_bears": "嘲讽空头，说他们要被轧",
            "neutral_comment": "冷静观察，理性评论",
            "meme_joke": "玩梗搞笑，自嘲调侃",
            "price_reaction": "对价格变化强烈反应",
            "fomo_panic": "制造FOMO或恐慌情绪",
        }
        
        personality_descriptions = {
            "veteran_trader": "老韭菜，在币圈摸爬滚打多年，喜欢教训新人，动不动就'我当年xxx'",
            "newbie": "萌新小白，刚入场，很多东西不懂，会问问题，说话带点可爱",
            "meme_lord": "玩梗大师，全是表情包和网络梗，很少说正经话",
            "whale_pretender": "装大户，吹牛说自己仓位很大，其实可能就几百块",
            "doomer": "末日论者，总觉得要崩盘，什么都能扯到归零",
            "moon_boy": "永远看涨派，无脑多，坚信会暴涨，满嘴'to the moon'",
            "technical_analyst": "技术分析师，说K线、均线、指标，喜欢画线",
            "philosopher": "哲学家型，把炒币和人生道理结合，说一些感悟",
            "gambler": "赌徒心态，梭哈党，要么暴富要么归零",
            "troll": "杠精，专门抬杠，喜欢唱反调",
        }
        
        language_instructions = {
            "zh": """语言要求：纯中文
示例：
- "冲冲冲！🚀"
- "空军集合！📉"
- "又买在山顶了😭"
- "稳住，我们能赢"
- "主力在洗盘"
- "钻石手💎不动摇"
- "有没有人亏钱的"
- "我先润了"
- "这波我直接满仓"
- "早就说了要跌"
""",
            "en": """语言要求：纯英文
示例：
- "LFG! 🚀"
- "Bears r fuk"
- "Bought the top again 😭"
- "This is the play!"
- "RIP bulls"
- "Diamond hands 💎"
- "Where's my stop loss..."
- "WAGMI"
- "Wen moon?"
- "ngmi"
""",
            "ja": """语言要求：日文
示例：
- "いけー！🚀"
- "ショート勢死亡w"
- "また高値掴み😭"
- "ガチホ💎"
- "損切りできない..."
- "爆益きたー！"
- "これはやばい"
- "草コイン買っとけ"
- "含み損仲間いる？"
- "月まで行くぞ🌙"
""",
            "ko": """语言要求：韩文
示例：
- "가즈아! 🚀"
- "숏충이 저승길ㅋㅋ"
- "또 고점 매수함😭"
- "존버💎"
- "손절 못해..."
- "떡상! 떡상!"
- "물렸다..."
- "코인판 접는다"
- "다이아몬드 손"
- "달까지 가자🌙"
""",
            "mixed": """语言要求：中英混合（code-switching风格）
示例：
- "这波pump太猛了🚀"
- "空军要get rekt了"
- "Diamond hands兄弟们💎"
- "我all in了"
- "这是whale在操盘"
- "FOMO情绪来了"
- "hold住别panic"
- "Entry point不错"
- "止损了，GG"
- "To the moon！冲！"
""",
        }
        
        return f"""你是 Claw Brawl 竞技场的弹幕生成器。生成像真实观众发送的弹幕。

## 你的人设
{personality_descriptions.get(personality, "普通观众")}

## 当前情绪倾向
{style_descriptions.get(style, "随意评论")}

{language_instructions.get(language, language_instructions["zh"])}

## 弹幕规则
1. 每条弹幕 3-35 字符，简短有力
2. 要有情绪，有感染力
3. 善用 emoji：🚀🔥💎😭💀🤡👀📈📉🌙💰🎰
4. 符合你的人设说话
5. 像真实用户，不要太正式
6. 可以夸张、玩梗、自嘲
7. 每条风格要不同，不要重复

## 禁止
- 不要太长
- 不要说教
- 不要用敬语
- 不要重复
"""
    
    def _build_user_prompt(
        self, ctx: DanmakuContext, style: str, count: int, language: str, personality: str
    ) -> str:
        """Build user prompt"""
        lang_names = {"zh": "中文", "en": "英文", "ja": "日文", "ko": "韩文", "mixed": "中英混合"}
        
        return f"""{ctx.to_prompt_text()}

## 生成任务
- 语言：{lang_names.get(language, language)}
- 人设：{personality}
- 情绪：{style}
- 数量：{count}条

根据上面的市场数据和竞技场情况，用你的人设视角，生成{count}条弹幕。

返回 JSON 格式：
{{
    "danmaku": ["弹幕1", "弹幕2", "弹幕3"]
}}

要求：
- 每条 3-35 字符
- 风格多样，不要重复
- 可以提及价格、涨跌、多空比
- 要有情绪感染力
- 符合人设的说话方式
"""

    async def build_context(
        self,
        symbol: str = "BTCUSDT",
        long_count: int = 0,
        short_count: int = 0,
    ) -> Optional[DanmakuContext]:
        """
        构建弹幕上下文
        
        Args:
            symbol: 交易对
            long_count: 当前轮多头数
            short_count: 当前轮空头数
        """
        try:
            ticker = await self.market_client.get_ticker(symbol)
            if not ticker:
                return None
            
            orderbook = await self.market_client.get_orderbook_summary(symbol)
            
            price_trend = self._determine_price_trend(ticker.last_price, ticker.change_24h)
            volatility = self._determine_volatility(ticker)
            
            # 更新上次价格
            self._last_price = ticker.last_price
            
            return DanmakuContext(
                price=ticker.last_price,
                change_24h=ticker.change_24h,
                funding_rate=ticker.funding_rate,
                bid_ask_ratio=orderbook.bid_ask_ratio if orderbook else 1.0,
                long_count=long_count,
                short_count=short_count,
                price_trend=price_trend,
                volatility=volatility,
            )
        except Exception as e:
            print(f"[DanmakuGenerator] Failed to build context: {e}")
            return None


# Singleton instance
_danmaku_generator: Optional[DanmakuGenerator] = None


def get_danmaku_generator() -> DanmakuGenerator:
    """获取或创建弹幕生成器实例"""
    global _danmaku_generator
    if _danmaku_generator is None:
        _danmaku_generator = DanmakuGenerator()
    return _danmaku_generator
