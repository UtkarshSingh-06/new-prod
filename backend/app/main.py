import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.tasks import router as tasks_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.security import hash_password
from app.db.models import Base
from app.db.models import User
from app.db.session import SessionLocal, engine
from app.llm.agent import LLMTaskAgent


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title=settings.app_name)
    # JWT in Authorization only (no cookies). Keeps CORS simple for LAN / wildcard origins.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(chat_router)
    app.include_router(tasks_router)

    @app.on_event("startup")
    async def _startup() -> None:
        # LangSmith / LangChain tracing (optional)
        if settings.langsmith_api_key:
            os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
            os.environ.setdefault("LANGCHAIN_API_KEY", settings.langsmith_api_key)
            os.environ.setdefault("LANGSMITH_API_KEY", settings.langsmith_api_key)
            os.environ.setdefault("LANGCHAIN_PROJECT", settings.langsmith_project)

        # Create tables for local/dev. In production you would use Alembic migrations.
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed a demo login account for quick local onboarding.
        if settings.seed_demo_user:
            async with SessionLocal() as session:
                existing = (
                    await session.execute(select(User).where(User.email == settings.demo_user_email))
                ).scalar_one_or_none()
                if existing is None:
                    session.add(
                        User(
                            email=settings.demo_user_email,
                            password_hash=hash_password(settings.demo_user_password),
                        )
                    )
                    await session.commit()

        # Initialize the agent once per process.
        try:
            app.state.agent = LLMTaskAgent()
        except Exception as e:
            # Allow health endpoints when LLM is not configured (see LLM_PROVIDER / OPENAI_API_KEY).
            app.state.agent = None

            # Keep the error discoverable via logs.
            import logging

            logging.getLogger(__name__).warning("LLM agent not initialized: %s", e)

    return app


app = create_app()

