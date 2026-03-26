from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TaskSpec(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)

    # The assistant proposes; the intelligence engine will refine.
    priority: Literal["low", "medium", "high"] = "medium"

    # ISO-8601 when present.
    due_at: datetime | None = None

    # Estimated duration in minutes (if user implies a time requirement).
    estimated_minutes: int | None = Field(default=None, ge=5, le=24 * 60)

    # Optional category to help scheduling and scoring.
    category: str | None = Field(default=None, max_length=50)


class TaskPlan(BaseModel):
    tasks: list[TaskSpec]
    assumptions: list[str] = Field(default_factory=list)
    next_action: Literal["create_tasks", "clarify_user"] = "create_tasks"
    clarification_questions: list[str] = Field(default_factory=list)


class AssistantChatResponse(BaseModel):
    plan: TaskPlan
    created_task_ids: list[int] = Field(default_factory=list)
    scheduled_task_ids: list[int] = Field(default_factory=list)
    notifications_sent: int = 0
    memory_written: bool = False

