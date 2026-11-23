from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

from app.models import SearchHit, Snippet

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "data.json"
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"


class SearchIndex:
    def __init__(self) -> None:
        payload = json.loads(DATA_PATH.read_text())
        self.version: str = payload["version"]
        self.source: str = payload["source"]
        self.snippets: list[Snippet] = [Snippet.model_validate(s) for s in payload["snippets"]]
        self.model = SentenceTransformer(MODEL_ID)
        texts = [s.text for s in self.snippets]
        matrix = self.model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        self.embeddings: np.ndarray = np.asarray(matrix, dtype=np.float32)

    def embed(self, text: str) -> list[float]:
        vec = self.model.encode(
            [text],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )[0]
        return vec.astype(float).tolist()

    def search_semantic(self, query: str, top_k: int) -> list[SearchHit]:
        q = np.asarray(self.embed(query), dtype=np.float32)
        scores = self.embeddings @ q
        k = min(top_k, len(self.snippets))
        idxs = np.argpartition(-scores, kth=k - 1)[:k]
        idxs = idxs[np.argsort(-scores[idxs])]
        hits: list[SearchHit] = []
        for i in idxs:
            snippet = self.snippets[int(i)]
            hits.append(
                SearchHit(
                    id=snippet.id,
                    text=snippet.text,
                    label=snippet.label,
                    score=float(scores[int(i)]),
                )
            )
        return hits

    def search_keyword(self, query: str, top_k: int) -> list[SearchHit]:
        terms = [t for t in query.lower().split() if t]
        if not terms:
            return []
        scored: list[SearchHit] = []
        for snippet in self.snippets:
            hay = snippet.text.lower()
            hits = sum(1 for t in terms if t in hay)
            if hits == 0:
                continue
            scored.append(
                SearchHit(
                    id=snippet.id,
                    text=snippet.text,
                    label=snippet.label,
                    score=hits / len(terms),
                )
            )
        scored.sort(key=lambda h: h.score, reverse=True)
        return scored[:top_k]
