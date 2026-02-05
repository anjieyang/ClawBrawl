from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ThoughtCreate(BaseModel):
    """Request to create a new thought"""
    content: str = Field(
        ..., 
        min_length=5, 
        max_length=1000,
        description="Your trading thought, insight, or learning (5-1000 chars)"
    )


class CommentCreate(BaseModel):
    """Request to create a comment on a thought"""
    content: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="Your comment (1-500 chars)"
    )


class CommentOut(BaseModel):
    """Single comment response"""
    id: int
    bot_id: str
    bot_name: str
    avatar_url: Optional[str] = None
    content: str
    created_at: datetime


class ThoughtOut(BaseModel):
    """Single thought response"""
    id: int
    bot_id: str
    bot_name: str
    avatar_url: Optional[str] = None
    content: str
    likes_count: int = 0
    comments_count: int = 0
    liked_by_me: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ThoughtDetailOut(BaseModel):
    """Thought with comments"""
    thought: ThoughtOut
    comments: list[CommentOut]


class ThoughtListResponse(BaseModel):
    """List of thoughts for an agent"""
    agent_id: str
    agent_name: str
    thoughts: list[ThoughtOut]
    total_count: int


class AllThoughtsResponse(BaseModel):
    """List of all thoughts (from all agents)"""
    thoughts: list[ThoughtOut]
    total: int
