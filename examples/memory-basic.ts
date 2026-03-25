import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  const baseURL = process.env.COGNIPEER_BASE_URL;

  if (!apiKey) {
    throw new Error('COGNIPEER_API_KEY is required');
  }

  const vectorProviderKey = process.env.COGNIPEER_VECTOR_PROVIDER_KEY || 'pinecone-main';
  const embeddingModelKey = process.env.COGNIPEER_EMBEDDING_MODEL_KEY || 'text-embedding-3-small';
  const timestamp = Date.now().toString(36);
  const userId = `demo-user-${timestamp}`;
  const conversationId = `conversation-${timestamp}`;

  const client = new ConsoleClient({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  const store = await client.memory.stores.create({
    name: `SDK Memory Demo ${timestamp}`,
    description: 'Created from the console-sdk memory example.',
    vectorProviderKey,
    embeddingModelKey,
  });

  console.log('Created store:', store.key);

  await client.memory.add(store.key, {
    content: 'User prefers concise responses and billing examples.',
    scope: 'user',
    scopeId: userId,
    tags: ['preferences', 'billing'],
    source: 'manual',
    importance: 0.9,
  });

  await client.memory.add(store.key, {
    content: 'The current conversation is about invoice reconciliation.',
    scope: 'session',
    scopeId: conversationId,
    tags: ['conversation', 'invoice'],
    source: 'manual',
    importance: 0.7,
  });

  const listed = await client.memory.list(store.key, {
    scope: 'user',
    scopeId: userId,
    limit: 10,
  });

  console.log('Listed memories:', listed.total);

  const search = await client.memory.search(store.key, {
    query: 'How should I answer this user?',
    scope: 'user',
    scopeId: userId,
    topK: 5,
  });

  console.log('Search hits:', search.memories.length);

  const recall = await client.memory.recall(store.key, {
    query: 'What should I remember before responding?',
    scope: 'user',
    scopeId: userId,
    topK: 5,
    maxTokens: 500,
  });

  console.log('Recall context:\n', recall.context);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});