# Streaming Tracing Example

Open a tracing session, append events as they happen, then close it. This
matches the lifecycle of long-running agents where you don't have a full
session payload up front.

## Run the example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com  # optional
npm run example:tracing-stream
```

## Code

```typescript
import { randomUUID } from 'node:crypto';
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const sessionId = `sess_${randomUUID()}`;
const startedAt = new Date();

await client.tracing.startStream(sessionId, {
  agent: { name: 'streaming-demo', model: 'gpt-4o-mini', version: '1.0.0' },
  threadId: 'thread_demo',
  startedAt: startedAt.toISOString(),
});

await client.tracing.appendEvent(sessionId, {
  type: 'llm_end',
  label: 'Final response',
  sequence: 1,
  timestamp: new Date().toISOString(),
  status: 'success',
  inputTokens: 120,
  outputTokens: 80,
  model: 'gpt-4o-mini',
  actor: { scope: 'agent', name: 'streaming-demo', role: 'assistant' },
});

const endedAt = new Date();
await client.tracing.endStream(sessionId, {
  status: 'success',
  endedAt: endedAt.toISOString(),
  durationMs: endedAt.getTime() - startedAt.getTime(),
});
```

## Notes

- `startStream` is idempotent — calling it again with the same `sessionId` reuses the row.
- Each `appendEvent` returns `{ totalEvents }`, so you can surface progress in your UI.
- `endStream` accepts an optional `summary` / `errors` block that's merged with the live aggregates computed from the events you streamed in.
- Need to push spans from an existing OTLP pipeline instead? Use `client.tracing.ingestOtlp(payload)` with an `ExportTraceServiceRequest` payload.
