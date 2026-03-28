from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal, Optional


class Settings(BaseSettings):
    # App
    app_name: str = "LLM Task Assistant"
    environment: str = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24  # 24h
    seed_demo_user: bool = True
    demo_user_email: str = "demo@example.com"
    demo_user_password: str = "Demo@12345"

    # Database
    database_url: str = "sqlite+aiosqlite:///./dev.db"

    # LLM — OpenAI, or OpenAI-compatible APIs (Groq, local Ollama, etc.)
    # groq: free tier at https://console.groq.com — put key in OPENAI_API_KEY
    # ollama: run `ollama serve` + `ollama pull llama3.2` (no cloud key)
    llm_provider: Literal["openai", "groq", "ollama"] = "openai"
    openai_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "LLM_API_KEY"),
    )
    openai_model: str = "gpt-4o-mini"
    llm_model: Optional[str] = Field(default=None, validation_alias="LLM_MODEL")
    # Optional override (e.g. custom gateway). Groq/Ollama set defaults in code.
    llm_base_url: Optional[str] = Field(default=None, validation_alias="LLM_BASE_URL")

    # Embeddings + Memory (Chroma HTTP server; docker-compose uses host "chroma")
    chroma_url: str = "http://localhost:8001"
    # Off by default: avoids connection attempts / long timeouts when Chroma is not running.
    enable_chroma_memory: bool = False

    # LangSmith
    langsmith_api_key: Optional[str] = None
    langsmith_project: str = "llm-task-assistant"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("llm_provider", mode="before")
    @classmethod
    def _normalize_llm_provider(cls, v: object) -> object:
        if isinstance(v, str):
            s = v.lower().strip()
            return s if s else "openai"
        return v


settings = Settings()

