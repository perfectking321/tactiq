"""Build the retrieval indexes from kb/*.md.

Usage:  python -m app.rag.ingest
Re-run whenever a knowledge-base document is added or edited.

Two modes (EMBEDDING_BACKEND):
- local  (default): MiniLM embeddings in ChromaDB + a TF-IDF baseline index  -> ./index
- gemini (light):   Google embeddings in a small numpy file (vectors.npy)      -> ./kb_index
  The light index is committed to git so hosting needs no build step; ensure_index() rebuilds it if kb/ changed.
"""

import hashlib
import json
import logging
import pickle
import time

import numpy as np

from app.config import settings
from app.rag.kb_loader import chunk_documents, load_documents
from app.rag.retriever import COLLECTION, chroma_client, embed

log = logging.getLogger(__name__)


def kb_fingerprint() -> str:
    """Hash of the knowledge-base text + the embedding settings. Changes whenever the index would change."""
    h = hashlib.sha256()
    for path in sorted(settings.kb_dir.glob("*.md")):
        h.update(path.name.encode())
        h.update(path.read_bytes().replace(b"\r\n", b"\n"))  # same hash on Windows (CRLF) and Linux (LF) checkouts
    h.update(f"{settings.gemini_embedding_model}|{settings.gemini_embedding_dims}".encode())
    return h.hexdigest()[:16]


def index_is_fresh() -> bool:
    """True when the built index matches the current kb/ (always True in local mode, which only checks existence)."""
    if not (settings.index_dir / "chunks.json").exists():
        return False
    if settings.embedding_backend != "gemini":
        return True
    try:
        meta = json.loads((settings.index_dir / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return meta.get("fingerprint") == kb_fingerprint() and (settings.index_dir / "vectors.npy").exists()


def ensure_index() -> None:
    """Called at startup: build the index only if it is missing or stale. Never raises."""
    if index_is_fresh():
        return
    try:
        log.warning("Search index missing or out of date; building it now: %s", build())
    except Exception:  # noqa: BLE001
        log.exception("Could not build the search index. The AI coach will not work until it exists.")


def _write_chunks(chunks) -> None:
    settings.index_dir.mkdir(parents=True, exist_ok=True)
    (settings.index_dir / "chunks.json").write_text(
        json.dumps([c.to_dict() for c in chunks], indent=1), encoding="utf-8"
    )


def _build_light(chunks, texts: list[str]) -> None:
    vectors = embed(texts)
    np.save(settings.index_dir / "vectors.npy", vectors.astype(np.float32))
    (settings.index_dir / "meta.json").write_text(
        json.dumps({
            "fingerprint": kb_fingerprint(),
            "model": settings.gemini_embedding_model,
            "dims": settings.gemini_embedding_dims,
            "chunks": len(chunks),
        }, indent=1),
        encoding="utf-8",
    )


def _build_local(chunks, texts: list[str]) -> None:
    from sklearn.feature_extraction.text import TfidfVectorizer

    # Dense index: MiniLM sentence embeddings in a persistent Chroma collection (cosine space).
    client = chroma_client()
    if COLLECTION in [c.name for c in client.list_collections()]:
        client.delete_collection(COLLECTION)
    collection = client.create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})
    collection.add(
        ids=[c.chunk_id for c in chunks],
        embeddings=embed(texts).tolist(),
        documents=texts,
        metadatas=[{"doc_id": c.doc_id, "title": c.title, "section": c.section, "topic": c.topic} for c in chunks],
    )

    # Sparse baseline index: TF-IDF with unigrams + bigrams.
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    with (settings.index_dir / "tfidf.pkl").open("wb") as f:
        pickle.dump({"vectorizer": vectorizer, "matrix": matrix}, f)


def build() -> dict:
    started = time.time()
    docs = load_documents()
    chunks = chunk_documents(docs)
    _write_chunks(chunks)
    texts = [c.text for c in chunks]

    if settings.embedding_backend == "gemini":
        _build_light(chunks, texts)
    else:
        _build_local(chunks, texts)

    words = [len(c.text.split()) for c in chunks]
    return {
        "backend": settings.embedding_backend,
        "documents": len(docs),
        "chunks": len(chunks),
        "avg_words_per_chunk": round(sum(words) / len(words)),
        "min_words": min(words),
        "max_words": max(words),
        "seconds": round(time.time() - started, 1),
    }


if __name__ == "__main__":
    stats = build()
    print("Knowledge base indexed:")
    for k, v in stats.items():
        print(f"  {k}: {v}")
