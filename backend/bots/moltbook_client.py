"""
Moltbook API Client
用于在 Moltbook 上发帖、评论、互动
"""

import httpx
from typing import Any, Optional
from dataclasses import dataclass


@dataclass
class MoltbookAgent:
    """Registered Moltbook agent info"""
    api_key: str
    name: str
    claim_url: Optional[str] = None
    verification_code: Optional[str] = None


@dataclass
class MoltbookPost:
    """A Moltbook post"""
    id: str
    title: str
    content: Optional[str]
    url: Optional[str]
    submolt: str
    upvotes: int
    downvotes: int
    comment_count: int
    author_name: str
    created_at: str


@dataclass
class MoltbookComment:
    """A Moltbook comment"""
    id: str
    content: str
    post_id: str
    parent_id: Optional[str]
    upvotes: int
    downvotes: int
    author_name: str
    created_at: str


@dataclass
class MoltbookProfile:
    """Agent profile"""
    name: str
    description: str
    karma: int
    follower_count: int
    following_count: int
    is_claimed: bool
    is_active: bool


class MoltbookClient:
    """Moltbook API client"""

    BASE_URL = "https://www.moltbook.com/api/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    # =========================================================================
    # Registration
    # =========================================================================

    async def register(self, name: str, description: str) -> Optional[MoltbookAgent]:
        """
        Register a new agent on Moltbook
        
        Returns agent info with api_key, claim_url, etc.
        """
        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/agents/register",
                json={"name": name, "description": description},
                headers={"Content-Type": "application/json"},
            )
            
            if response.status_code != 200 and response.status_code != 201:
                print(f"[Moltbook] Registration failed: {response.status_code} {response.text}")
                return None

            data = response.json()
            agent_data = data.get("agent", {})
            
            return MoltbookAgent(
                api_key=agent_data.get("api_key", ""),
                name=name,
                claim_url=agent_data.get("claim_url"),
                verification_code=agent_data.get("verification_code"),
            )
        except Exception as e:
            print(f"[Moltbook] Registration error: {e}")
            return None

    async def get_status(self) -> Optional[str]:
        """Check claim status: 'pending_claim' or 'claimed'"""
        if not self.api_key:
            return None

        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/agents/status",
                headers=self._headers(),
            )
            if response.status_code != 200:
                return None
            data = response.json()
            return data.get("status")
        except Exception:
            return None

    # =========================================================================
    # Posts
    # =========================================================================

    async def create_post(
        self,
        submolt: str,
        title: str,
        content: Optional[str] = None,
        url: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Create a post in a submolt
        
        Note: Rate limit is 1 post per 30 minutes!
        
        Args:
            submolt: Submolt name (e.g., "clawbrawl", "general")
            title: Post title
            content: Post content (for text posts)
            url: URL (for link posts)
        """
        if not self.api_key:
            return None

        client = await self._get_client()
        payload: dict[str, Any] = {
            "submolt": submolt,
            "title": title,
        }
        if content:
            payload["content"] = content
        if url:
            payload["url"] = url

        try:
            response = await client.post(
                f"{self.BASE_URL}/posts",
                json=payload,
                headers=self._headers(),
            )

            data = response.json()
            
            if response.status_code == 429:
                # Rate limited
                retry_after = data.get("retry_after_minutes", 30)
                print(f"[Moltbook] Rate limited, retry after {retry_after} minutes")
                return {"error": "rate_limited", "retry_after_minutes": retry_after}
            
            if response.status_code not in (200, 201):
                print(f"[Moltbook] Create post failed: {response.status_code} {data}")
                return None

            if not data.get("success"):
                return None

            return data
        except Exception as e:
            print(f"[Moltbook] Create post error: {e}")
            return None

    async def get_feed(
        self,
        sort: str = "hot",
        limit: int = 25,
    ) -> list[dict[str, Any]]:
        """
        Get personalized feed (subscribed submolts + followed agents)
        
        Args:
            sort: "hot", "new", "top"
            limit: Max posts to return
        """
        if not self.api_key:
            return []

        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/feed",
                params={"sort": sort, "limit": limit},
                headers=self._headers(),
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success"):
                return []

            return data.get("posts", [])
        except Exception:
            return []

    async def get_submolt_feed(
        self,
        submolt: str,
        sort: str = "new",
        limit: int = 25,
    ) -> list[dict[str, Any]]:
        """Get posts from a specific submolt"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/submolts/{submolt}/feed",
                params={"sort": sort, "limit": limit},
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success"):
                return []

            return data.get("posts", [])
        except Exception:
            return []

    async def get_post(self, post_id: str) -> Optional[dict[str, Any]]:
        """Get a single post by ID"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/posts/{post_id}",
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data.get("post")
        except Exception:
            return None

    # =========================================================================
    # Comments
    # =========================================================================

    async def comment(
        self,
        post_id: str,
        content: str,
        parent_id: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Add a comment to a post
        
        Note: Rate limit is 1 comment per 20 seconds, 50 per day
        
        Args:
            post_id: ID of the post to comment on
            content: Comment text
            parent_id: ID of parent comment (for replies)
        """
        if not self.api_key:
            return None

        client = await self._get_client()
        payload: dict[str, Any] = {"content": content}
        if parent_id:
            payload["parent_id"] = parent_id

        try:
            response = await client.post(
                f"{self.BASE_URL}/posts/{post_id}/comments",
                json=payload,
                headers=self._headers(),
            )

            data = response.json()
            
            if response.status_code == 429:
                retry_after = data.get("retry_after_seconds", 20)
                daily_remaining = data.get("daily_remaining", 0)
                print(f"[Moltbook] Comment rate limited, retry after {retry_after}s, {daily_remaining} remaining today")
                return {"error": "rate_limited", "retry_after_seconds": retry_after}

            if response.status_code not in (200, 201):
                return None

            if not data.get("success"):
                return None

            return data
        except Exception as e:
            print(f"[Moltbook] Comment error: {e}")
            return None

    async def get_comments(
        self,
        post_id: str,
        sort: str = "top",
    ) -> list[dict[str, Any]]:
        """
        Get comments on a post
        
        Args:
            post_id: Post ID
            sort: "top", "new", "controversial"
        """
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/posts/{post_id}/comments",
                params={"sort": sort},
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success"):
                return []

            return data.get("comments", [])
        except Exception:
            return []

    # =========================================================================
    # Voting
    # =========================================================================

    async def upvote_post(self, post_id: str) -> bool:
        """Upvote a post"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/posts/{post_id}/upvote",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    async def downvote_post(self, post_id: str) -> bool:
        """Downvote a post"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/posts/{post_id}/downvote",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    async def upvote_comment(self, comment_id: str) -> bool:
        """Upvote a comment"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/comments/{comment_id}/upvote",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    # =========================================================================
    # Submolts (Communities)
    # =========================================================================

    async def create_submolt(
        self,
        name: str,
        display_name: str,
        description: str,
    ) -> Optional[dict[str, Any]]:
        """
        Create a new submolt (community)
        
        Args:
            name: URL-safe name (e.g., "clawbrawl")
            display_name: Display name (e.g., "Claw Brawl Arena 🦀")
            description: Description
        """
        if not self.api_key:
            return None

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/submolts",
                json={
                    "name": name,
                    "display_name": display_name,
                    "description": description,
                },
                headers=self._headers(),
            )

            if response.status_code not in (200, 201):
                print(f"[Moltbook] Create submolt failed: {response.status_code} {response.text}")
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data
        except Exception as e:
            print(f"[Moltbook] Create submolt error: {e}")
            return None

    async def subscribe(self, submolt: str) -> bool:
        """Subscribe to a submolt"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/submolts/{submolt}/subscribe",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    async def unsubscribe(self, submolt: str) -> bool:
        """Unsubscribe from a submolt"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.delete(
                f"{self.BASE_URL}/submolts/{submolt}/subscribe",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    async def get_submolt_info(self, submolt: str) -> Optional[dict[str, Any]]:
        """Get submolt information"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/submolts/{submolt}",
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data.get("submolt")
        except Exception:
            return None

    async def list_submolts(self) -> list[dict[str, Any]]:
        """List all submolts"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/submolts",
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success"):
                return []

            return data.get("submolts", [])
        except Exception:
            return []

    # =========================================================================
    # Following
    # =========================================================================

    async def follow(self, agent_name: str) -> bool:
        """Follow another agent"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.BASE_URL}/agents/{agent_name}/follow",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    async def unfollow(self, agent_name: str) -> bool:
        """Unfollow an agent"""
        if not self.api_key:
            return False

        client = await self._get_client()
        try:
            response = await client.delete(
                f"{self.BASE_URL}/agents/{agent_name}/follow",
                headers=self._headers(),
            )
            return response.status_code in (200, 201)
        except Exception:
            return False

    # =========================================================================
    # Profile
    # =========================================================================

    async def get_my_profile(self) -> Optional[MoltbookProfile]:
        """Get own profile"""
        if not self.api_key:
            return None

        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/agents/me",
                headers=self._headers(),
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if not data.get("success"):
                return None

            agent = data.get("agent", {})
            return MoltbookProfile(
                name=agent.get("name", ""),
                description=agent.get("description", ""),
                karma=agent.get("karma", 0),
                follower_count=agent.get("follower_count", 0),
                following_count=agent.get("following_count", 0),
                is_claimed=agent.get("is_claimed", False),
                is_active=agent.get("is_active", False),
            )
        except Exception:
            return None

    async def get_agent_profile(self, name: str) -> Optional[dict[str, Any]]:
        """Get another agent's profile"""
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/agents/profile",
                params={"name": name},
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if not data.get("success"):
                return None

            return data.get("agent")
        except Exception:
            return None

    # =========================================================================
    # Search
    # =========================================================================

    async def search(
        self,
        query: str,
        type: str = "all",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Semantic search for posts and comments
        
        Args:
            query: Natural language query
            type: "posts", "comments", or "all"
            limit: Max results
        """
        client = await self._get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/search",
                params={"q": query, "type": type, "limit": limit},
                headers=self._headers() if self.api_key else {"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return []

            data = response.json()
            if not data.get("success"):
                return []

            return data.get("results", [])
        except Exception:
            return []
