"""Light (free-hosting) retrieval mode: Gemini embeddings + a numpy index. The embedding API is replaced by a fake."""

import zlib

import numpy as np
import pytest

from app.config import settings
from app.rag import ingest, retriever


def fake_embed(texts, *, query=False):
    """Deterministic bag-of-words vectors, unit length, so similar texts score higher."""
    out = np.zeros((len(texts), 64), dtype=np.float32)
    for i, text in enumerate(texts):
        for word in text.lower().split():
            out[i, zlib.crc32(word.encode()) % 64] += 1
    return out / np.clip(np.linalg.norm(out, axis=1, keepdims=True), 1e-12, None)


@pytest.fixture
def light(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "embedding_backend", "gemini")
    monkeypatch.setattr(settings, "index_dir", tmp_path)
    monkeypatch.setattr(ingest, "embed", fake_embed)
    monkeypatch.setattr(retriever, "embed", fake_embed)
    retriever.get_retriever.cache_clear()
    yield tmp_path
    retriever.get_retriever.cache_clear()


def test_build_writes_a_fresh_light_index(light):
    assert not ingest.index_is_fresh()
    stats = ingest.build()
    assert stats["backend"] == "gemini" and stats["chunks"] > 50
    assert {p.name for p in light.iterdir()} == {"chunks.json", "vectors.npy", "meta.json"}
    assert ingest.index_is_fresh()
    assert np.load(light / "vectors.npy").shape[0] == stats["chunks"]


def test_index_goes_stale_when_the_knowledge_base_or_model_changes(light, monkeypatch):
    ingest.build()
    assert ingest.index_is_fresh()
    monkeypatch.setattr(settings, "gemini_embedding_dims", 256)
    assert not ingest.index_is_fresh()


def test_search_returns_best_matches_first(light):
    ingest.build()
    r = retriever.DenseRetriever()
    assert r.name == "Gemini embeddings + numpy"
    chunk = next(iter(r.chunks.values()))
    hits = r.search(chunk.text, k=4)  # asking with a chunk's own text must return that chunk first
    assert len(hits) == 4
    assert hits[0].chunk.chunk_id == chunk.chunk_id
    assert [h.score for h in hits] == sorted((h.score for h in hits), reverse=True)


def test_missing_vectors_raise_index_missing(light):
    ingest.build()
    (light / "vectors.npy").unlink()
    with pytest.raises(retriever.IndexMissing):
        retriever.DenseRetriever()


def test_ensure_index_never_raises_when_embedding_fails(light, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("quota")

    monkeypatch.setattr(ingest, "embed", boom)
    ingest.ensure_index()  # logs the error, does not crash app startup
    assert not ingest.index_is_fresh()
