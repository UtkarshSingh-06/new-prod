from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from langchain_core.exceptions import OutputParserException
from openai import APIConnectionError, APIError, APIStatusError, AuthenticationError, RateLimitError
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.llm.agent import LLMTaskAgent
from app.llm.schemas import AssistantChatResponse

logger = logging.getLogger(__name__)

# Shown when OpenAI returns 429 / insufficient_quota (or same from compatible APIs).
_LLM_QUOTA_DETAIL = (
    "Your LLM provider refused the request (rate limit or billing quota).\n\n"
    "If you use OpenAI: add credits at https://platform.openai.com/account/billing\n\n"
    "Free cloud option: get a key from https://console.groq.com and put it in OPENAI_API_KEY in backend/.env "
    "(Groq keys start with gsk_ — the API uses Groq automatically; you can also set LLM_PROVIDER=groq).\n\n"
    "Free local option: LLM_PROVIDER=ollama, run ollama serve, then ollama pull llama3.2 — restart the API."
)

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
            detail=(
                "LLM agent did not start. Check the API process logs, fix backend/.env, then restart the server.\n\n"
                "• OpenAI: set OPENAI_API_KEY\n"
                "• Groq (free): LLM_PROVIDER=groq and OPENAI_API_KEY=your Groq key from https://console.groq.com\n"
                "• Ollama (local, no cloud key): LLM_PROVIDER=ollama — run ollama serve and ollama pull llama3.2"
            ),
        )
    # Request id used for correlation in logs/telemetry.
    request_id = request.headers.get("x-request-id")
    try:
        return await agent.run(
            user_id=current_user.id,
            user_message=body.message,
            db_session=db,
            request_id=request_id,
        )
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_LLM_QUOTA_DETAIL,
        ) from None
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI rejected the API key. Verify OPENAI_API_KEY in backend/.env.",
        ) from None
    except APIConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach OpenAI: {e!s}",
        ) from None
    except APIStatusError as e:
        logger.warning("OpenAI HTTP error: %s", e, exc_info=True)
        if e.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_LLM_QUOTA_DETAIL,
            ) from None
        msg = getattr(e, "message", None) or str(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenAI error ({e.status_code}): {msg}",
        ) from None
    except APIError as e:
        logger.warning("OpenAI API error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenAI error: {e!s}",
        ) from None
    except OutputParserException:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The model returned a plan we could not parse. Try a clearer or shorter request.",
        ) from None

