from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import Iterable

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MemoryWriteResult:
    wrote: bool


class MemoryRepository:
    def __init__(self) -> None:
        self._embeddings = None
        self._vector_kwargs = {
            "collection_name": "task-assistant-memory",
        }

        if settings.openai_api_key:
            self._embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=settings.openai_api_key,
            )
        # After one failed Chroma call, skip further attempts (avoids long TCP timeouts per chat).
        self._memory_unavailable = False

    def _get_store(self) -> Chroma | None:
        if not settings.enable_chroma_memory or not self._embeddings:
            return None

        # Chroma HTTP server (docker-compose provides it when enabled).
        u = urlparse(settings.chroma_url)
        host = u.hostname or "localhost"
        port = u.port if u.port is not None else 8001

        # langchain-chroma expects chromadb.config.Settings or host/port for HttpClient;
        # the old dict-shaped client_settings raises AttributeError at runtime.
        return Chroma(
            embedding_function=self._embeddings,
            collection_name=self._vector_kwargs["collection_name"],
            host=host,
            port=port,
        )

    def search(self, user_id: str, query: str, k: int = 5) -> list[Document]:
        if self._memory_unavailable:
            return []
        try:
            store = self._get_store()
            if not store:
                return []
            return store.similarity_search(query, k=k, filter={"user_id": user_id})
        except Exception:
            self._memory_unavailable = True
            logger.warning("Chroma memory search skipped (server down or misconfigured).", exc_info=True)
            return []

    def write(self, user_id: str, texts: Iterable[str]) -> MemoryWriteResult:
        if self._memory_unavailable:
            return MemoryWriteResult(wrote=False)
        try:
            store = self._get_store()
            if not store:
                return MemoryWriteResult(wrote=False)

            now = datetime.now(timezone.utc)
            documents = [
                Document(page_content=t, metadata={"user_id": user_id, "created_at": now.isoformat()})
                for t in texts
                if t.strip()
            ]
            if not documents:
                return MemoryWriteResult(wrote=False)

            store.add_documents(documents)
            return MemoryWriteResult(wrote=True)
        except Exception:
            self._memory_unavailable = True
            logger.warning("Chroma memory write skipped (server down or misconfigured).", exc_info=True)
            return MemoryWriteResult(wrote=False)

