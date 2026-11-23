import type { HealthResponse, SearchHit, SearchMode } from "./types";

const baseUrl = () =>
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl()}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json() as Promise<HealthResponse>;
}

export async function searchRemote(
  query: string,
  mode: SearchMode,
  topK = 5,
): Promise<SearchHit[]> {
  const res = await fetch(`${baseUrl()}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, mode, top_k: topK }),
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as { results: SearchHit[] };
  return data.results;
}

export async function embedRemote(text: string): Promise<number[]> {
  const res = await fetch(`${baseUrl()}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Embed failed (${res.status})`);
  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}
