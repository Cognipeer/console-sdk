# Memory API

Use memory stores to persist scoped facts, preferences, and conversation context with semantic retrieval.

## Overview

The SDK exposes memory operations through `client.memory`.

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });
```

Memory data is stored inside a named store and segmented by `scope` + `scopeId`.

- `scope='user'` + `scopeId='user_123'` for user-specific memory
- `scope='agent'` + `scopeId='sales-assistant'` for agent-specific memory
- `scope='session'` + `scopeId='conversation_42'` for conversation memory
- `scope='global'` for shared memory across contexts

## Create a Store

```typescript
const store = await client.memory.stores.create({
  name: 'Support Memory',
  vectorProviderKey: 'pinecone-main',
  embeddingModelKey: 'text-embedding-3-small',
});
```

## Add Memory

```typescript
await client.memory.add(store.key, {
  content: 'User prefers concise billing explanations.',
  scope: 'user',
  scopeId: 'user_123',
  tags: ['billing', 'preferences'],
  source: 'manual',
  importance: 0.8,
});
```

## List Memory

```typescript
const items = await client.memory.list(store.key, {
  scope: 'user',
  scopeId: 'user_123',
  limit: 20,
});
```

## Search Memory

```typescript
const search = await client.memory.search(store.key, {
  query: 'How should I respond to this user?',
  scope: 'user',
  scopeId: 'user_123',
  topK: 5,
});
```

## Recall Context

```typescript
const recall = await client.memory.recall(store.key, {
  query: 'What should I remember before answering?',
  scope: 'user',
  scopeId: 'user_123',
  topK: 5,
  maxTokens: 800,
});

console.log(recall.context);
```

## Delete by Context

```typescript
await client.memory.deleteBulk(store.key, {
  scope: 'session',
  scopeId: 'conversation_42',
});
```

## API Surface

- `client.memory.stores.list(options?)`
- `client.memory.stores.create(data)`
- `client.memory.stores.get(storeKey)`
- `client.memory.stores.update(storeKey, data)`
- `client.memory.stores.delete(storeKey)`
- `client.memory.add(storeKey, data)`
- `client.memory.addBatch(storeKey, memories)`
- `client.memory.list(storeKey, options?)`
- `client.memory.get(storeKey, memoryId)`
- `client.memory.update(storeKey, memoryId, data)`
- `client.memory.delete(storeKey, memoryId)`
- `client.memory.deleteBulk(storeKey, filter?)`
- `client.memory.search(storeKey, request)`
- `client.memory.recall(storeKey, request)`