from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.llm.agent import LLMTaskAgent
from app.llm.schemas import AssistantChatResponse


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str


@router.post("", response_model=AssistantChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssistantChatResponse:
    agent: LLMTaskAgent | None = request.app.state.agent
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM agent not initialized. Set OPENAI_API_KEY.",
        )
    # Request id used for correlation in logs/telemetry.
    request_id = request.headers.get("x-request-id")
    return await agent.run(user_id=current_user.id, user_message=body.message, db_session=db, request_id=request_id)

