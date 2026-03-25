# Memory Example

This example shows a simple memory workflow: create a store, write scoped memories, search them, and build a recall block for downstream chat.

## Run the Example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com/api/client/v1
export COGNIPEER_VECTOR_PROVIDER_KEY=pinecone-main
export COGNIPEER_EMBEDDING_MODEL_KEY=text-embedding-3-small
npm run example:memory
```

## Example Code

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const store = await client.memory.stores.create({
  name: 'Support Memory',
  vectorProviderKey: process.env.COGNIPEER_VECTOR_PROVIDER_KEY!,
  embeddingModelKey: process.env.COGNIPEER_EMBEDDING_MODEL_KEY!,
});

await client.memory.add(store.key, {
  content: 'User prefers concise responses.',
  scope: 'user',
  scopeId: 'user_123',
  source: 'manual',
});

const recall = await client.memory.recall(store.key, {
  query: 'What should I remember before answering?',
  scope: 'user',
  scopeId: 'user_123',
});

console.log(recall.context);
```

## When to Use Which Scope

- `user`: long-lived user preferences and facts
- `agent`: reusable working knowledge for a single agent
- `session`: conversation-local state
- `global`: shared information not tied to a single actor