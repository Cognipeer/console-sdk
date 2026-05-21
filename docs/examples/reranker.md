# Reranker Example

Run a Cohere-compatible reranker against a small candidate set.

## Run the example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com  # optional
export COGNIPEER_RERANKER_KEY=default-reranker
npm run example:reranker
```

The first time you run it without `COGNIPEER_RERANKER_KEY`, the script prints
the configured rerankers so you can pick one.

## Code

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const result = await client.rerankers.run(process.env.COGNIPEER_RERANKER_KEY!, {
  query: 'best espresso machine for beginners',
  documents: [
    'Breville Bambino Plus — compact and forgiving.',
    'La Marzocco Linea Mini — top-tier prosumer espresso.',
    { id: 'doc-3', text: 'Gaggia Classic Pro — modder friendly entry point.' },
    'Random unrelated text about cats.',
  ],
  top_n: 3,
});

for (const r of result.results) {
  console.log(r.relevance_score.toFixed(4), r.document.text);
}
```

## Notes

- Pass documents as plain strings (compact form) or as `{ id, text, score?, metadata? }` objects.
- The response mirrors Cohere's `/v2/rerank`: `id`, `results[]` (with `index`, `relevance_score`, `document.text`), and a `meta` object including `latency_ms`, `strategy`, and the underlying `model`.
