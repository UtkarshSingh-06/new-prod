from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, time
from typing import Iterable


WORK_START = time(9, 0)
WORK_END = time(17, 0)


@dataclass(frozen=True)
class SuggestedSchedule:
    due_at: datetime
    scheduled_start: datetime
    scheduled_end: datetime


def _next_workday_at(target: datetime, target_time: time) -> datetime:
    dt = datetime(target.year, target.month, target.day, target_time.hour, target_time.minute, tzinfo=timezone.utc)
    if dt < target:
        dt = dt + timedelta(days=1)
    return dt


def suggest_due_at(priority_label: str, estimated_minutes: int | None, now: datetime | None = None) -> datetime:
    """
    Simple deterministic due date suggestion when user doesn't provide one.
    - high: next workday
    - medium: in 2 workdays
    - low: in 4 workdays
    """
    now = now or datetime.now(timezone.utc)
    days = {"high": 1, "medium": 2, "low": 4}.get(priority_label, 2)
    due_date = now
    added = 0
    while added < days:
        due_date = due_date + timedelta(days=1)
        if due_date.weekday() < 5:  # Mon-Fri
            added += 1

    # Default due to 10:00 UTC for predictability.
    return datetime(due_date.year, due_date.month, due_date.day, 10, 0, tzinfo=timezone.utc)


def schedule_tasks(
    tasks: Iterable,
    now: datetime | None = None,
) -> dict[int, SuggestedSchedule]:
    """
    Accepts tasks that have `priority_score`, `priority_label`, `estimated_minutes`, and `due_at`.
    Returns mapping of temporary ordering index -> schedule.

    Note: we schedule sequentially for demo; in production, you would use calendar availability.
    """
    now = now or datetime.now(timezone.utc)

    # Sort by priority descending, then by shorter effort.
    sorted_tasks = sorted(
        list(tasks),
        key=lambda t: (-getattr(t, "priority_score", 0.0), getattr(t, "estimated_minutes", 999999) or 999999),
    )

    # Start at next work slot
    current = now
    if current.time() < WORK_START:
        current = datetime(current.year, current.month, current.day, WORK_START.hour, WORK_START.minute, tzinfo=timezone.utc)
    elif current.time() >= WORK_END or current.weekday() >= 5:
        # Move to next weekday work start
        current = datetime(current.year, current.month, current.day, WORK_START.hour, WORK_START.minute, tzinfo=timezone.utc)
        while current.weekday() >= 5:
            current = current + timedelta(days=1)
        if current <= now:
            current = current + timedelta(days=1)

    schedule: dict[int, SuggestedSchedule] = {}
    for t in sorted_tasks:
        duration = int(getattr(t, "estimated_minutes", None) or 45)
        duration = max(15, min(180, duration))

        start = current
        end = start + timedelta(minutes=duration)

        # If overflows work end, jump to next workday
        if end.time() > WORK_END:
            # advance to next weekday WORK_START
            current = datetime(start.year, start.month, start.day, WORK_START.hour, WORK_START.minute, tzinfo=timezone.utc) + timedelta(days=1)
            while current.weekday() >= 5:
                current = current + timedelta(days=1)
            start = current
            end = start + timedelta(minutes=duration)

        due_at = getattr(t, "due_at", None) or suggest_due_at(getattr(t, "priority_label", "medium"), getattr(t, "estimated_minutes", None), now=now)
        schedule[getattr(t, "temp_id")] = SuggestedSchedule(due_at=due_at, scheduled_start=start, scheduled_end=end)
        current = end
    return schedule

