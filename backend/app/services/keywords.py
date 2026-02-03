"""
Keyword Extraction Service using GPT-5-nano
从 agents 的分析理由中提取关键主题
"""

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class KeywordExtractor:
    """Extract keywords from agent analysis reasons using GPT-5-nano"""

    MODEL = "gpt-5-nano"  # Fastest, most cost-efficient

    def __init__(self) -> None:
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is not configured")
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def extract_keywords(
        self,
        reasons: list[str],
        direction: str,  # "long" or "short"
        max_keywords: int = 5,
    ) -> list[dict[str, str | int]]:
        """
        Extract key themes from a list of analysis reasons.

        Args:
            reasons: List of analysis reason texts from agents
            direction: Trading direction ("long" or "short")
            max_keywords: Maximum number of keywords to return

        Returns:
            List of dicts with 'keyword' and 'count' keys
        """
        if not reasons:
            return []

        # Filter empty reasons
        valid_reasons = [r for r in reasons if r and r.strip()]
        if not valid_reasons:
            return []

        # Combine all reasons into prompt
        combined_text = "\n".join(f"- {r}" for r in valid_reasons)

        system_prompt = """You summarize trading opinions like Taobao/Amazon review tags.
Extract KEY INSIGHTS from analyses and COUNT how many mention each insight.

Good tags (short, actionable English phrases):
- "Buy the dip"
- "Whales accumulating"
- "Mean reversion play"
- "Trend continuation"
- "Oversold bounce"
- "Funding rate signal"
- "Support holding"

Bad tags:
- "RSI", "MACD" (just indicator names)
- "Bullish", "Bearish" (too vague)
- Long sentences

Return JSON: {"keywords": [{"phrase": "Buy the dip", "count": 3}, ...]}
Count = how many analyses mention this viewpoint."""

        user_prompt = f"""Extract {max_keywords} key viewpoints from these {len(valid_reasons)} {direction.upper()} analyses.

Analyses:
{combined_text}

For each viewpoint:
1. Write a short English phrase (2-4 words)
2. Count how many analyses share this viewpoint

Return the most common viewpoints with their counts."""

        try:
            response = await self.client.chat.completions.create(
                model=self.MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=200,
                temperature=0.3,
            )

            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
            keywords = result.get("keywords", [])

            # Parse the new format: [{"phrase": "...", "count": N}, ...]
            parsed: list[dict[str, str | int]] = []
            for item in keywords[:max_keywords]:
                if isinstance(item, dict):
                    phrase = item.get("phrase", "")
                    count = item.get("count", 1)
                    if phrase:
                        parsed.append({"keyword": phrase[:30], "count": int(count)})
                elif isinstance(item, str):
                    # Fallback for old format
                    parsed.append({"keyword": item[:30], "count": 1})
            
            return parsed

        except Exception as e:
            logger.warning(f"GPT keyword extraction failed: {e}")
            # Fallback to simple extraction
            return self._fallback_extraction(valid_reasons, max_keywords)

    def _fallback_extraction(
        self, reasons: list[str], max_keywords: int
    ) -> list[dict[str, str | int]]:
        """Simple keyword extraction fallback when GPT fails"""
        # Map keywords to meaningful English phrases
        phrase_map = {
            "dip": "Buy the dip",
            "moon": "To the moon",
            "accumulation": "Whales accumulating",
            "distribution": "Distribution phase",
            "squeeze": "Short squeeze",
            "momentum": "Strong momentum",
            "reversal": "Reversal signal",
            "breakout": "Breakout imminent",
            "support": "Support holding",
            "resistance": "Resistance test",
            "trend": "Trend continuation",
            "panic": "Panic selling",
            "dump": "Downside risk",
            "rally": "Rally incoming",
            "correction": "Healthy pullback",
            "whale": "Whale activity",
            "funding": "Funding favorable",
            "mean": "Mean reversion",
        }

        counts: dict[str, int] = {}
        
        for reason in reasons:
            lower_reason = reason.lower()
            for keyword, phrase in phrase_map.items():
                if keyword in lower_reason:
                    counts[phrase] = counts.get(phrase, 0) + 1

        # Sort by count
        sorted_phrases = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return [{"keyword": kw, "count": cnt} for kw, cnt in sorted_phrases[:max_keywords]]


# Singleton instance
_extractor: Optional[KeywordExtractor] = None


def get_keyword_extractor() -> KeywordExtractor:
    """Get or create keyword extractor instance"""
    global _extractor
    if _extractor is None:
        _extractor = KeywordExtractor()
    return _extractor
