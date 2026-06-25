# Batches API

Run large sets of chat-completion or embedding requests asynchronously. The Batch API is OpenAI-compatible: you submit many requests together (inline or as a JSONL file), the console executes them in the background, and you read per-line results when the batch finishes.

## Overview

Batch operations are exposed through `client.batches`.

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });
```

## Create a batch

Submit requests inline with `requests`, or point at a JSONL file already uploaded to a Document Store bucket with `input_file`.

```typescript
const batch = await client.batches.create({
  endpoint: '/v1/chat/completions',
  requests: [
    { custom_id: 'q1', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }] } },
    { custom_id: 'q2', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello' }] } },
  ],
});

console.log(batch.id, batch.status); // 'validating' | 'in_progress' | ...
```

## Poll until complete

```typescript
let status = await client.batches.retrieve(batch.id);
while (status.status === 'in_progress' || status.status === 'validating') {
  await new Promise((r) => setTimeout(r, 2000));
  status = await client.batches.retrieve(batch.id);
}
```

`retrieve()` returns the batch with its `status`, request counts, and usage totals.

## Read results

```typescript
// Parsed OpenAI-format output objects (one per line):
const lines = await client.batches.results(batch.id);
for (const line of lines) {
  console.log(line.custom_id, line.response?.body);
}

// Or the raw JSONL document:
const jsonl = await client.batches.resultsRaw(batch.id);
```

## Inspect individual lines

```typescript
const items = await client.batches.items(batch.id, { limit: 100 });
for (const item of items) {
  console.log(item.custom_id, item.status); // per-line status
}
```

## List & cancel

```typescript
const batches = await client.batches.list({ limit: 20 });

// Request cancellation — pending lines are skipped; running lines finish.
await client.batches.cancel(batch.id);
```

## Methods

| Method | HTTP | Description |
| --- | --- | --- |
| `batches.create(data)` | `POST /api/client/v1/batches` | Create and start a batch |
| `batches.list(query?)` | `GET /api/client/v1/batches` | List batches |
| `batches.retrieve(id)` | `GET /api/client/v1/batches/:id` | Status + counts + usage |
| `batches.cancel(id)` | `POST /api/client/v1/batches/:id/cancel` | Request cancellation |
| `batches.items(id, query?)` | `GET /api/client/v1/batches/:id/items` | Per-line status |
| `batches.results(id)` | `GET /api/client/v1/batches/:id/results` | Parsed output lines |
| `batches.resultsRaw(id)` | `GET /api/client/v1/batches/:id/results` | Raw output JSONL |
