# Rerankers API

Cohere-compatible reranking. Configure a reranker in Console, then call it
with a query + candidate documents.

## Methods

```typescript
const rerankers = await client.rerankers.list();
const reranker = await client.rerankers.get('default');

const result = await client.rerankers.run('default', {
  query: 'best espresso machine for beginners',
  documents: [
    'Breville Bambino Plus — compact and forgiving.',
    'La Marzocco Linea Mini — top-tier prosumer.',
    { id: 'doc-3', text: 'Gaggia Classic Pro — modder friendly.' },
  ],
  top_n: 2,
});

for (const r of result.results) {
  console.log(r.relevance_score, r.document.text);
}
```

## Types

```typescript
interface RerankerRunRequest {
  query: string;
  documents: Array<string | RerankerDocumentInput>;
  top_n?: number;   // Cohere-style
  topN?: number;    // alias
}

interface RerankerDocumentInput {
  id?: string;
  content?: string;
  text?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

interface RerankerRunResponse {
  id: string;
  results: Array<{
    index: number;
    relevance_score: number;
    document: { text: string };
  }>;
  meta?: {
    api_version?: { version?: string };
    reranker?: string;
    strategy?: string;
    model?: string;
    latency_ms?: number;
  };
}
```
