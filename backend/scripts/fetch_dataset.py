#!/usr/bin/env python3
"""Pull a small AG News sample from the Hugging Face datasets server.

Writes data/data.json (repo root or backend/data depending on --out).
"""

from __future__ import annotations

import argparse
import html
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

DATASET = "fancyzhx/ag_news"
LABELS = {0: "World", 1: "Sports", 2: "Business", 3: "Sci/Tech"}
OFFSETS = (0, 5000, 20000, 40000)
PER_LABEL = 25


def fetch_rows(offset: int, length: int = 100) -> list[dict]:
    url = (
        "https://datasets-server.huggingface.co/rows"
        f"?dataset={DATASET}&config=default&split=train"
        f"&offset={offset}&length={length}"
    )
    with urllib.request.urlopen(url) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("rows", [])


def curate(rows: list[dict]) -> list[dict]:
    by_label: dict[str, list[str]] = defaultdict(list)
    for item in rows:
        row = item["row"]
        label = LABELS[int(row["label"])]
        text = html.unescape(" ".join(str(row["text"]).replace("#39;", "'").split()))
        text = text.replace("\\$", "$")
        if len(text) < 50:
            continue
        by_label[label].append(text[:420])

    snippets: list[dict] = []
    sid = 0
    for label in LABELS.values():
        seen: set[str] = set()
        count = 0
        for text in by_label[label]:
            key = text[:90].lower()
            if key in seen:
                continue
            seen.add(key)
            snippets.append({"id": str(sid), "text": text, "label": label})
            sid += 1
            count += 1
            if count >= PER_LABEL:
                break
    return snippets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "data.json",
    )
    args = parser.parse_args()

    rows: list[dict] = []
    for offset in OFFSETS:
        rows.extend(fetch_rows(offset))

    snippets = curate(rows)
    payload = {
        "version": "1",
        "source": DATASET,
        "model_hint": "Xenova/all-MiniLM-L6-v2",
        "snippets": snippets,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(snippets)} snippets to {args.out}")


if __name__ == "__main__":
    main()
