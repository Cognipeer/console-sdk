# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<<<<<<< Updated upstream
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
=======
## [1.7.0] - 2026-08-17

### Added

- **New resources**: `client.analytics` (usage/overview), `client.audit`
  (logs), `client.monitoring` (inference), `client.pii` (policy CRUD +
  detect/redact/…) — additive, no existing method/resource/type field changed.
- **`client.tracing.listThreads`/`getThread`**.
- **Authoring on existing resources** — `agents`/`tools`/`mcp`/`prompts`/
  `guardrails`/`rag`/`reranker` gained `create`/`update`/`delete` (plus
  `publish`/`sync`/`setLatestVersion`/`refreshTools` where applicable).
- **`metadata` on tracing sessions** — `TracingSessionRequest`/
  `TracingStreamStartRequest` (`client.tracing.ingest`/`startStream`) accept an
  optional `metadata: Record<string, string>` sibling of `agent`: free-form
  attribution tags the Console groups/reports on as a dynamic
  `group_by`/`group_by_entity=metadata.<key>` dimension (e.g.
  `{ complexity: 'complex' }`), with no schema change required on either side.
>>>>>>> Stashed changes

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

## [1.7.1] - 2026-08-28

### Added

- Added Node 24 CI and npm Trusted Publishing release workflows.
- Added client smoke tests covering authentication, URL normalization, resource initialization, and request headers.

### Changed

- Corrected npm repository and documentation homepage metadata for `@cognipeer/console-sdk`.

## [1.6.0] - 2026-07-17

### Added

- **MCP Hubs discovery client** — `client.mcp.hubs.list`/`get`/`servers`/
  `server` — hub catalog discovery (MCP Registry envelope, cursor pagination,
  tool schemas on detail).
- `realtime.connect({ runtimeContext })` sends session-scoped downstream auth
  right after the socket opens; refreshable via `updateSession`.

## [1.4.0] - 2026-07-05

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

### Fixed

- `client.crawler.runAdhoc(...)` now sends `seeds` (the field the server's
  ad-hoc schema requires) instead of `urls`, and exposes `engine`/`maxDepth`/
  `maxPages`/`mode` options.

## [1.3.4] - 2026-07-02

### Removed

- **BREAKING: JS Sandbox API** (`client.jsSandbox`) and its types
  (`JsSandboxRuntime`, `JsSandboxExecuteRequest`, `JsSandboxExecutionResult`,
  …). The JS Sandbox module has been removed from the Console platform; use
  the Agent Sandbox (`client.sandbox`) `code`/`exec` APIs for code execution.
  Note: this landed as a patch release, not a major bump — pin an exact
  version if you still depend on `client.jsSandbox`.

## [1.3.3] - 2026-06-29

### Added

- `client.sandbox.setPreview(id, { enabled?, public? })` — toggle port
  preview on/off and public (share links) vs. private (login-only), applied
  live. `create()` accepts `previewEnabled`/`previewPublic`; `preview()`/
  `SandboxPreviewInfo` now expose `enabled`/`public`.

## [1.3.2] - 2026-06-27

### Added

- **Sandbox port preview helpers** — `sandbox.preview(id)` (list previewable
  ports and their proxy URLs), `sandbox.createPreviewLink(id, port, opts?)`
  (session-less, expiring share link), `sandbox.previewUrl(id, port, path?)`
  (authenticated proxy path). New types: `SandboxPreviewPort`/`Info`/
  `ShareLink`; `SandboxSummary.preview`.
- `resources` override (`cpuCores`/`memoryMb`/`diskMb`/`pids`) on
  `sandbox.create()` and on snapshot restore, for sizing a sandbox or a
  resumed snapshot.

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

## [1.3.0] - 2026-06-22

### Added

- **Agent Sandbox API** (`client.sandbox`) — initial resource for remote
  runtime containers: `create`/`list`/`get`/`delete`, `exec`/`code`,
  `waitUntilRunning`, filesystem (`fs.*`: list/info/read/write/mkdir/delete/
  move/find/replace), `git.*` (clone/status/branches/checkout/add/commit/
  push/pull/log), and detached `sessions.*`. (Lifecycle `start`/`stop`,
  volume file IO, and snapshot/fork/restore followed in 1.3.1.)
- `reasoning_content`/`reasoning` on chat messages (streamed and
  non-streamed) — reasoning/"thinking" models' chain-of-thought, surfaced end
  to end including through the LangChain integration (`additional_kwargs` on
  `AIMessage`/`AIMessageChunk`).

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

## [1.0.6] - 2026-05-14

### Added

- **Browser automation resources** — `client.browsers` (profiles),
  `client.browserSessions` (Playwright-backed sessions: `action`/`extract`/
  `snapshot`/`screenshot`/`screenshotLive`/`pdf`/`close`), and
  `client.browserMcp` (per-browser MCP tool bridge: `initialize`/
  `listTools`). This split superseded the older `client.browserAgents`,
  which was removed in 1.2.0.

### Changed

- Clarified memory API docs/examples (base URL usage, added debug logging)
  and refined the `MemorySource`/`MemoryItemStatus` types.

## [1.0.5] - 2026-03-25

Housekeeping release. This commit ("Initial public release") is the
earliest point in this repository's git history; no per-commit detail is
available for what changed since 1.0.4.

## [1.0.4] - 2026-02-20

Published to npm; no corresponding commit survives in this repository's
history — the visible git history begins after this release, at the 1.0.5
snapshot above. No further detail could be grounded in source.

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
