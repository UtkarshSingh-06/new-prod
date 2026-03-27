from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class CalendarEventResult:
    ics: str
    status: str = "created"


def _fmt_dt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt_utc = dt.astimezone(timezone.utc)
    return dt_utc.strftime("%Y%m%dT%H%M%SZ")


def build_ics_event(summary: str, description: str, start: datetime, end: datetime) -> str:
    uid = f"{summary}-{int(start.timestamp())}".replace(" ", "-")
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return "\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//LLM Task Assistant//EN",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{_fmt_dt(start)}",
            f"DTEND:{_fmt_dt(end)}",
            f"SUMMARY:{summary.replace(chr(10), ' ').replace(',', '')}",
            f"DESCRIPTION:{description.replace(chr(10), ' ').replace(',', '')}",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
    )

