# TactiQ curated badminton knowledge base

This folder is the **retrieval corpus** for TactiQ's RAG pipeline. Every `.md` file except this README is
ingested by `python -m app.rag.ingest`.

## Format
Each document starts with front-matter:

```
---
id: footwork-fundamentals          # stable id used in citations and eval labels
title: Footwork fundamentals
topic: technique                   # technique | tactics | training | injury | nutrition | recovery
sources:
  - <title, organisation/journal, year, URL if available>
---
```

The body is split into chunks at every `## ` heading. Keep each section focused on **one idea**
(about 50–200 words) so retrieval returns precise context.

## Provenance and review
- All text is written in our own words as **summaries** of the listed open-access / freely available sources.
  No source text is copied. BWF Shuttle Time material is cited, not redistributed.
- Content is general education for amateur and college players. It is **not medical advice**; the injury
  documents always point to a physiotherapist/doctor for diagnosis.
- **Team action:** before the final submission, each member should review the documents in their area
  against the cited sources and correct anything that is wrong or unclear.

## Adding a document
1. Create `kb/<id>.md` with the front-matter above.
2. Run `python -m app.rag.ingest` to rebuild the index.
3. Add 1–2 labelled questions for it to `eval/retrieval_questions.jsonl`.
