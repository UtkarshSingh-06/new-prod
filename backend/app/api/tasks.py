from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Task, User
from app.db.session import get_db


router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    priority_score: float
    priority_label: str
    due_at: datetime | None
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    status: str
    calendar_event_status: str


@router.get("", response_model=list[TaskOut])
async def list_tasks(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[TaskOut]:
    rows = (await db.execute(select(Task).where(Task.user_id == current_user.id).order_by(Task.priority_score.desc()))).scalars().all()
    return [
        TaskOut(
            id=r.id,
            title=r.title,
            description=r.description,
            priority_score=float(r.priority_score),
            priority_label=r.priority_label,
            due_at=r.due_at,
            scheduled_start=r.scheduled_start,
            scheduled_end=r.scheduled_end,
            status=r.status,
            calendar_event_status=r.calendar_event_status,
        )
        for r in rows
    ]

