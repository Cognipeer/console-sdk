# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Crawler sync runs** — `client.crawler.run(...)` / `crawlWithCrawler(...)`
  accept `mode: 'sync'` and then resolve with the finished job plus inline
  results (`CrawlRunSyncResponse`, markdown included). New single-URL
  convenience `client.crawler.crawlUrl(idOrKey, url)`.
- **Web Search API** (`client.webSearch`) — run web searches through
  Console-configured Web Search instances (Bing, Brave Search, Serper, Tavily,
  SearxNG, DuckDuckGo): `search(...)` with provider/count/language/country/
  safe-search options, `searchWith(key, ...)` for a named instance,
  `include_answer: true` for AI-interpreted answers (requires the instance's
  AI Answer setting), and `providers.list()`. New types: `WebSearchRequest`,
  `WebSearchResponse`, `WebSearchResultItem`, `WebSearchProvider`,
  `WebSearchSafeSearch`.

### Changed

- **Default base URL** is now `https://console.cognipeer.com` (was
  `https://api.cognipeer.com`). Only affects clients constructed without an
  explicit `baseURL`; pass `baseURL` to target another host. Existing
  behaviour of stripping a trailing `/api/client/v1` is unchanged.

### Fixed

- **`client.tools.*` routing** — `list`, `get`, `execute`, and the deprecated
  agent-tool helpers were calling paths without the `/api/client/v1` prefix
  (e.g. `/tools` instead of `/api/client/v1/tools`), so every Tools call hit
  the wrong URL. Now prefixed correctly. No signature changes.
- `client.crawler.runAdhoc(...)` now sends `seeds` (the field the server's
  ad-hoc schema requires) instead of `urls`, and exposes `engine`/`maxDepth`/
  `maxPages`/`mode` options.

### Removed

- **BREAKING: JS Sandbox API** (`client.jsSandbox`) and its types
  (`JsSandboxRuntime`, `JsSandboxExecuteRequest`, `JsSandboxExecutionResult`,
  …). The JS Sandbox module has been removed from the Console platform; use
  the Agent Sandbox (`client.sandbox`) `code`/`exec` APIs for code execution.

## [1.7.0]

### Added

- **`metadata` on tracing sessions** — `TracingSessionRequest`/
  `TracingStreamStartRequest` (`client.tracing.ingest`/`startStream`) accept an
  optional `metadata: Record<string, string>` sibling of `agent`: free-form
  attribution tags the Console groups/reports on as a dynamic
  `group_by`/`group_by_entity=metadata.<key>` dimension (e.g.
  `{ complexity: 'complex' }`), with no schema change required on either side.

## [1.3.1] - 2026-06-10

### Added

- **Agent Sandbox API** (`client.sandbox`) — remote runtime containers with
  `exec`/`code`, lifecycle (`start`/`stop`/`delete`), filesystem (`fs.*`) and
  volume file IO (`uploadFiles`/`listFiles`/`downloadFile`), `git.*`, detached
  `sessions.*`, and `snapshot`/`fork`/`restoreSnapshot`/`waitUntilRunning`.
- **Realtime API** (`client.realtime`) — WebSocket sessions (`connect`/`url`/
  `twilioStreamUrl`), the `RealtimeConnection` event API and `respond()` helper,
  optional STT/TTS voice round-trip, and realtime model presets
  (`client.realtime.models`).

### Changed

- Documented the full client surface on the VitePress site (previously
  README-only): Batches, Moderations, Spend & Budgets, Realtime, Agent Sandbox,
  plus LangChain and OpenTelemetry integration pages.

## [1.2.0] - 2026-06-03

### Added

- **Batch API** (`client.batches`) — OpenAI-compatible async bulk inference:
  `create`/`list`/`retrieve`/`cancel`/`items`/`results`/`resultsRaw`.
- **Moderations API** (`client.moderations.create`) — OpenAI-compatible content
  classification backed by console guardrails.
- **Spend API** (`client.spend.report`) and **Budgets API** (`client.budgets` —
  `list`/`create`/`update`/`delete`/`status`) for cost reporting and caps.

### Removed

- `client.browserAgents` — superseded by the `browsers` / browser sessions /
  per-browser MCP split.

## [1.1.0] - 2026-05-21

### Added

- **Audio API** (`client.audio`) — OpenAI-compatible speech-to-text
  (`audio.transcriptions.create`), translation (`audio.translations.create`),
  and text-to-speech (`audio.speech.create`, returns binary audio).
- **OCR API** (`client.ocr.extract`) — document text extraction with optional
  page selection and feature flags (text, tables, kv_pairs, layout,
  reading_order, handwriting).
- **Automations API** (`client.automations`) — list, get, run, pause, resume
  built-in scheduled jobs.
- **Crawler API** (`client.crawler`) — manage crawlers, run scheduled or
  ad-hoc crawls, manage URL lists, and read crawl jobs/results
  (`client.crawler.jobs`).
- **JS Sandbox API** (`client.jsSandbox`) — execute snippets inside a managed
  runtime and inspect available runtimes.
- **Reranker API** (`client.rerankers`) — Cohere-compatible reranking
  (`list`, `get`, `run`).
- **MCP API** (`client.mcp`) — talk to both the built-in console MCP server
  (`client.mcp.console`) and tenant-configured MCP servers
  (`client.mcp.server(key)`). Supports REST `execute`, JSON-RPC `initialize`
  / `tools/list` / `tools/call`, and SSE URL builders.
- **Tracing streaming** — `client.tracing.startStream`, `appendEvent`,
  `endStream` for incremental session ingestion. Direct OTLP ingestion via
  `client.tracing.ingestOtlp(payload)`.
- **File providers** — `client.files.providers.{list,create}` for managing
  storage backends behind buckets, plus `client.files.download(bucketKey,
  objectKey)` returning the raw bytes.

### Changed

- `HttpClient` now supports binary responses (`requestBinary`) and multipart
  uploads (`requestMultipart`); used by audio, OCR, and file download paths.
- Default `baseURL` is now the host root (`https://api.cognipeer.com`). The
  client transparently strips a legacy trailing `/api/client/v1` if supplied,
  so existing callers keep working.
- `CognipeerOTelSpanExporter` accepts both forms of `baseURL` and normalises
  the trailing `/api/client/v1`.

### Fixed

- Resolved the double `/api/client/v1/api/client/v1/...` URL that occurred
  when the default `baseURL` was used together with the resource-level path
  prefix.

## [1.0.0] - 2025-10-09

### Added

- Initial release of Cognipeer Console SDK
- Chat completions API with streaming support
- Embeddings API for text vectorization
- Vector operations API for managing vector databases
- File management API with upload and markdown conversion
- Tracing API for agent observability
- Full TypeScript support with comprehensive types
- Error handling with custom error classes
- Retry logic with exponential backoff
- Configurable timeouts and base URLs
- OpenAI-compatible API design
- ESM and CommonJS support
- Comprehensive documentation site
- Example projects for common use cases
- Multi-provider vector database support

### Features

#### Chat API
- OpenAI-compatible chat completions
- Streaming responses with Server-Sent Events
- Tool/function calling support
- Multi-turn conversations
- Configurable temperature, max_tokens, etc.

#### Embeddings API
- Text to vector conversion
- Batch embedding support
- Multiple embedding models

#### Vector API
- Provider management (Pinecone, Chroma, Qdrant, etc.)
- Index creation and management
- Vector upsert, query, and delete operations
- Metadata filtering
- Multiple distance metrics (cosine, euclidean, dotproduct)

#### Files API
- File bucket management
- File upload with base64 encoding
- Automatic markdown conversion
- File metadata management

#### Tracing API
- Agent execution tracking
- Event ingestion
- Token usage monitoring

### Documentation
- Getting started guide
- API reference for all resources
- Configuration guide
- Error handling guide
- Streaming guide
- Type safety guide
- Multiple examples (chat, streaming, RAG, files)

### Developer Experience
- Full TypeScript types
- Comprehensive JSDoc comments
- Intuitive API design
- Detailed error messages
- Request/response logging support

## [Unreleased]

### Planned
- Webhook support for async operations
- Bulk operations optimization
- Additional vector database providers
- GraphQL support
- WebSocket streaming
- Rate limiting utilities
- Request caching
- Mock server for testing

---

[1.0.0]: https://github.com/Cognipeer/console-sdk/releases/tag/v1.0.0
