from typing import Literal

from pydantic import BaseModel, Field

SearchMode = Literal["semantic", "keyword"]


class HealthResponse(BaseModel):
    status: str
    model: str
    snippet_count: int
    dataset_version: str
    source: str


class Snippet(BaseModel):
    id: str
    text: str
    label: str


class SnippetsResponse(BaseModel):
    version: str
    source: str
    snippets: list[Snippet]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)
    mode: SearchMode = "semantic"


class SearchHit(BaseModel):
    id: str
    text: str
    label: str
    score: float


class SearchResponse(BaseModel):
    query: str
    mode: SearchMode
    results: list[SearchHit]


class EmbedRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class EmbedResponse(BaseModel):
    embedding: list[float]
    dim: int
    model: str
