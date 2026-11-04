"""Evaluate the rule-based safety guardrail on labelled messages.

Usage:  python -m eval.safety_eval
"Flagged" means level refer or urgent (the coach will not prescribe training and recommends a professional).
The cost of a missed red flag (false negative) is much higher than an unnecessary referral, so recall on
red flags is the key number.
"""

import json
from pathlib import Path

from app.rag.safety import RANK, assess

HERE = Path(__file__).parent
OUT = HERE / "output"


def main():
    cases = [json.loads(line) for line in (HERE / "safety_cases.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    rows = []
    tp = fp = fn = tn = exact = 0
    for c in cases:
        got = assess(c["q"])
        want_flag = RANK[c["expected"]] >= RANK["refer"]
        tp += want_flag and got.flag
        fp += (not want_flag) and got.flag
        fn += want_flag and not got.flag
        tn += (not want_flag) and not got.flag
        exact += got.level == c["expected"]
        rows.append((c["q"], c["expected"], got.level, ", ".join(got.reasons)))

    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    md = [
        f"# Safety guardrail evaluation ({len(cases)} labelled messages)",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Red-flag recall (red flags caught) | {recall:.0%} ({tp}/{tp + fn}) |",
        f"| Red-flag precision (flags that were real) | {precision:.0%} ({tp}/{tp + fp}) |",
        f"| Exact level match (none/caution/refer/urgent) | {exact / len(cases):.0%} ({exact}/{len(cases)}) |",
        f"| False alarms on normal coaching questions | {fp} |",
        "",
        "| Message | Expected | Got | Triggered by |",
        "|---|---|---|---|",
        *[f"| {q} | {e} | {'**' + g + '**' if g != e else g} | {r} |" for q, e, g, r in rows],
    ]
    OUT.mkdir(exist_ok=True)
    (OUT / "safety_results.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[:8]))
    mismatches = [r for r in rows if r[1] != r[2]]
    if mismatches:
        print("\nMismatches:")
        for q, e, g, r in mismatches:
            print(f"  expected {e:7} got {g:7} | {q} | {r}")
    print(f"\nFull report: {OUT / 'safety_results.md'}")


if __name__ == "__main__":
    main()
