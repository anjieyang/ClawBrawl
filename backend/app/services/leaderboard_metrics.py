from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from app.core.config import settings


@dataclass(frozen=True)
class LeaderboardMetrics:
    pnl: int
    roi: float
    profit_factor: Optional[float]
    drawdown: int
    streak: int
    equity_curve: list[int]


def _normalize_score_change(score_change: Optional[int], result: str) -> int:
    if score_change is not None:
        return int(score_change)
    if result == "win":
        return settings.WIN_SCORE
    if result == "lose":
        return settings.LOSE_SCORE
    return settings.DRAW_SCORE


def compute_metrics_from_bets(
    *,
    current_score: int,
    bets: Iterable[tuple[Optional[int], str]],
    curve_points: int = 20,
    streak_points: int = 10,
) -> LeaderboardMetrics:
    """
    Compute derived metrics from settled bets.

    `bets` must be ordered from newest -> oldest, and include only non-pending results.
    Each entry: (score_change, result).
    """
    settled = [(_normalize_score_change(sc, res), res) for sc, res in bets]

    pnl = sum(sc for sc, _ in settled)
    roi = round(((current_score - settings.INITIAL_SCORE) / settings.INITIAL_SCORE) * 100, 1)

    gross_profit = sum(sc for sc, _ in settled if sc > 0)
    gross_loss = -sum(sc for sc, _ in settled if sc < 0)
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else None

    streak = 0
    for _, res in settled[:streak_points]:
        if res == "win":
            streak = streak + 1 if streak >= 0 else 1
        elif res == "lose":
            streak = streak - 1 if streak <= 0 else -1
        else:
            break

    # Equity curve: build from oldest -> newest for sparkline
    deltas = [sc for sc, _ in reversed(settled[:curve_points])]
    equity = settings.INITIAL_SCORE
    curve: list[int] = []
    for d in deltas:
        equity += d
        curve.append(equity)

    peak = settings.INITIAL_SCORE
    max_dd = 0.0
    for v in curve:
        peak = max(peak, v)
        if peak > 0:
            max_dd = max(max_dd, (peak - v) / peak * 100)
    drawdown = int(round(max_dd))

    return LeaderboardMetrics(
        pnl=int(pnl),
        roi=float(roi),
        profit_factor=profit_factor,
        drawdown=drawdown,
        streak=int(streak),
        equity_curve=curve,
    )

