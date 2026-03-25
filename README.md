# Cognipeer Console SDK

Official TypeScript/JavaScript SDK for [Cognipeer Console](https://cognipeer.com) - A multi-tenant SaaS platform for AI and Agentic services.

[![npm version](https://img.shields.io/npm/v/@cognipeer/console-sdk)](https://www.npmjs.com/package/@cognipeer/console-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🤖 **Chat Completions** - OpenAI-compatible chat API with streaming support
- 📊 **Embeddings** - Text vectorization for semantic search
- 🗄️ **Vector Operations** - Manage vector databases (Pinecone, Chroma, Qdrant, etc.)
- 📁 **File Management** - Upload and manage files with markdown conversion
- 🔍 **Agent Tracing** - Observability for agent executions
- 🧠 **Memory Stores** - Persist, search, and recall scoped memories
- 🌐 **OpenTelemetry Exporter** - Send OTel spans directly to Cognipeer OTLP endpoint
- 🛡️ **Guardrails** - Evaluate content with tenant guardrail policies
- 🔒 **Type-Safe** - Full TypeScript support with comprehensive types
- ⚡ **Modern** - ESM and CommonJS support, works in Node.js and browsers

## Installation

```bash
npm install @cognipeer/console-sdk
```

```bash
yarn add @cognipeer/console-sdk
```

```bash
pnpm add @cognipeer/console-sdk
```

## Quick Start

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

// Initialize the client
const client = new ConsoleClient({
  apiKey: 'your-api-key',
  baseURL: 'https://your-console.example.com/api/client/v1', // Optional, defaults to production
});

// Chat completion
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(response.choices[0].message.content);

// Streaming chat
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}

// Create embeddings
const embeddings = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Hello, world!',
});

console.log(embeddings.data[0].embedding);

// Vector operations
await client.vectors.upsert('my-provider', 'my-index', {
  vectors: [
    {
      id: 'vec1',
      values: [0.1, 0.2, 0.3],
      metadata: { text: 'Hello world' },
    },
  ],
});

const results = await client.vectors.query('my-provider', 'my-index', {
  query: {
    vector: [0.1, 0.2, 0.3],
    topK: 5,
  },
});

// File upload
const file = await client.files.upload('my-bucket', {
  fileName: 'document.pdf',
  data: 'data:application/pdf;base64,JVBERi0xLjQK...',
  convertToMarkdown: true,
});

// Memory
const store = await client.memory.stores.create({
  name: 'Support Memory',
  vectorProviderKey: 'pinecone-main',
  embeddingModelKey: 'text-embedding-3-small',
});

await client.memory.add(store.key, {
  content: 'User prefers concise billing explanations.',
  scope: 'user',
  scopeId: 'user_123',
  tags: ['billing', 'preferences'],
  source: 'manual',
});

const recall = await client.memory.recall(store.key, {
  query: 'user communication preferences',
  scope: 'user',
  scopeId: 'user_123',
});

console.log(recall.context);
```

## Documentation

Full documentation is available at [cognipeer.github.io/console-sdk](https://cognipeer.github.io/console-sdk)

If you need the platform itself, deployment guidance, tenant architecture, provider setup, or raw HTTP API semantics, use the [Cognipeer Console docs](https://cognipeer.github.io/cognipeer-console/).

- [Getting Started](https://cognipeer.github.io/console-sdk/guide/getting-started)
- [Working with Console](https://cognipeer.github.io/console-sdk/guide/working-with-console)
- [Console API Mapping](https://cognipeer.github.io/console-sdk/api/console-mapping)
- [Chat API](https://cognipeer.github.io/console-sdk/api/chat)
- [Embeddings API](https://cognipeer.github.io/console-sdk/api/embeddings)
- [Guardrails API](https://cognipeer.github.io/console-sdk/api/guardrails)
- [Memory API](https://cognipeer.github.io/console-sdk/api/memory)
- [Vector API](https://cognipeer.github.io/console-sdk/api/vectors)
- [Files API](https://cognipeer.github.io/console-sdk/api/files)
- [Tracing API](https://cognipeer.github.io/console-sdk/api/tracing)
- [Examples](https://cognipeer.github.io/console-sdk/examples/)

## API Reference

### Client Configuration

```typescript
const client = new ConsoleClient({
  apiKey: string;          // Required: Your API token
  baseURL?: string;        // Optional: API base URL (default: https://api.cognipeer.com/api/client/v1)
  timeout?: number;        // Optional: Request timeout in ms (default: 60000)
  maxRetries?: number;     // Optional: Max retry attempts (default: 3)
  fetch?: typeof fetch;    // Optional: Custom fetch implementation
});
```

### Available Methods

#### Chat
- `client.chat.completions.create(params)` - Create chat completion (streaming supported)

#### Embeddings
- `client.embeddings.create(params)` - Create embeddings

#### Vectors
- `client.vectors.providers.list(query?)` - List vector providers
- `client.vectors.providers.create(data)` - Create vector provider
- `client.vectors.indexes.list(providerKey)` - List indexes
- `client.vectors.indexes.create(providerKey, data)` - Create index
- `client.vectors.indexes.get(providerKey, indexId)` - Get index details
- `client.vectors.indexes.update(providerKey, indexId, data)` - Update index
- `client.vectors.indexes.delete(providerKey, indexId)` - Delete index
- `client.vectors.upsert(providerKey, indexId, data)` - Upsert vectors
- `client.vectors.query(providerKey, indexId, query)` - Query vectors
- `client.vectors.delete(providerKey, indexId, ids)` - Delete vectors

#### Files
- `client.files.buckets.list()` - List buckets
- `client.files.buckets.get(bucketKey)` - Get bucket details
- `client.files.list(bucketKey, query?)` - List files
- `client.files.upload(bucketKey, data)` - Upload file

#### Prompts
- `client.prompts.list(query?)` - List prompt templates
- `client.prompts.get(key, options?)` - Get prompt (supports `version` / `environment`)
- `client.prompts.render(key, options?)` - Render prompt with data
- `client.prompts.listVersions(key)` - List version history
- `client.prompts.getDeployments(key)` - Get environment deployment states and history
- `client.prompts.deploy(key, options)` - Run `promote/plan/activate/rollback`
- `client.prompts.compare(key, fromVersionId, toVersionId)` - Compare two versions

#### Tracing
- `client.tracing.ingest(data)` - Ingest tracing session

#### Memory
- `client.memory.stores.list(query?)` - List memory stores
- `client.memory.stores.create(data)` - Create a memory store
- `client.memory.stores.get(storeKey)` - Get store details
- `client.memory.stores.update(storeKey, data)` - Update a memory store
- `client.memory.stores.delete(storeKey)` - Delete a memory store
- `client.memory.add(storeKey, data)` - Add a memory item
- `client.memory.addBatch(storeKey, memories)` - Add memory items in batch
- `client.memory.list(storeKey, query?)` - List memory items
- `client.memory.get(storeKey, memoryId)` - Get a memory item
- `client.memory.update(storeKey, memoryId, data)` - Update a memory item
- `client.memory.delete(storeKey, memoryId)` - Delete a memory item
- `client.memory.deleteBulk(storeKey, query?)` - Delete memory items by scope, scopeId, or tags
- `client.memory.search(storeKey, data)` - Semantic search within a store
- `client.memory.recall(storeKey, data)` - Build compact context from stored memories

### OpenTelemetry Integration

```typescript
import { CognipeerOTelSpanExporter } from '@cognipeer/console-sdk';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

const exporter = new CognipeerOTelSpanExporter({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL || 'https://api.cognipeer.com',
});

const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();
```

The exporter forwards spans to `/api/client/v1/traces` using OTLP/HTTP JSON.

#### Guardrails
- `client.guardrails.evaluate(data)` - Evaluate text against a guardrail

## Examples

Check out the [examples](./examples) directory for more detailed usage:

- [Chat with streaming](./examples/chat-streaming.ts)
- [RAG with vectors](./examples/rag-example.ts)
- [File processing](./examples/file-upload.ts)
- [Agent tracing](./examples/agent-tracing.ts)
- [Scoped memory](./examples/memory-basic.ts)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Cognipeer](https://cognipeer.com)

## Support

- 📧 Email: support@cognipeer.com
- 📖 Documentation: [cognipeer.github.io/console-sdk](https://cognipeer.github.io/console-sdk)
- 🐛 Issues: [GitHub Issues](https://github.com/Cognipeer/console-sdk/issues)
