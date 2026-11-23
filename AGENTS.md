## Learned User Preferences

- Prefer a hybrid portfolio layout: Vue + Transformers.js in the browser and a FastAPI + Pydantic API in the same repo, not browser-only.
- GitHub commits for this repo should use `juanburolleau95@gmail.com`, not a work email. Do not change git config unless asked; rewrite/push only when requested.
- Do not commit unless explicitly asked (dataset or deploy follow-ups may stay uncommitted).

## Learned Workspace Facts

- Monorepo: `frontend/` is Vue 3 + Vite + TypeScript (Netlify `base = frontend`); `backend/` is FastAPI + Pydantic + `sentence-transformers` (Render Docker, health `/health`).
- Client embeddings: `@huggingface/transformers` in a Web Worker, `Xenova/all-MiniLM-L6-v2`, mean pooling, L2-normalize; Vite needs `worker.format = 'es'` and `optimizeDeps.exclude` for that package.
- Server embeddings: `sentence-transformers/all-MiniLM-L6-v2`; CORS via `ALLOWED_ORIGINS` plus localhost:5173; frontend uses `VITE_API_URL`.
- Corpus is Hugging Face `fancyzhx/ag_news` (~400 headlines, 100 per World/Sports/Business/Sci/Tech) in `data/data.json`, copied to `frontend/public/` and `backend/data/`; bump `version` when regenerating so `localStorage` cache invalidates.
- Browser corpus size is bounded by Transformers.js WASM embed time and `localStorage` (~400–800 comfortable); larger search should use the API or precomputed vectors, not more in-tab embedding.
- Scaffold with `create-vue` (`npm create vue@latest` / `npx create-vue@latest`), not `npx vue-app@latest`.
