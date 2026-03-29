from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.models import Task, TaskSubItem, User
from app.db.session import get_db
from app.engines.priority import PrioritySignals, priority_label_from_score, score_priority

router = APIRouter(prefix="/tasks", tags=["tasks"])


class SubItemOut(BaseModel):
    id: int
    title: str
    done: bool
    position: int


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
    subitems: list[SubItemOut] = Field(default_factory=list)


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _task_to_out(task: Task) -> TaskOut:
    subs = sorted(task.subitems, key=lambda s: (s.done, s.position, s.id))
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description or "",
        priority_score=float(task.priority_score),
        priority_label=task.priority_label,
        due_at=task.due_at,
        scheduled_start=task.scheduled_start,
        scheduled_end=task.scheduled_end,
        status=task.status,
        calendar_event_status=task.calendar_event_status,
        subitems=[
            SubItemOut(id=s.id, title=s.title, done=s.done, position=s.position) for s in subs
        ],
    )


async def _get_owned_task(
    db: AsyncSession, user_id: int, task_id: int
) -> Task | None:
    r = await db.execute(
        select(Task)
        .where(Task.id == task_id, Task.user_id == user_id)
        .options(selectinload(Task.subitems))
    )
    return r.scalar_one_or_none()


class TaskDueBody(BaseModel):
    """Set or clear due date; priority score is recomputed from the current label + new due time."""

    due_at: datetime | None = None


class SubItemCreateBody(BaseModel):
    title: str = Field(min_length=1, max_length=500)


class SubItemPatchBody(BaseModel):
    done: bool


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[TaskOut]:
    rows = (
        await db.execute(
            select(Task)
            .where(Task.user_id == current_user.id)
            .options(selectinload(Task.subitems))
            .order_by(Task.priority_score.desc())
        )
    ).scalars().all()
    return [_task_to_out(r) for r in rows]


@router.patch("/{task_id}/due", response_model=TaskOut)
async def patch_task_due(
    task_id: int,
    body: TaskDueBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task = await _get_owned_task(db, current_user.id, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.due_at = _ensure_utc(body.due_at)
    signals = PrioritySignals(
        priority_label=task.priority_label,
        due_at=task.due_at,
        estimated_minutes=None,
    )
    task.priority_score = score_priority(signals)
    task.priority_label = priority_label_from_score(task.priority_score)
    await db.commit()
    await db.refresh(task)
    task = await _get_owned_task(db, current_user.id, task_id)
    assert task is not None
    return _task_to_out(task)


@router.post("/{task_id}/subitems", response_model=SubItemOut, status_code=status.HTTP_201_CREATED)
async def create_subitem(
    task_id: int,
    body: SubItemCreateBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubItemOut:
    task = await _get_owned_task(db, current_user.id, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    max_pos = (
        await db.execute(select(func.coalesce(func.max(TaskSubItem.position), -1)).where(TaskSubItem.task_id == task_id))
    ).scalar_one()
    row = TaskSubItem(
        task_id=task_id,
        title=body.title.strip(),
        done=False,
        position=int(max_pos) + 1,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return SubItemOut(id=row.id, title=row.title, done=row.done, position=row.position)


@router.patch("/{task_id}/subitems/{subitem_id}", response_model=SubItemOut)
async def patch_subitem(
    task_id: int,
    subitem_id: int,
    body: SubItemPatchBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubItemOut:
    task = await _get_owned_task(db, current_user.id, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    r = await db.execute(
        select(TaskSubItem).where(
            TaskSubItem.id == subitem_id, TaskSubItem.task_id == task_id
        )
    )
    sub = r.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-item not found")

    sub.done = body.done
    await db.commit()
    await db.refresh(sub)
    return SubItemOut(id=sub.id, title=sub.title, done=sub.done, position=sub.position)


@router.delete("/{task_id}/subitems/{subitem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subitem(
    task_id: int,
    subitem_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    task = await _get_owned_task(db, current_user.id, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    r = await db.execute(
        select(TaskSubItem).where(
            TaskSubItem.id == subitem_id, TaskSubItem.task_id == task_id
        )
    )
    sub = r.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-item not found")

    await db.execute(
        delete(TaskSubItem).where(
            TaskSubItem.id == subitem_id, TaskSubItem.task_id == task_id
        )
    )
    await db.commit()
