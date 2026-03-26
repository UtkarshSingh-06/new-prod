from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


PRIORITY_WEIGHTS = {
    "low": 10,
    "medium": 40,
    "high": 80,
}


@dataclass(frozen=True)
class PrioritySignals:
    priority_label: str
    due_at: datetime | None
    estimated_minutes: int | None


def score_priority(signals: PrioritySignals) -> float:
    """
    Deterministic, explainable priority scoring.
    LLM can propose labels; we convert them to a numeric score and refine based on time.
    """
    base = PRIORITY_WEIGHTS.get(signals.priority_label, 40)

    now = datetime.now(timezone.utc)
    urgency_bonus = 0.0
    if signals.due_at:
        # Hours until due -> exponential-ish urgency curve.
        seconds = max(0.0, (signals.due_at - now).total_seconds())
        hours = seconds / 3600.0
        # Within 24h: ramp up strongly, beyond 72h: small effect.
        if hours <= 24:
            urgency_bonus = 60.0
        elif hours <= 72:
            urgency_bonus = 35.0
        elif hours <= 168:
            urgency_bonus = 15.0
        else:
            urgency_bonus = 5.0

    effort_bias = 0.0
    if signals.estimated_minutes:
        # Favor smaller tasks slightly so they get scheduled sooner.
        if signals.estimated_minutes <= 30:
            effort_bias = 10.0
        elif signals.estimated_minutes <= 90:
            effort_bias = 5.0
        else:
            effort_bias = 0.0

    return float(min(100.0, base * 0.7 + urgency_bonus + effort_bias))


def priority_label_from_score(score: float) -> str:
    if score >= 75:
        return "high"
    if score >= 45:
        return "medium"
    return "low"

