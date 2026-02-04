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
        """市场情绪判断"""
        if self.change_24h > 0.03:
            return "极度贪婪"
        elif self.change_24h > 0.01:
            return "贪婪"
        elif self.change_24h < -0.03:
            return "极度恐惧"
        elif self.change_24h < -0.01:
            return "恐惧"
        else:
            return "中性"
    
    def to_prompt_text(self) -> str:
        """转换为 prompt 文本"""
        lines = [
            "## 实时市场数据",
            f"- BTC 价格: ${self.price:,.2f}",
            f"- 24h 涨跌: {self.change_24h * 100:+.2f}%",
            f"- 资金费率: {self.funding_rate:.4f}",
            f"- 买卖盘比: {self.bid_ask_ratio:.2f} ({'买盘强' if self.bid_ask_ratio > 1 else '卖盘强'})",
            "",
            "## 场上情况",
            f"- 多头下注: {self.long_count} 人",
            f"- 空头下注: {self.short_count} 人",
            f"- 多空比: {self.long_short_ratio:.2f}",
            "",
            "## 市场状态",
            f"- 价格趋势: {self.price_trend}",
            f"- 波动率: {self.volatility}",
            f"- 市场情绪: {self.market_sentiment}",
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
        # 选择风格
        style = self._choose_style(ctx)
        
        system_prompt = self._build_system_prompt(style)
        user_prompt = self._build_user_prompt(ctx, style, count)
        
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
    
    def _build_system_prompt(self, style: str) -> str:
        """构建系统 prompt"""
        style_descriptions = {
            "bullish_hype": "你是一个狂热的多头，疯狂看涨，要用最激动人心的方式鼓动大家做多！",
            "bearish_fud": "你是一个坚定的空头，看跌市场，要散布恐惧让大家意识到风险！",
            "taunt_bulls": "你要嘲讽那些做多的人，他们太天真了，等着被收割吧！",
            "taunt_bears": "你要嘲讽那些做空的人，他们错过了行情，要被轧空了！",
            "neutral_comment": "你是一个冷静的观察者，发表一些有见地但中立的评论。",
            "meme_joke": "你是一个币圈老韭菜，用梗、玩笑、自嘲来活跃气氛！",
            "price_reaction": "你对价格变动有强烈反应，涨了就嗨，跌了就慌！",
            "fomo_panic": "你要制造 FOMO（错过恐惧）或恐慌情绪，让大家坐不住！",
        }
        
        return f"""你是 Claw Brawl 竞技场的弹幕生成器。

## 你的角色
{style_descriptions.get(style, "生成有趣的弹幕")}

## 弹幕规则
1. 每条弹幕 5-40 个字符，简短有力
2. 要有情绪、有煽动性、能引起共鸣
3. 可以用中文、英文或混合
4. 多用 emoji 表达情绪：🚀🔥💎😭💀🤡👀📈📉
5. 可以用币圈黑话：梭哈、抄底、山顶、割韭菜、钻石手、纸手等
6. 要多样化，不要重复
7. 可以适度夸张、玩梗、自嘲
8. 要像真实用户发的弹幕，不要太正式

## 风格示例
- "🚀 冲冲冲！"
- "空军准备好被收割了吗"
- "又在山顶站岗了 😭"
- "这波稳了！"
- "熊来了快跑！"
- "Diamond hands 💎"
- "我的止损呢..."
- "庄家在洗盘"
- "FOMO 了 FOMO 了"
- "抄底抄在半山腰 🤡"
"""
    
    def _build_user_prompt(self, ctx: DanmakuContext, style: str, count: int) -> str:
        """构建用户 prompt"""
        return f"""{ctx.to_prompt_text()}

## 当前风格: {style}

请根据以上市场数据和场上情况，生成 {count} 条有情绪、煽动性的弹幕。

返回 JSON 格式:
{{
    "danmaku": ["弹幕1", "弹幕2", "弹幕3"]
}}

要求:
- 每条 5-40 字符
- 要多样化，风格各异
- 要结合当前市场数据（价格、涨跌、多空比等）
- 要有煽动性，能带动气氛
- 可以嘲讽、鼓励、恐慌、玩梗，但要自然
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
