"""Load the curated knowledge base and split it into retrieval chunks.

Chunking strategy: one chunk per `## ` section. Sections are written to cover a single idea,
so heading-based chunks keep each retrieved passage coherent. The document title and section
heading are prepended to the text so they contribute to both TF-IDF and embedding matching.
"""

import re
from dataclasses import asdict, dataclass
from pathlib import Path

from app.config import settings


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    title: str
    section: str
    topic: str
    text: str

    def to_dict(self) -> dict:
        return asdict(self)


def _parse_front_matter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---"):
        raise ValueError("missing front-matter")
    _, header, body = raw.split("---", 2)
    meta: dict = {"sources": []}
    for line in header.strip().splitlines():
        if line.strip().startswith("- "):
            meta["sources"].append(line.strip()[2:].strip().strip('"'))
        elif ":" in line and not line.startswith(" "):
            key, value = line.split(":", 1)
            if key.strip() != "sources":
                meta[key.strip()] = value.strip()
    return meta, body


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def load_documents(kb_dir: Path | None = None) -> list[dict]:
    kb_dir = kb_dir or settings.kb_dir
    docs = []
    for path in sorted(kb_dir.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
        for key in ("id", "title", "topic"):
            if key not in meta:
                raise ValueError(f"{path.name}: front-matter is missing '{key}'")
        docs.append({**meta, "body": body, "path": path.name})
    return docs


def chunk_documents(docs: list[dict]) -> list[Chunk]:
    chunks = []
    for doc in docs:
        sections = re.split(r"^## +", doc["body"], flags=re.MULTILINE)
        for section in sections[1:]:  # sections[0] is the H1 title / preamble
            heading, _, text = section.partition("\n")
            text = " ".join(text.split())
            if not text:
                continue
            chunks.append(Chunk(
                chunk_id=f"{doc['id']}#{_slug(heading)}",
                doc_id=doc["id"],
                title=doc["title"],
                section=heading.strip(),
                topic=doc["topic"],
                text=f"{doc['title']} - {heading.strip()}. {text}",
            ))
    return chunks
