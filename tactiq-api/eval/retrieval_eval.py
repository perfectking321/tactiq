"""Compare TF-IDF (classic ML/NLP) and MiniLM (Transformer) retrieval on labelled player questions.

Usage:  python -m eval.retrieval_eval
Writes eval/output/retrieval_results.json and .md (used in the Review-2 slides).

Metrics (document-level relevance: a hit counts if it comes from a document labelled relevant):
  Hit@1 / Hit@3  - share of questions with a relevant passage in the top 1 / top 3
  MRR@5          - mean reciprocal rank of the first relevant passage in the top 5
"""

import json
import statistics
import time
from pathlib import Path

from app.rag.retriever import DenseRetriever, Hit, TfidfRetriever

HERE = Path(__file__).parent
OUT = HERE / "output"


class HybridRRF:
    """Reciprocal Rank Fusion of TF-IDF and MiniLM (standard k=60). Evaluated, not used in the app."""

    name = "Hybrid (TF-IDF + MiniLM, RRF)"

    def __init__(self, dense, sparse, k: int = 60, pool: int = 20):
        self.retrievers, self.k, self.pool = (dense, sparse), k, pool

    def search(self, query: str, k: int = 5) -> list[Hit]:
        scores, chunks = {}, {}
        for r in self.retrievers:
            for rank, h in enumerate(r.search(query, self.pool), 1):
                scores[h.chunk.chunk_id] = scores.get(h.chunk.chunk_id, 0) + 1 / (self.k + rank)
                chunks[h.chunk.chunk_id] = h.chunk
        top = sorted(scores, key=scores.get, reverse=True)[:k]
        return [Hit(chunks[c], round(scores[c], 4)) for c in top]


def load_questions() -> list[dict]:
    lines = (HERE / "retrieval_questions.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def evaluate(retriever, questions: list[dict], k: int = 5) -> dict:
    hit1 = hit3 = 0
    rr = []
    latencies = []
    per_question = []
    for item in questions:
        start = time.perf_counter()
        hits = retriever.search(item["q"], k=k)
        latencies.append((time.perf_counter() - start) * 1000)
        ranks = [i for i, h in enumerate(hits, 1) if h.chunk.doc_id in item["relevant"]]
        first = ranks[0] if ranks else None
        hit1 += first == 1
        hit3 += first is not None and first <= 3
        rr.append(1 / first if first else 0.0)
        per_question.append({"q": item["q"], "first_relevant_rank": first, "top1": hits[0].chunk.chunk_id})
    n = len(questions)
    return {
        "name": retriever.name,
        "hit@1": round(hit1 / n, 3),
        "hit@3": round(hit3 / n, 3),
        "mrr@5": round(sum(rr) / n, 3),
        "median_ms_per_query": round(statistics.median(latencies), 1),
        "per_question": per_question,
    }


def main():
    questions = load_questions()
    dense, sparse = DenseRetriever(), TfidfRetriever()
    dense.search("warm up")  # load the model before timing
    results = [
        evaluate(sparse, questions),
        evaluate(dense, questions),
        evaluate(HybridRRF(dense, sparse), questions),
    ]

    OUT.mkdir(exist_ok=True)
    (OUT / "retrieval_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")

    tfidf, mini, _ = results
    wins = [
        (a["q"], a["first_relevant_rank"], b["first_relevant_rank"])
        for a, b in zip(tfidf["per_question"], mini["per_question"])
        if (b["first_relevant_rank"] or 99) < (a["first_relevant_rank"] or 99)
    ]
    losses = [
        (a["q"], a["first_relevant_rank"], b["first_relevant_rank"])
        for a, b in zip(tfidf["per_question"], mini["per_question"])
        if (a["first_relevant_rank"] or 99) < (b["first_relevant_rank"] or 99)
    ]

    md = [
        f"# Retrieval evaluation ({len(questions)} labelled player questions)",
        "",
        "| Retriever | Hit@1 | Hit@3 | MRR@5 | Median ms/query |",
        "|---|---|---|---|---|",
        *[
            f"| {r['name']} | {r['hit@1']:.0%} | {r['hit@3']:.0%} | {r['mrr@5']:.3f} | {r['median_ms_per_query']} |"
            for r in results
        ],
        "",
        f"MiniLM ranked the relevant passage higher on **{len(wins)}** questions; TF-IDF did better on **{len(losses)}**.",
        "",
        "## Questions where the Transformer helped (rank: TF-IDF -> MiniLM)",
        *[f"- {q} ({a or 'not in top 5'} -> {b})" for q, a, b in wins],
        "",
        "## Questions where TF-IDF did better",
        *([f"- {q} ({a} vs {b or 'not in top 5'})" for q, a, b in losses] or ["- none"]),
    ]
    (OUT / "retrieval_results.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[: 4 + len(results)]))
    print(f"\nFull report: {OUT / 'retrieval_results.md'}")


if __name__ == "__main__":
    main()
