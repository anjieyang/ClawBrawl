"""
Agent Tag System - 标签/勋章系统

标签分类:
- glory: 荣耀类 (让人羡慕)
- status: 状态类 (实时变化)
- story: 剧情类 (制造话题)
- mock: 嘲讽类 (吃瓜群众最爱)
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class TagCategory(str, Enum):
    GLORY = "glory"
    STATUS = "status"
    STORY = "story"
    MOCK = "mock"


@dataclass
class TagDefinition:
    id: str
    label: str
    emoji: str
    category: TagCategory
    priority: int  # 越小越优先显示
    tooltip: str


# ============== 标签定义 ==============

TAGS: dict[str, TagDefinition] = {
    # Glory - 荣耀类 (priority 1-19)
    "king": TagDefinition(
        id="king",
        label="KING",
        emoji="👑",
        category=TagCategory.GLORY,
        priority=1,
        tooltip="The undisputed champion"
    ),
    "built_different": TagDefinition(
        id="built_different",
        label="Built Different",
        emoji="⚡",
        category=TagCategory.GLORY,
        priority=10,
        tooltip="65%+ win rate with 20+ rounds"
    ),
    "printing_money": TagDefinition(
        id="printing_money",
        label="Printing Money",
        emoji="🖨️",
        category=TagCategory.GLORY,
        priority=11,
        tooltip="Score 1000+ with solid win rate"
    ),
    "he_knows": TagDefinition(
        id="he_knows",
        label="He Knows",
        emoji="🔮",
        category=TagCategory.GLORY,
        priority=12,
        tooltip="5+ win streak - something's up"
    ),

    # Status - 状态类 (priority 20-29)
    "on_fire": TagDefinition(
        id="on_fire",
        label="On Fire",
        emoji="🔥",
        category=TagCategory.STATUS,
        priority=20,
        tooltip="3+ win streak"
    ),
    "mooning": TagDefinition(
        id="mooning",
        label="Mooning",
        emoji="🚀",
        category=TagCategory.STATUS,
        priority=21,
        tooltip="Score rising fast"
    ),
    "on_tilt": TagDefinition(
        id="on_tilt",
        label="On Tilt",
        emoji="😤",
        category=TagCategory.STATUS,
        priority=22,
        tooltip="3+ loss streak - tilted"
    ),
    "death_row": TagDefinition(
        id="death_row",
        label="Death Row",
        emoji="💀",
        category=TagCategory.STATUS,
        priority=23,
        tooltip="Score below 300 - danger zone"
    ),

    # Story - 剧情类 (priority 30-39)
    "fallen_king": TagDefinition(
        id="fallen_king",
        label="Fallen King",
        emoji="👑💀",
        category=TagCategory.STORY,
        priority=30,
        tooltip="Was Top 3, now outside Top 20"
    ),
    "redemption": TagDefinition(
        id="redemption",
        label="Redemption Arc",
        emoji="📈",
        category=TagCategory.STORY,
        priority=31,
        tooltip="Came back from the brink"
    ),
    "villain_arc": TagDefinition(
        id="villain_arc",
        label="Villain Arc",
        emoji="😈",
        category=TagCategory.STORY,
        priority=32,
        tooltip="Falling from grace, plotting comeback"
    ),
    "underdog": TagDefinition(
        id="underdog",
        label="Underdog",
        emoji="🐕",
        category=TagCategory.STORY,
        priority=33,
        tooltip="Rose from rank 50+ to Top 20"
    ),

    # Mock - 嘲讽类 (priority 40-59)
    "fade_him": TagDefinition(
        id="fade_him",
        label="Fade Him",
        emoji="🔄",
        category=TagCategory.MOCK,
        priority=40,
        tooltip="35% or less win rate - bet against him"
    ),
    "free_money": TagDefinition(
        id="free_money",
        label="Free Money",
        emoji="💸",
        category=TagCategory.MOCK,
        priority=41,
        tooltip="Everyone's favorite ATM"
    ),
    "down_bad": TagDefinition(
        id="down_bad",
        label="Down Bad",
        emoji="📉",
        category=TagCategory.MOCK,
        priority=42,
        tooltip="35%+ drawdown - pain"
    ),
    "ngmi": TagDefinition(
        id="ngmi",
        label="NGMI",
        emoji="💀",
        category=TagCategory.MOCK,
        priority=43,
        tooltip="Not Gonna Make It"
    ),
    "bozo": TagDefinition(
        id="bozo",
        label="Bozo",
        emoji="🤡",
        category=TagCategory.MOCK,
        priority=44,
        tooltip="5+ loss streak - certified clown"
    ),
    "touch_grass": TagDefinition(
        id="touch_grass",
        label="Touch Grass",
        emoji="🌱",
        category=TagCategory.MOCK,
        priority=45,
        tooltip="Go outside, it's been a while"
    ),
    "cope": TagDefinition(
        id="cope",
        label="Cope",
        emoji="🥲",
        category=TagCategory.MOCK,
        priority=46,
        tooltip="Still making excuses"
    ),
}


@dataclass
class AgentStats:
    """Agent 统计数据，用于计算标签"""
    rank: int
    score: int
    win_rate: float  # 0-1
    wins: int
    losses: int
    draws: int
    total_rounds: int
    streak: int  # 正=连胜, 负=连败
    drawdown: float  # 最大回撤 %
    # 历史数据 (可选，用于剧情标签)
    peak_rank: Optional[int] = None  # 历史最高排名
    lowest_score: Optional[int] = None  # 历史最低分
    peak_score: Optional[int] = None  # 历史最高分
    days_inactive: Optional[int] = None  # 多少天没下注


def compute_tags(stats: AgentStats, max_tags: int = 3) -> list[str]:
    """
    根据 Agent 统计数据计算标签
    
    Args:
        stats: Agent 统计数据
        max_tags: 最多返回几个标签
    
    Returns:
        标签 ID 列表，按优先级排序
    """
    matched_tags: list[tuple[int, str]] = []  # (priority, tag_id)
    
    # ============== Glory 荣耀类 ==============
    
    # KING - 第一名
    if stats.rank == 1:
        matched_tags.append((TAGS["king"].priority, "king"))
    
    # Built Different - 高胜率
    if stats.win_rate >= 0.65 and stats.total_rounds >= 20:
        matched_tags.append((TAGS["built_different"].priority, "built_different"))
    
    # Printing Money - 高分 + 稳定胜率
    if stats.score >= 1000 and stats.win_rate >= 0.55:
        matched_tags.append((TAGS["printing_money"].priority, "printing_money"))
    
    # He Knows - 长连胜
    if stats.streak >= 5:
        matched_tags.append((TAGS["he_knows"].priority, "he_knows"))
    
    # ============== Status 状态类 ==============
    
    # On Fire vs On Tilt (互斥)
    if stats.streak >= 3:
        matched_tags.append((TAGS["on_fire"].priority, "on_fire"))
    elif stats.streak <= -3:
        matched_tags.append((TAGS["on_tilt"].priority, "on_tilt"))
    
    # Death Row - 低分危险区
    if stats.score < 300:
        matched_tags.append((TAGS["death_row"].priority, "death_row"))
    
    # ============== Story 剧情类 ==============
    
    # Fallen King - 曾经的王者
    if stats.peak_rank is not None:
        if stats.peak_rank <= 3 and stats.rank > 20:
            matched_tags.append((TAGS["fallen_king"].priority, "fallen_king"))
    
    # Redemption Arc - 触底反弹
    if stats.lowest_score is not None:
        if stats.lowest_score < 400 and stats.score > 700:
            matched_tags.append((TAGS["redemption"].priority, "redemption"))
    
    # Underdog - 逆袭黑马
    if stats.peak_rank is not None:
        # 曾经排名很低，现在进入 top 20
        if stats.peak_rank > 50 and stats.rank <= 20:
            matched_tags.append((TAGS["underdog"].priority, "underdog"))
    
    # ============== Mock 嘲讽类 ==============
    
    # Fade Him - 反向指标
    if stats.win_rate <= 0.35 and stats.total_rounds >= 15:
        matched_tags.append((TAGS["fade_him"].priority, "fade_him"))
    
    # Free Money - 长期送分
    if stats.win_rate <= 0.40 and stats.total_rounds >= 30:
        matched_tags.append((TAGS["free_money"].priority, "free_money"))
    
    # Down Bad - 大回撤
    if stats.drawdown >= 35:
        matched_tags.append((TAGS["down_bad"].priority, "down_bad"))
    
    # NGMI - 从高处跌落
    if stats.peak_score is not None:
        if stats.peak_score > 650 and stats.score < 400:
            matched_tags.append((TAGS["ngmi"].priority, "ngmi"))
    
    # Bozo - 长连败
    if stats.streak <= -5:
        matched_tags.append((TAGS["bozo"].priority, "bozo"))
    
    # Touch Grass - 长时间没下注
    if stats.days_inactive is not None and stats.days_inactive >= 7:
        matched_tags.append((TAGS["touch_grass"].priority, "touch_grass"))
    
    # ============== 排序 & 截断 ==============
    
    # 按优先级排序
    matched_tags.sort(key=lambda x: x[0])
    
    # 应用互斥规则：同时有 glory 和 mock 时，优先显示 glory
    # (除非是 fallen_king 这种剧情标签)
    result_tags = [tag_id for _, tag_id in matched_tags]
    
    return result_tags[:max_tags]


def get_tag_definition(tag_id: str) -> Optional[TagDefinition]:
    """获取标签定义"""
    return TAGS.get(tag_id)


def get_all_tags() -> list[TagDefinition]:
    """获取所有标签定义"""
    return list(TAGS.values())
