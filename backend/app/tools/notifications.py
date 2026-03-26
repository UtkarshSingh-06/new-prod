from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification


@dataclass(frozen=True)
class NotificationsResult:
    sent: int


async def create_notifications(db: AsyncSession, user_id: int, messages: list[str], kind: str = "info") -> NotificationsResult:
    now = datetime.now(timezone.utc)
    rows = [
        Notification(user_id=user_id, kind=kind, message=m, created_at=now)
        for m in messages
        if m and m.strip()
    ]
    db.add_all(rows)
    await db.flush()
    return NotificationsResult(sent=len(rows))

