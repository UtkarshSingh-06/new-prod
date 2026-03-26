from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Base, User
from app.db.session import SessionLocal, engine
from app.llm.agent import LLMTaskAgent


logging.basicConfig(level=logging.INFO)
log = logging.getLogger("eval")


@dataclass
class EvalResult:
    dataset_id: str
    prompt_accuracy: float
    tool_success_rate: float
    latency_ms: int
    tool_actions_taken: bool
    created_task_ids: list[int]
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "dataset_id": self.dataset_id,
            "prompt_accuracy": self.prompt_accuracy,
            "tool_success_rate": self.tool_success_rate,
            "latency_ms": self.latency_ms,
            "tool_actions_taken": self.tool_actions_taken,
            "created_task_ids": self.created_task_ids,
            "error": self.error,
        }


def _prompt_accuracy(planned_titles: list[str], expected_titles: list[str]) -> float:
    if not expected_titles:
        return 1.0
    matches = 0
    exp = set(expected_titles)
    for t in planned_titles:
        if t in exp:
            matches += 1
    # Fraction of expected that were present.
    return min(1.0, matches / max(1, len(expected_titles)))


async def _ensure_user(db: AsyncSession, email: str = "eval-user@example.com", password_hash: str = "unused") -> int:
    row = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if row:
        return int(row.id)
    db.add(User(email=email, password_hash=password_hash))
    await db.flush()
    await db.commit()
    return int((await db.execute(select(User).where(User.email == email))).scalar_one().id)


async def evaluate() -> list[EvalResult]:
    dataset_path = Path(__file__).parent / "sample_dataset.json"
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))

    # Create tables (local)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    agent = LLMTaskAgent()

    results: list[EvalResult] = []
    async with SessionLocal() as db:
        user_id = await _ensure_user(db)
        for item in dataset:
            t0 = time.perf_counter()
            created_task_ids: list[int] = []
            tool_actions_taken = False
            try:
                response = await agent.run(user_id=user_id, user_message=item["user_message"], db_session=db)
                planned_titles = [t.title for t in response.plan.tasks]
                created_task_ids = response.created_task_ids
                tool_actions_taken = len(created_task_ids) > 0 or response.notifications_sent > 0

                prompt_accuracy = _prompt_accuracy(planned_titles, item.get("expected_task_titles", []))
                tool_success_rate = 1.0 if tool_actions_taken else 0.0
                latency_ms = int((time.perf_counter() - t0) * 1000)

                results.append(
                    EvalResult(
                        dataset_id=item["id"],
                        prompt_accuracy=prompt_accuracy,
                        tool_success_rate=tool_success_rate,
                        latency_ms=latency_ms,
                        tool_actions_taken=tool_actions_taken,
                        created_task_ids=created_task_ids,
                        error=None,
                    )
                )
                await db.commit()
            except Exception as e:
                latency_ms = int((time.perf_counter() - t0) * 1000)
                results.append(
                    EvalResult(
                        dataset_id=item["id"],
                        prompt_accuracy=0.0,
                        tool_success_rate=0.0,
                        latency_ms=latency_ms,
                        tool_actions_taken=False,
                        created_task_ids=[],
                        error=str(e),
                    )
                )

            log.info("Eval %s: %s", item["id"], results[-1].to_dict())

    return results


if __name__ == "__main__":
    if not settings.openai_api_key:
        raise SystemExit("Set OPENAI_API_KEY to run the evaluation pipeline.")

    out = asyncio.run(evaluate())
    output_path = Path(__file__).parent.parent.parent / "eval_results.json"
    output_path.write_text(json.dumps([r.to_dict() for r in out], indent=2), encoding="utf-8")
    print(f"Wrote {len(out)} results to {output_path}")

