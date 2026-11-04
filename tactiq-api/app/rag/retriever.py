"""Two retrievers over the same chunks.

- DenseRetriever: Transformer sentence embeddings (MiniLM) stored in ChromaDB. Used by the app.
- TfidfRetriever: classic TF-IDF bag-of-words baseline. Used in evaluation to justify the
  Transformer choice (see eval/retrieval_eval.py).
"""

import json
import pickle
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from app.config import settings
from app.rag.kb_loader import Chunk

COLLECTION = "tactiq_kb"


@dataclass
class Hit:
    chunk: Chunk
    score: float


class IndexMissing(RuntimeError):
    pass


def _load_chunks() -> list[Chunk]:
    path = settings.index_dir / "chunks.json"
    if not path.exists():
        raise IndexMissing("Knowledge base index not built. Run: python -m app.rag.ingest")
    return [Chunk(**c) for c in json.loads(path.read_text(encoding="utf-8"))]


@lru_cache
def get_embedder():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.embedding_model, cache_folder=str(settings.models_dir), device="cpu")


def embed(texts: list[str]) -> np.ndarray:
    return get_embedder().encode(texts, normalize_embeddings=True, show_progress_bar=False)


def chroma_client():
    import chromadb

    return chromadb.PersistentClient(
        path=str(settings.index_dir / "chroma"),
        settings=chromadb.Settings(anonymized_telemetry=False),
    )


class DenseRetriever:
    name = "MiniLM (Transformer) + ChromaDB"

    def __init__(self):
        self.chunks = {c.chunk_id: c for c in _load_chunks()}
        self.collection = chroma_client().get_collection(COLLECTION)

    def search(self, query: str, k: int = settings.top_k) -> list[Hit]:
        res = self.collection.query(query_embeddings=embed([query]).tolist(), n_results=k)
        # Chroma returns cosine *distance*; convert to similarity.
        return [
            Hit(self.chunks[cid], round(1 - dist, 4))
            for cid, dist in zip(res["ids"][0], res["distances"][0])
        ]


class TfidfRetriever:
    name = "TF-IDF (scikit-learn)"

    def __init__(self):
        path = settings.index_dir / "tfidf.pkl"
        if not path.exists():
            raise IndexMissing("TF-IDF index not built. Run: python -m app.rag.ingest")
        with path.open("rb") as f:
            data = pickle.load(f)
        self.vectorizer, self.matrix = data["vectorizer"], data["matrix"]
        self.chunks = _load_chunks()

    def search(self, query: str, k: int = settings.top_k) -> list[Hit]:
        scores = (self.matrix @ self.vectorizer.transform([query]).T).toarray().ravel()
        top = np.argsort(-scores)[:k]
        return [Hit(self.chunks[i], round(float(scores[i]), 4)) for i in top]


@lru_cache
def get_retriever() -> DenseRetriever:
    return DenseRetriever()
