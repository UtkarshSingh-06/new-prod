from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import Iterable

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

from app.core.config import settings


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
            self._embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    def _get_store(self) -> Chroma | None:
        if not self._embeddings:
            return None

        # For local dev, assume a Chroma server is running (docker-compose provides it).
        u = urlparse(settings.chroma_url)
        host = u.hostname or "localhost"
        port = u.port if u.port is not None else 8001

        return Chroma(
            embedding_function=self._embeddings,
            collection_name=self._vector_kwargs["collection_name"],
            client_settings={
                "chroma_api_impl": "rest",
                "chroma_server_host": host,
                "chroma_server_http_port": port,
            },
        )

    def search(self, user_id: str, query: str, k: int = 5) -> list[Document]:
        store = self._get_store()
        if not store:
            return []

        docs = store.similarity_search(query, k=k, filter={"user_id": user_id})
        return docs

    def write(self, user_id: str, texts: Iterable[str]) -> MemoryWriteResult:
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

