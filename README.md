# Semantic Search Browser

Hybrid portfolio demo: **semantic search in the browser** with Transformers.js, plus the same contract on **FastAPI + Pydantic**.

- Frontend: Vue 3 + Vite + TypeScript, `Xenova/all-MiniLM-L6-v2`, mean pooling, L2-normalized vectors, cosine via dot product.
- Backend: FastAPI, Pydantic v2, `sentence-transformers/all-MiniLM-L6-v2`.
- Corpus: 400 headlines from [`fancyzhx/ag_news`](https://huggingface.co/datasets/fancyzhx/ag_news) (100 per topic: World / Sports / Business / Sci/Tech).

## Why the scores work

The embedding pipeline uses `pooling: "mean"` and `normalize: true`. After L2-normalization, **dot product = cosine similarity**. Keyword mode is a simple `includes` baseline so you can see where lexical match fails and meaning still ranks.

Embeddings computed in the browser are cached in `localStorage` keyed by dataset version + model id.

## Local run

```bash
# frontend
cd frontend
npm install
npm run dev

# backend (from repo root)
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Python 3.11+ is required (`sentence-transformers` / current NumPy). Docker uses 3.11.

Frontend expects `VITE_API_URL=http://localhost:8000` (see `frontend/.env.example`).

Refresh the dataset from Hugging Face:

```bash
python backend/scripts/fetch_dataset.py --out data/data.json
cp data/data.json frontend/public/data.json
cp data/data.json backend/data/data.json
```

## Deploy

This machine did not have `gh` or Netlify CLI sessions. After `gh auth login` and `npx netlify login`:

```bash
gh repo create semantic-search-browser --public --source=. --remote=origin --push
npx netlify init   # build: frontend, publish: dist (see netlify.toml)
# Set VITE_API_URL to the Render service URL, then redeploy the frontend.
```

**Render:** New Web Service → this GitHub repo → Docker, root `backend/`, health `/health`. Set `ALLOWED_ORIGINS` to `https://<site>.netlify.app`. Or apply the root `render.yaml` Blueprint.

Cold start on the free API tier downloads MiniLM once; the instance may sleep.

## API

| Method | Path | Body |
|--------|------|------|
| GET | `/health` | |
| GET | `/snippets` | |
| POST | `/search` | `{ query, top_k?, mode: "semantic" \| "keyword" }` |
| POST | `/embed` | `{ text }` |
