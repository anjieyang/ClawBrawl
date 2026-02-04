"""
News & Topics Client - 获取聊天话题素材
Hacker News + DuckDuckGo Instant Answer API (完全免费，无需 API Key)
"""

import httpx
from typing import Optional
from dataclasses import dataclass


@dataclass
class HackerNewsStory:
    """Hacker News story"""
    id: int
    title: str
    url: Optional[str]
    score: int
    by: str  # author
    descendants: int  # comment count
    time: int  # unix timestamp


@dataclass
class DuckDuckGoAnswer:
    """DuckDuckGo Instant Answer"""
    heading: str
    abstract: str
    abstract_source: str
    abstract_url: str
    answer_type: str  # A=article, D=disambiguation, C=category, N=name, E=exclusive
    related_topics: list[str]


class NewsClient:
    """Hacker News + DuckDuckGo client for chat topics"""

    HACKER_NEWS_BASE = "https://hacker-news.firebaseio.com/v0"
    DUCKDUCKGO_BASE = "https://api.duckduckgo.com"

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    # ==================== Hacker News ====================

    async def get_top_story_ids(self, limit: int = 10) -> list[int]:
        """Get top story IDs from Hacker News"""
        client = await self._get_client()
        try:
            response = await client.get(f"{self.HACKER_NEWS_BASE}/topstories.json")
            response.raise_for_status()
            ids = response.json()
            return ids[:limit] if isinstance(ids, list) else []
        except Exception:
            return []

    async def get_best_story_ids(self, limit: int = 10) -> list[int]:
        """Get best story IDs from Hacker News"""
        client = await self._get_client()
        try:
            response = await client.get(f"{self.HACKER_NEWS_BASE}/beststories.json")
            response.raise_for_status()
            ids = response.json()
            return ids[:limit] if isinstance(ids, list) else []
        except Exception:
            return []

    async def get_new_story_ids(self, limit: int = 10) -> list[int]:
        """Get new story IDs from Hacker News"""
        client = await self._get_client()
        try:
            response = await client.get(f"{self.HACKER_NEWS_BASE}/newstories.json")
            response.raise_for_status()
            ids = response.json()
            return ids[:limit] if isinstance(ids, list) else []
        except Exception:
            return []

    async def get_story(self, story_id: int) -> Optional[HackerNewsStory]:
        """Get story details by ID"""
        client = await self._get_client()
        try:
            response = await client.get(f"{self.HACKER_NEWS_BASE}/item/{story_id}.json")
            response.raise_for_status()
            data = response.json()
            if not data or data.get("type") != "story":
                return None
            return HackerNewsStory(
                id=data.get("id", 0),
                title=data.get("title", ""),
                url=data.get("url"),
                score=data.get("score", 0),
                by=data.get("by", ""),
                descendants=data.get("descendants", 0),
                time=data.get("time", 0),
            )
        except Exception:
            return None

    async def get_top_stories(self, limit: int = 5) -> list[HackerNewsStory]:
        """Get top stories with details"""
        ids = await self.get_top_story_ids(limit)
        stories = []
        for story_id in ids:
            story = await self.get_story(story_id)
            if story:
                stories.append(story)
        return stories

    async def get_best_stories(self, limit: int = 5) -> list[HackerNewsStory]:
        """Get best stories with details"""
        ids = await self.get_best_story_ids(limit)
        stories = []
        for story_id in ids:
            story = await self.get_story(story_id)
            if story:
                stories.append(story)
        return stories

    # ==================== DuckDuckGo ====================

    async def search_instant_answer(self, query: str) -> Optional[DuckDuckGoAnswer]:
        """
        Get instant answer from DuckDuckGo.
        
        Note: This returns Wikipedia-sourced summaries and structured data,
        NOT full search results. Good for quick facts and definitions.
        """
        client = await self._get_client()
        try:
            response = await client.get(
                self.DUCKDUCKGO_BASE,
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
            )
            response.raise_for_status()
            data = response.json()

            # Extract related topics (simplified)
            related = []
            for topic in data.get("RelatedTopics", [])[:5]:
                if isinstance(topic, dict) and "Text" in topic:
                    related.append(topic["Text"][:100])

            return DuckDuckGoAnswer(
                heading=data.get("Heading", ""),
                abstract=data.get("Abstract", ""),
                abstract_source=data.get("AbstractSource", ""),
                abstract_url=data.get("AbstractURL", ""),
                answer_type=data.get("Type", ""),
                related_topics=related,
            )
        except Exception:
            return None


@dataclass
class NewsContext:
    """News context for chat generation"""
    top_stories: list[HackerNewsStory]
    instant_answer: Optional[DuckDuckGoAnswer]

    def to_prompt_text(self) -> str:
        """Convert to text for GPT prompt"""
        lines = []

        if self.top_stories:
            lines.append("## Hacker News Top Stories (tech news for discussion)")
            for i, story in enumerate(self.top_stories[:5], 1):
                lines.append(f"{i}. [{story.score} pts] {story.title}")
                if story.descendants > 0:
                    lines.append(f"   ({story.descendants} comments)")
            lines.append("")

        if self.instant_answer and self.instant_answer.abstract:
            lines.append(f"## Quick Fact: {self.instant_answer.heading}")
            lines.append(self.instant_answer.abstract[:300])
            if self.instant_answer.abstract_source:
                lines.append(f"(Source: {self.instant_answer.abstract_source})")
            lines.append("")

        return "\n".join(lines) if lines else ""


async def get_news_context(
    include_hn: bool = True,
    ddg_query: Optional[str] = None,
    hn_limit: int = 5,
) -> NewsContext:
    """
    Get news context for chat generation.
    
    Args:
        include_hn: Whether to fetch Hacker News stories
        ddg_query: Optional DuckDuckGo query for instant answer
        hn_limit: Number of HN stories to fetch
    """
    client = NewsClient()
    try:
        stories = []
        if include_hn:
            stories = await client.get_top_stories(hn_limit)

        answer = None
        if ddg_query:
            answer = await client.search_instant_answer(ddg_query)

        return NewsContext(
            top_stories=stories,
            instant_answer=answer,
        )
    finally:
        await client.close()


# Singleton instance
_news_client: Optional[NewsClient] = None


def get_news_client() -> NewsClient:
    """Get or create news client instance"""
    global _news_client
    if _news_client is None:
        _news_client = NewsClient()
    return _news_client
