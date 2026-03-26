from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


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

    # Database
    database_url: str = "sqlite+aiosqlite:///./dev.db"

    # LLM
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

    # Embeddings + Memory
    chroma_url: str = "http://localhost:8001"  # chromadb server for local dev

    # LangSmith
    langsmith_api_key: Optional[str] = None
    langsmith_project: str = "llm-task-assistant"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

