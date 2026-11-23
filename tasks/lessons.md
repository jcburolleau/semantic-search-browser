# Lessons

- Transformers.js in Vite needs `worker.format = 'es'` and `optimizeDeps.exclude` for `@huggingface/transformers`.
- Normalized MiniLM vectors: rank with dot product, do not add a separate cosine implementation.
- Render free images should install CPU torch via the PyTorch CPU index to stay small enough to boot.
