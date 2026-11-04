"""Build the retrieval indexes from kb/*.md.

Usage:  python -m app.rag.ingest
Re-run whenever a knowledge-base document is added or edited.
"""

import json
import pickle
import time

from sklearn.feature_extraction.text import TfidfVectorizer

from app.config import settings
from app.rag.kb_loader import chunk_documents, load_documents
from app.rag.retriever import COLLECTION, chroma_client, embed


def build() -> dict:
    started = time.time()
    docs = load_documents()
    chunks = chunk_documents(docs)
    settings.index_dir.mkdir(parents=True, exist_ok=True)
    (settings.index_dir / "chunks.json").write_text(
        json.dumps([c.to_dict() for c in chunks], indent=1), encoding="utf-8"
    )

    # Dense index: MiniLM sentence embeddings in a persistent Chroma collection (cosine space).
    client = chroma_client()
    if COLLECTION in [c.name for c in client.list_collections()]:
        client.delete_collection(COLLECTION)
    collection = client.create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})
    texts = [c.text for c in chunks]
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

    words = [len(c.text.split()) for c in chunks]
    return {
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
