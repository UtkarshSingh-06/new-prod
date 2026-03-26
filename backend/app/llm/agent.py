from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.llm.prompts import FEW_SHOT_EXAMPLES, SYSTEM_PROMPT
from app.llm.schemas import AssistantChatResponse, TaskPlan
from app.memory.vectorstore import MemoryRepository
from app.tools.tooling import build_apply_task_plan_tool


class LLMTaskAgent:
    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise RuntimeError("Missing OpenAI API key. Set OPENAI_API_KEY in your environment.")

        self._llm = ChatOpenAI(model=settings.openai_model, temperature=0)
        self._memory = MemoryRepository()

    async def run(self, *, user_id: int, user_message: str, db_session, request_id: str | None = None) -> AssistantChatResponse:
        parser = PydanticOutputParser(pydantic_object=TaskPlan)
        format_instructions = parser.get_format_instructions()

        retrieved = self._memory.search(str(user_id), query=user_message, k=5)
        memory_context = "\n".join([f"- {d.page_content}" for d in retrieved]) if retrieved else ""

        # Few-shot: embed examples directly to improve structured accuracy.
        examples_text = "\n\n".join(
            [
                f"User: {ex['user']}\nAssistant:\n{ex['assistant_json'].strip()}"
                for ex in FEW_SHOT_EXAMPLES
            ]
        )

        system = (
            SYSTEM_PROMPT
            + "\n\n"
            + "Few-shot examples:\n"
            + examples_text
            + "\n\n"
            + "Output schema:\n"
            + format_instructions
            + (f"\n\nRetrieved memory:\n{memory_context}" if memory_context else "")
            + "\n\nRespond with valid JSON only."
        )

        t0 = time.perf_counter()
        result = self._llm.invoke([SystemMessage(content=system), HumanMessage(content=user_message)])
        _ = time.perf_counter() - t0  # reserved for latency in logs later

        # Parse structured plan
        raw = (result.content or "").strip()
        plan = parser.parse(raw)

        memory_written = self._memory.write(str(user_id), texts=[user_message] + plan.assumptions)

        created_task_ids: list[int] = []
        scheduled_task_ids: list[int] = []
        notifications_sent = 0

        if plan.next_action == "create_tasks" and plan.clarification_questions == []:
            tool = build_apply_task_plan_tool(db_session, user_id)
            tool_out = await tool.ainvoke({"tasks": plan.tasks, "assumptions": plan.assumptions})
            created_task_ids = tool_out.get("created_task_ids", []) or []
            scheduled_task_ids = tool_out.get("scheduled_task_ids", []) or []
            notifications_sent = int(tool_out.get("notifications_sent", 0) or 0)

        return AssistantChatResponse(
            plan=plan,
            created_task_ids=created_task_ids,
            scheduled_task_ids=scheduled_task_ids,
            notifications_sent=notifications_sent,
            memory_written=memory_written.wrote,
        )

