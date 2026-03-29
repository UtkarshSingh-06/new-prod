"""Resolve ChatOpenAI settings for OpenAI-compatible providers (OpenAI, Groq, Ollama, etc.)."""

from __future__ import annotations

from typing import Any, Literal

from app.core.config import settings

LLMProvider = Literal["openai", "groq", "ollama"]


def effective_llm_provider() -> LLMProvider:
    """Resolve provider. Groq keys (gsk_) always use Groq.

    System environment variables override values from .env; a stray LLM_PROVIDER=ollama
    in the OS would otherwise send a Groq key to localhost:11434 and fail or mis-route.
    """
    key = (settings.openai_api_key or "").strip()
    if key.startswith("gsk_"):
        return "groq"
    declared: LLMProvider = settings.llm_provider  # type: ignore[assignment]
    if declared != "openai":
        return declared
    return "openai"


def _default_model(provider: LLMProvider) -> str:
    return {
        "openai": "gpt-4o-mini",
        "groq": "llama-3.3-70b-versatile",
        "ollama": "llama3.2",
    }[provider]


def resolved_chat_model(provider: LLMProvider) -> str:
    if settings.llm_model:
        return settings.llm_model
    if provider != "openai" and settings.openai_model == "gpt-4o-mini":
        return _default_model(provider)
    return settings.openai_model


def build_chat_llm_kwargs() -> dict[str, Any]:
    """Kwargs for langchain_openai.ChatOpenAI."""
    provider = effective_llm_provider()
    model = resolved_chat_model(provider)
    api_key = settings.openai_api_key or ""
    base_url = (settings.llm_base_url or "").strip().rstrip("/") or None

    if provider == "groq":
        base_url = "https://api.groq.com/openai/v1"
    elif provider == "ollama":
        base_url = base_url or "http://127.0.0.1:11434/v1"
        api_key = api_key or "ollama"

    out: dict[str, Any] = {"model": model, "temperature": 0, "api_key": api_key}
    if base_url:
        out["base_url"] = base_url
    return out


def validate_llm_config_for_startup() -> None:
    """Raise RuntimeError if chat cannot be configured."""
    provider = effective_llm_provider()
    if provider in ("openai", "groq") and not (settings.openai_api_key or "").strip():
        raise RuntimeError(
            f"Missing API key for LLM_PROVIDER={provider!r}. "
            "Set OPENAI_API_KEY (OpenAI) or put your Groq key in OPENAI_API_KEY."
        )
    if provider == "ollama":
        return
