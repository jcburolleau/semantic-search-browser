from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    SearchRequest,
    SearchResponse,
    SnippetsResponse,
)
from app.search import MODEL_ID, SearchIndex

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def parse_origins() -> list[str]:
    extra = os.getenv("ALLOWED_ORIGINS", "")
    origins = list(DEFAULT_ORIGINS)
    for part in extra.split(","):
        origin = part.strip()
        if origin and origin not in origins:
            origins.append(origin)
    return origins


app = FastAPI(
    title="Semantic Search API",
    description="Pydantic-typed search over AG News snippets with MiniLM embeddings.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

index = SearchIndex()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model=MODEL_ID,
        snippet_count=len(index.snippets),
        dataset_version=index.version,
        source=index.source,
    )


@app.get("/snippets", response_model=SnippetsResponse)
def snippets() -> SnippetsResponse:
    return SnippetsResponse(
        version=index.version,
        source=index.source,
        snippets=index.snippets,
    )


@app.post("/search", response_model=SearchResponse)
def search(body: SearchRequest) -> SearchResponse:
    if body.mode == "keyword":
        results = index.search_keyword(body.query, body.top_k)
    else:
        results = index.search_semantic(body.query, body.top_k)
    return SearchResponse(query=body.query, mode=body.mode, results=results)


@app.post("/embed", response_model=EmbedResponse)
def embed(body: EmbedRequest) -> EmbedResponse:
    vector = index.embed(body.text)
    return EmbedResponse(embedding=vector, dim=len(vector), model=MODEL_ID)
