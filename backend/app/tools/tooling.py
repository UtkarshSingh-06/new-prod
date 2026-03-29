from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from langchain_core.tools import tool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.priority import PrioritySignals, priority_label_from_score, score_priority
from app.engines.scheduler import schedule_tasks
from app.llm.schemas import TaskSpec
from app.tools.calendar import build_ics_event
from app.tools.notifications import create_notifications


class ApplyTaskPlanArgs(BaseModel):
    tasks: list[TaskSpec] = Field(min_length=1)
    assumptions: list[str] = Field(default_factory=list)
    # If provided, the assistant wants tasks to be scheduled around these constraints.
    # For demo, we only use this as a hint for scheduling window selection later.
    preferences: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class _TempTask:
    temp_id: int
    title: str
    description: str
    priority_label: str
    estimated_minutes: int | None
    due_at: Any
    priority_score: float


def build_apply_task_plan_tool(db: AsyncSession, user_id: int):
    @tool("apply_task_plan", args_schema=ApplyTaskPlanArgs, return_direct=False)
    async def apply_task_plan(
        tasks: list[TaskSpec],
        assumptions: list[str] | None = None,
        preferences: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Persist tasks, score+schedule them, generate calendar ICS events, and store notifications.
        """
        _ = preferences or {}  # reserved for future scheduling hints
        assumptions = assumptions or []
        temp_tasks: list[_TempTask] = []
        for i, spec in enumerate(tasks):
            signals = PrioritySignals(
                priority_label=spec.priority,
                due_at=spec.due_at,
                estimated_minutes=spec.estimated_minutes,
            )
            score = score_priority(signals)
            temp_tasks.append(
                _TempTask(
                    temp_id=i,
                    title=spec.title,
                    description=spec.description,
                    priority_label=priority_label_from_score(score),
                    estimated_minutes=spec.estimated_minutes,
                    due_at=spec.due_at,
                    priority_score=score,
                )
            )

        schedule_map = schedule_tasks(temp_tasks)

        # Persist tasks
        from app.db.models import Task

        created_ids: list[int] = []
        scheduled_ids: list[int] = []
        now = datetime.now(timezone.utc)

        for t in temp_tasks:
            sched = schedule_map[t.temp_id]
            row = Task(
                user_id=user_id,
                title=t.title,
                description=t.description,
                priority_score=t.priority_score,
                priority_label=t.priority_label,
                due_at=sched.due_at,
                scheduled_start=sched.scheduled_start,
                scheduled_end=sched.scheduled_end,
                status="scheduled",
                calendar_event_status="created",
                calendar_ics=build_ics_event(
                    summary=t.title,
                    description=t.description,
                    start=sched.scheduled_start,
                    end=sched.scheduled_end,
                ),
                created_at=now,
            )
            db.add(row)
            await db.flush()
            created_ids.append(int(row.id))
            scheduled_ids.append(int(row.id))

        # Store notifications (demo)
        summary_lines = [
            f"- {t.title} ({t.priority_label}) scheduled {schedule_map[t.temp_id].scheduled_start.isoformat(timespec='minutes')}."
            for t in temp_tasks
        ]
        notif_msg = "Scheduled tasks:\n" + "\n".join(summary_lines)
        notif = await create_notifications(db, user_id=user_id, messages=[notif_msg] + assumptions, kind="info")
        await db.commit()

        return {
            "created_task_ids": created_ids,
            "scheduled_task_ids": scheduled_ids,
            "notifications_sent": notif.sent,
        }

    return apply_task_plan

