# TactiQ - Review 2 (PBL-2) slide content

Five minutes in total: about 1.5 minutes per main slide. Paste each slide into the Review-1 template.
Numbers come from the real system (`tactiq-api/eval/output/`). Re-run the evaluations before the review if
the knowledge base changes.

---

## Slide 0 - Comments from Review 1 (template requirement)

| Comment from Review 1 | What we changed |
|---|---|
| _(fill in the comment)_ | _(fill in the action taken)_ |
| _(fill in the comment)_ | _(fill in the action taken)_ |

---

## Slide 1 - Why ML -> DL -> NLP -> Transformer -> GenAI  (10 marks)

**Problem:** players ask open-ended questions ("I get tired in the third game - what should I train?").
The answer must be written in natural language, grounded in reliable badminton knowledge, and personalised
to the player's own data. Rule-based systems or classifiers cannot write such answers, so a generative
model is needed. But a plain chatbot gives vague advice that may be unsafe.

| Layer | Used in TactiQ for | Why this choice |
|---|---|---|
| **ML** | TF-IDF + cosine similarity (scikit-learn) baseline retrieval; sports-science metrics (session-RPE load, acute:chronic workload ratio) | Fast, explainable baseline to measure against |
| **DL** | Neural sentence embeddings (all-MiniLM-L6-v2, 384-dim) | Captures *meaning*, not just shared words |
| **NLP** | Heading-based chunking, semantic search, conversation summarisation, citation extraction | Turns documents and chats into usable context |
| **Transformer** | MiniLM encoder for retrieval + Gemini decoder LLM for generation | Encoder for understanding, decoder for writing |
| **GenAI (RAG)** | Grounded answers with citations + structured 7-day plans (JSON) | Generation that stays tied to evidence |

**Why RAG instead of fine-tuning:** small curated knowledge base (19 documents, 91 chunks); it can be updated
without retraining; answers cite their sources; no GPU or training data needed; fewer hallucinations.

**Evidence: retrieval on 44 labelled player questions**

| Retriever | Hit@1 | Hit@3 | MRR@5 |
|---|---|---|---|
| TF-IDF (ML baseline) | 77% | 91% | 0.837 |
| **MiniLM Transformer (used)** | **82%** | **93%** | **0.880** |
| Hybrid TF-IDF + MiniLM (tested) | 73% | 93% | 0.820 |

- The Transformer understands paraphrases: for "I get nervous before matches" and "how do I come back to
  playing after being injured", TF-IDF did not find the right passage in its top 5; MiniLM ranked it **#1**.
- Hybrid fusion did not improve results, so we kept the simpler single retriever (decision based on data).

> Speaker note (about 90 s): problem -> why generation -> each layer in one line -> RAG vs fine-tuning ->
> the table proves the Transformer choice with our own data.

---

## Slide 2 - Generated content and analysis linked with objectives + pipeline  (5 marks)

**Pipeline diagram:** insert `pipeline.svg` (refined version of the Review-1 diagram).

| Objective (from problem statement) | What TactiQ generates | How we measured it |
|---|---|---|
| AI badminton coach for training, technique, nutrition, recovery | Chat answers with numbered citations [1][2] to the knowledge base | Retrieval Hit@3 = 93%; citations per answer: _[from prompt_comparison]_ |
| Personalised training plans from profile + logged stats | 7-day plan (JSON schema) adjusted to level, goal, injury, recent load | Plan always passes schema validation; lighter week when ACWR > 1.5 or wellness is low |
| RAG over a curated badminton knowledge base | 19 documents from open-access research and federation material | Every answer lists the passages it used |
| Progress tracking of sessions, matches, trends | Dashboard: win rate, weekly session-RPE load, ACWR, wellness score, points won/lost | Computed from the player's own logs; 36 automated tests |
| Safety guardrails + physio/doctor referral | Referral or emergency notice added by code before the answer | Red-flag recall 100%, precision 100% on 26 labelled messages (first version: 86% recall - evaluation found 2 gaps, now fixed) |
| Conversation memory | Follow-up questions use earlier context (summary + last 6 messages) | Tested: "and for doubles?" retrieves using the previous question |

**Example (demo player: intermediate, vegetarian, recovering right knee, load spike this week):**
_[paste one short generated answer from `eval/output/prompt_comparison.md`, use case "Personalised training load"]_

> Speaker note (about 90 s): walk the diagram left to right, then show one objective -> output -> metric row
> and the example answer that mentions the player's own load and knee.

---

## Slide 3 - Prompt engineering on use-case scenarios  (5 marks)

| Technique | Where it is used | Use-case scenario |
|---|---|---|
| Role / persona | System prompt: "TactiQ Coach, badminton coach and sports-science educator" | All chat answers |
| Explicit rules + output format | Short answer first, bullet steps, under 250 words, simple English | All chat answers |
| Context grounding + citations | Numbered knowledge passages; "cite [n]; say so if not covered" | "How do I improve my rear-court footwork?" |
| Personalisation by injecting data | Player context block: profile, 14-day load, ACWR, wellness, matches | "Should I train harder this week?" |
| Safety constraints by risk level | none / caution / refer / urgent instructions | "My knee popped and is swollen" |
| Conversation memory | Rolling summary + recent turns in the prompt | Follow-up: "and for doubles?" |
| Few-shot example | One example plan day in the plan prompt | Weekly plan generation |
| Structured output (JSON schema) | Pydantic schema passed to Gemini | 7-day plan rendered as cards |
| Summarisation prompt | Compresses older chat into a 120-word memory | Long conversations |

**Zero-shot vs engineered prompt (same 5 questions, demo player):** _[fill in from
`eval/output/prompt_comparison.md` after running `python -m eval.prompt_compare`]_

| Use case | Citations (zero-shot / ours) | Uses player's own data (zero-shot / ours) |
|---|---|---|
| Technique | | |
| Nutrition | | |
| Training load | | |
| Injury-aware | | |
| Safety referral | | |

> Speaker note (about 90 s): show the table, then read one pair of answers aloud - the zero-shot answer is
> generic; ours mentions the player's vegetarian diet / knee / load and cites sources.

---

### Q&A preparation
- **Is the LLM making decisions?** No. TactiQ is a fixed pipeline: the steps always run in the same order,
  the safety check is deterministic code, and the LLM is called once only to write the final text. There
  are no tools, no loops and no autonomous actions.
- **Why Gemini?** Strong quality on the free tier; structured JSON output; the model is set in `.env`.
- **Why not fine-tune?** Too little data to fine-tune well; RAG is cheaper, updatable and can cite sources.
- **Is it medical advice?** No. The guardrail refers injuries to a physiotherapist or doctor, and the app
  shows a disclaimer.
- **How is data protected?** bcrypt password hashing, JWT sessions, every database query is filtered by user.
- **Limitations:** the knowledge base is small and needs expert review; the safety rules are keyword-based
  (they can miss unusual wording); the metrics are self-reported.
