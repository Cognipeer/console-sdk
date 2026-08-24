# Cognipeer Console SDK

Official TypeScript/JavaScript SDK for [Cognipeer Console](https://cognipeer.com) - A multi-tenant SaaS platform for AI and Agentic services.

[![npm version](https://img.shields.io/npm/v/@cognipeer/console-sdk)](https://www.npmjs.com/package/@cognipeer/console-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🤖 **Chat Completions** - OpenAI-compatible chat API with streaming support
- 📦 **Batch API** - OpenAI-compatible asynchronous bulk inference (chat + embeddings)
- 🚦 **Moderations** - OpenAI-compatible content moderation backed by guardrails
- 💰 **Spend & Budgets** - Cost reporting and enforced spend caps per tenant/token/model
- 🎧 **Realtime** - WebSocket streaming chat with optional voice round-trip (STT/TTS)
- 🧑‍✈️ **Agents** - Invoke Console-managed agents via the OpenAI Responses API
- 📊 **Embeddings** - Text vectorization for semantic search
- 🗄️ **Vector Operations** - Manage vector databases (Pinecone, Chroma, Qdrant, etc.)
- 📁 **File Management** - Upload, download, and manage files with markdown conversion + file providers
- 🎙️ **Audio** - OpenAI-compatible STT, translation, and TTS
- 📄 **OCR** - Document text extraction with layout/table/KV features
- 🕸️ **Crawler** - Scheduled and ad-hoc web crawling jobs
- ⚙️ **Automations** - Trigger and pause built-in scheduled jobs
- 🔀 **Rerankers** - Cohere-compatible reranking
- 🛰️ **MCP** - Talk to the built-in Console MCP server and tenant-configured MCP servers
- 🌐 **Browser Automation** - Manage browser profiles, drive live sessions, and expose per-browser MCP endpoints
- 🔍 **Agent Tracing** - Streaming + bulk ingest, OTLP/HTTP JSON, plus OpenTelemetry exporter
- 🧠 **Memory Stores** - Persist, search, and recall scoped memories
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
  baseURL: 'https://your-console.example.com', // Optional, defaults to https://console.cognipeer.com
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

Full documentation is available at [docs.cognipeer.com/console-sdk](https://docs.cognipeer.com/console-sdk)

If you need the platform itself, deployment guidance, tenant architecture, provider setup, or raw HTTP API semantics, use the [Cognipeer Console docs](https://docs.cognipeer.com/console/).

- [Getting Started](https://docs.cognipeer.com/console-sdk/guide/getting-started)
- [Working with Console](https://docs.cognipeer.com/console-sdk/guide/working-with-console)
- [Console API Mapping](https://docs.cognipeer.com/console-sdk/api/console-mapping)
- [Chat API](https://docs.cognipeer.com/console-sdk/api/chat)
- [Embeddings API](https://docs.cognipeer.com/console-sdk/api/embeddings)
- [Audio API](https://docs.cognipeer.com/console-sdk/api/audio)
- [OCR API](https://docs.cognipeer.com/console-sdk/api/ocr)
- [Crawler API](https://docs.cognipeer.com/console-sdk/api/crawler)
- [Automations API](https://docs.cognipeer.com/console-sdk/api/automations)
- [Rerankers API](https://docs.cognipeer.com/console-sdk/api/rerankers)
- [Web Search API](https://docs.cognipeer.com/console-sdk/api/web-search)
- [MCP API](https://docs.cognipeer.com/console-sdk/api/mcp)
- [Guardrails API](https://docs.cognipeer.com/console-sdk/api/guardrails)
- [Memory API](https://docs.cognipeer.com/console-sdk/api/memory)
- [Vector API](https://docs.cognipeer.com/console-sdk/api/vectors)
- [Files API](https://docs.cognipeer.com/console-sdk/api/files)
- [Tracing API](https://docs.cognipeer.com/console-sdk/api/tracing)
- [Examples](https://docs.cognipeer.com/console-sdk/examples/)

## API Reference

### Client Configuration

```typescript
const client = new ConsoleClient({
  apiKey: string;          // Required: Your API token
  baseURL?: string;        // Optional: API host root (default: https://console.cognipeer.com).
                            // Legacy URLs ending in /api/client/v1 are normalised automatically.
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

#### Batches
- `client.batches.create(data)` - Create a batch (inline `requests` or `input_file` JSONL in a bucket)
- `client.batches.list(query?)` - List batches
- `client.batches.retrieve(batchId)` - Batch status, request counts, and usage
- `client.batches.cancel(batchId)` - Cancel a batch (pending lines are skipped)
- `client.batches.items(batchId, query?)` - Per-request line status
- `client.batches.results(batchId)` - Finished lines as parsed OpenAI output objects
- `client.batches.resultsRaw(batchId)` - Raw output JSONL document

#### Moderations
- `client.moderations.create({ input, model? })` - Classify text against a moderation guardrail (OpenAI-compatible)

#### Spend & Budgets
- `client.spend.report(query?)` - Spend totals, per-model breakdown, timeseries
- `client.budgets.list()` - List budget policies
- `client.budgets.create(data)` - Create a spend cap (owner/admin token)
- `client.budgets.update(budgetId, data)` - Update limits/thresholds
- `client.budgets.delete(budgetId)` - Remove a budget policy
- `client.budgets.status(query?)` - Current usage vs limits per window

#### Realtime
- `client.realtime.models.list()` / `.create(data)` / `.retrieve(id)` / `.update(id, data)` / `.delete(id)` - Named realtime model presets (chat model or agent + STT + TTS; voice is optional and defaults to the provider voice)
- `client.realtime.connect({ model })` - Open a WebSocket session; `model` is a realtime model key or raw chat model key. Pass `{ agent }` instead to have a Console agent generate the responses. The generator is fixed once the conversation starts
- `client.realtime.twilioStreamUrl(modelKey)` - Twilio `<Stream>` URL for connecting phone calls
- `connection.updateSession(session)` - Set instructions, STT/TTS models, voice; `model`/`agent_key` only before the first response (`generator_locked` afterwards)
- `connection.respond(text)` - Send a message and await the full response (text + optional audio)
- `connection.on('response.output_text.delta', cb)` - Stream deltas; use `'*'` for all events
- `connection.appendAudio(bytes)` / `commitAudio()` - Voice input via STT
- `connection.createResponse()` / `cancelResponse()` / `close()`

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
- `client.files.providers.list(query?)` - List storage providers
- `client.files.providers.create(data)` - Create a storage provider
- `client.files.list(bucketKey, query?)` - List files
- `client.files.upload(bucketKey, data)` - Upload file
- `client.files.get(bucketKey, objectKey)` - Get file metadata
- `client.files.delete(bucketKey, objectKey)` - Delete a file
- `client.files.download(bucketKey, objectKey)` - Download file bytes (`Uint8Array`)

#### Audio
- `client.audio.transcriptions.create(params)` - Speech-to-text (OpenAI-compatible)
- `client.audio.translations.create(params)` - Translate audio to English
- `client.audio.speech.create(params)` - Synthesize speech (returns binary)

#### OCR
- `client.ocr.extract(params)` - Extract text/tables/layout from a document

#### Crawler
- `client.crawler.list(query?)` - List crawlers
- `client.crawler.create(data)` - Create a crawler
- `client.crawler.get(idOrKey)` - Get a crawler
- `client.crawler.update(idOrKey, data)` - Update a crawler
- `client.crawler.delete(idOrKey)` - Delete a crawler
- `client.crawler.run(idOrKey, options?)` - Trigger a crawler run
- `client.crawler.crawlWithCrawler(idOrKey, options)` - Crawl a fixed URL list using a crawler's config
- `client.crawler.runAdhoc(options)` - Run a one-off crawl without a persistent crawler
- `client.crawler.listUrls / addUrls / removeUrls(...)` - Manage container URLs
- `client.crawler.jobs.list(query?)` - List crawl jobs
- `client.crawler.jobs.get(jobId)` - Get crawl job
- `client.crawler.jobs.listResults(jobId, query?)` - List crawled pages
- `client.crawler.jobs.getResult(jobId, resultId)` - Fetch a single page
- `client.crawler.jobs.cancel(jobId)` - Cancel a running job

#### Automations
- `client.automations.list()` - List automations
- `client.automations.get(key)` - Get an automation
- `client.automations.run(key)` - Trigger immediately
- `client.automations.pause(key)` / `resume(key)` - Pause / resume

#### Rerankers
- `client.rerankers.list()` - List rerankers
- `client.rerankers.get(key)` - Get a reranker
- `client.rerankers.run(key, params)` - Run a reranker (Cohere-compatible response)

### Web Search

- `client.webSearch.search(params)` - Run a web search (default or named provider)
- `client.webSearch.providers.list()` - List configured web search providers

#### MCP
- `client.mcp.console.listTools / execute / initialize / callTool / callJsonRpc(...)` - Built-in Console MCP server
- `client.mcp.console.getSseUrl() / getMessageUrl(sessionId) / getConnectionInfo(apiKey)`
- `client.mcp.server(serverKey)` - Same interface for a tenant-configured MCP server

#### Browsers
- `client.browsers.create(data)` - Create a browser profile
- `client.browsers.list(query?)` - List browser profiles
- `client.browsers.get(idOrKey)` - Get browser profile details
- `client.browsers.update(idOrKey, data)` - Update a browser profile
- `client.browsers.delete(idOrKey)` - Delete a browser profile

#### Browser Sessions
- `client.browserSessions.create(data)` - Create a browser session under a browser profile
- `client.browserSessions.list(query?)` - List browser sessions
- `client.browserSessions.get(sessionId)` - Get browser session details
- `client.browserSessions.listEvents(sessionId, query?)` - List session event history
- `client.browserSessions.action(sessionKey, action)` - Execute a browser action
- `client.browserSessions.extract(sessionKey, input)` - Extract text, HTML, or attributes
- `client.browserSessions.snapshot(sessionKey)` - Capture the current aria snapshot
- `client.browserSessions.screenshotLive(sessionKey, query?)` - Fetch a raw viewport screenshot
- `client.browserSessions.screenshot(sessionKey, input?)` - Persist a screenshot artifact
- `client.browserSessions.pdf(sessionKey, input?)` - Export a PDF artifact
- `client.browserSessions.close(sessionKey)` - Close a live session
- `client.browserSessions.delete(sessionId)` - Delete a stored session record

#### Browser MCP
- `client.browserMcp.getConnectionInfo(browserKey)` - Build SSE/message endpoint URLs for MCP clients
- `client.browserMcp.getSseUrl(browserKey)` - Get the SSE endpoint for a browser MCP server
- `client.browserMcp.getMessageUrl(browserKey, sessionId)` - Build the JSON-RPC message URL
- `client.browserMcp.initialize(browserKey)` - Read the MCP server metadata
- `client.browserMcp.listTools(browserKey)` - List Browser Use MCP tools

Standalone `client.browserAgents` management has been removed. To give a Console-managed agent browser capabilities, configure the `Browser Use` system tool in Console. Use `client.browserSessions` or `client.browserMcp` for direct browser automation from the SDK.

#### Prompts
- `client.prompts.list(query?)` - List prompt templates
- `client.prompts.get(key, options?)` - Get prompt (supports `version` / `environment`)
- `client.prompts.render(key, options?)` - Render prompt with data
- `client.prompts.listVersions(key)` - List version history
- `client.prompts.getDeployments(key)` - Get environment deployment states and history
- `client.prompts.deploy(key, options)` - Run `promote/plan/activate/rollback`
- `client.prompts.compare(key, fromVersionId, toVersionId)` - Compare two versions

#### Tracing
- `client.tracing.ingest(data)` - Ingest a full tracing session
- `client.tracing.startStream(sessionId, data?)` - Open a streaming session
- `client.tracing.appendEvent(sessionId, event)` - Append a single event
- `client.tracing.endStream(sessionId, data?)` - Close a streaming session
- `client.tracing.ingestOtlp(payload)` - Submit OTLP/HTTP JSON spans directly

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
  baseURL: process.env.COGNIPEER_BASE_URL || 'https://console.cognipeer.com',
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
- [Scoped memory](./examples/memory-basic.ts)
- [Browser API reference](https://docs.cognipeer.com/console-sdk/api/browser)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Cognipeer](https://cognipeer.com)

## Support

- 📧 Email: support@cognipeer.com
- 📖 Documentation: [docs.cognipeer.com/console-sdk](https://docs.cognipeer.com/console-sdk)
- 🐛 Issues: [GitHub Issues](https://github.com/Cognipeer/console-sdk/issues)
