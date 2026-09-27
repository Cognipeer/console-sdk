# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-09-27

### Why this is a MAJOR, not a minor

Two surfaces that returned data now throw, and one Console API is gone:

- `client.aegis.evaluate()`, `client.aegis.shields.list()` and
  `client.aegis.shields.audit()` USED TO ISSUE REAL REQUESTS in 1.7.1. The
  Aegis enforcement plane has been removed from the Console and
  `/api/client/v1/aegis/*` no longer exists, so those calls would 404. They now
  throw a `CognipeerError` naming the replacement instead of failing at the
  wire. A method that used to return a value and now always throws is a
  breaking change however it is packaged, so this is 2.0.0 rather than the
  1.8.0 it was staged as.
- `client.aegis` and the twelve `Aegis*` types still EXIST, so a 1.x build
  keeps compiling and the migration message arrives at runtime where a
  developer will read it. They are deleted in **3.0.0** — this release is the
  one that announces it, not the one that does it.

See `docs/api/aegis.md` for the full mapping. The short version: a shield is a
guardrail, `shieldId` is `guardrail_key`, `evaluate({stage, resource})` is
`guardrails.hooks.evaluate({hook, tool_name, tool_args})`, and the decision is
read with `shouldBlock(verdict)` — never with `decision === 'block'`, which
turns a monitoring policy into an enforcing one. `retrieval.pre` /
`retrieval.post` and `shields.audit()` have no replacement at all.

### Added

- **Agent background runs** (1.8.0) — `client.agents.responses.create()`
  accepts `background: true` plus optional `callback_url` / `callback_secret`
  and returns an `AgentRun` (`run_...`, `queued`) immediately; a second
  options argument carries `idempotencyKey` (sent as `Idempotency-Key`) and
  `signal`. New `client.agents.runs.get(runId)`, `.cancel(runId)` and
  `.wait(runId, { pollIntervalMs, timeoutMs, signal })` (throws
  `AgentRunWaitTimeoutError`). New types `AgentRun`, `AgentRunStatus`,
  `AgentRunError`, `AgentRunWaitOptions`, `AgentRunCallbackEvent`,
  `AgentResponseCreateOptions`; helpers `isAgentRunTerminal`,
  `isAgentRunErrorCode` and the `AgentRunErrorCodes` map
  (`agent_run_conflict`, `agent_run_concurrency_limit`, `timeout`,
  `agent_run_already_terminal`, `idempotency_key_conflict`,
  `idempotency_key_sync_not_supported`).
- **`@cognipeer/console-sdk/webhooks`** (Node.js only) —
  `verifyAgentRunCallback({ rawBody, signatureHeader, secret, toleranceSeconds })`
  checks `X-Cognipeer-Signature` (HMAC-SHA256 over `t.rawBody`, timing-safe,
  300s replay window by default). Separate entry point so the main one stays
  free of `node:crypto`.
- **`CognipeerAPIError.errorCode`** — the response body's `error.code`, when
  present (new optional trailing constructor argument).

- **Guardrail hook plane** (`client.guardrails`) — the Console's guardrails now
  run as six hooks (`prompt.pre`, `input.pre`, `output.pre`,
  `output.stream.delta`, `tool.pre`, `tool.post`) over nine policy families
  (pii, secrets, word_filter, regex, moderation, prompt_shield, custom,
  tool_access, webhook). `prompt.pre` fires once per run on the incoming user
  turn, where `input.pre` fires again before every model call — nothing inside
  the Console emits it, so it exists for remote enforcement points like this
  one:
  - `client.guardrails.hooks.evaluate(...)` evaluates ONE hook against one or
    more guardrail keys (their verdicts merge by max() over the action ladder).
    The parameters are a union discriminated on `hook`, so a `tool.pre` call
    does not compile without `tool_name` and a `tool.post` call does not compile
    without `tool_result` — what the server answers with a 400.
  - `client.guardrails.list(filters?)` — the guardrails this token can address
    (its own project plus workspace-level ones), each with an `effectiveMode`
    and a `hooksSummary` whose `servable` list says which hooks it will actually
    evaluate. Credential-bearing policy fields are never served.
  - `create`/`update` accept `hooks`, `hooksVersion` and `mode`; an omitted
    `hooks` on update leaves the stored configuration untouched.
  - `GuardrailPolicy` carries a per-policy `message` (what an end user is told
    when THAT policy blocks, overriding the per-reason template — `regex`,
    `custom` and `webhook` all share one reason class, so without it the three
    cannot be worded separately) and `runIf` (when an LLM policy may spend a
    model call).
  - New types: `HookId`, `HookVerdict`, `HookSubject`, `SafetyAction`,
    `SafetyFinding`, `Mutation`, `RenderedBlockMessage`, `GuardrailMode`,
    `GuardrailHooksConfig` (with the nine per-family policy configs),
    `GuardrailHookEvaluateParams`, `GuardrailHookEvaluateResponse`,
    `GuardrailListQuery`, `GuardrailListItem`, `GuardrailHooksSummary`.
- **`shouldBlock(verdict)`** — the one correct enforcement test, exported from
  the package root. A verdict blocks only when `decision === 'block'` **and**
  `enforced === true`; a guardrail in monitor mode reports what it would have
  done without applying it, so `decision === 'block' && enforced === false`
  must NOT block, and `passed` means "no blocking finding", not "the request was
  not blocked". Accepts either shape the API returns — the camelCase
  `HookVerdict` and the snake_case hook response spell `decision`/`enforced`
  identically.
- **`GuardrailEvaluateResponse.verdict`** — `client.guardrails.evaluate(...)` is
  unchanged (same request, same keys, still always 200) and now additionally
  carries the full hook verdict: spans, mutations, risk score, the rendered
  block message and the dry-run `wouldBeDecision`. Note `blocked_message` /
  `verdict.message` is an OBJECT, not a string: `body` is the text, and
  `mode: 'replace'` means substitute it for the response rather than reject.
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

### Deprecated

- **Aegis (`client.aegis`)** — the Aegis enforcement plane has been removed from
  the Console; `/api/client/v1/aegis/*` no longer exists. `AegisResource`,
  `AegisShieldsResource` and every `Aegis*` type stay exported so 1.x builds keep
  compiling, but **every method now throws a `CognipeerError` naming its
  replacement** instead of issuing a request that would fail as a confusing 404.
  Migrate to `client.guardrails`:
  - a shield is a guardrail — `aegis.shields.list()` → `guardrails.list()`, and
    `shieldId` → `guardrail_key`;
  - `aegis.evaluate({ stage, resource })` →
    `guardrails.hooks.evaluate({ hook, tool_name, tool_args })`, with
    `tool_result` on `tool.post`. The stage names carry over unchanged:
    `tool.pre`, `tool.post`, `input.pre` and `output.pre` are hook ids as they
    stand. `retrieval.pre` / `retrieval.post` have no hook and no replacement;
  - `AegisEvaluation` → `GuardrailHookEvaluateResponse`; `decision` and
    `enforced` keep their names, so read them with `shouldBlock(verdict)`;
  - `aegis.shields.audit(...)` has no client-API equivalent — guardrail
    decisions are evaluation logs read in the Console dashboard, correlated by
    the `trace_id` / `policy_version` on each verdict.

  `client.aegis` and the `Aegis*` types are **removed entirely in the next
  major**. (`McpAegisConfig` on MCP server definitions follows its own
  timeline: it is a persisted MCP field the Console still accepts, now
  deprecated in favour of `McpGuardrailConfig` below.)

- **`McpGuardrailConfig`** — the guardrail binding for an MCP server's tool
  calls, replacing the deprecated `aegis` field on `McpServer`,
  `McpServerCreateRequest` and `McpServerUpdateRequest`. Send
  `guardrail: { guardrailKey, mode }`; `mode` keeps the MCP vocabulary
  (`'off'`, not `'disabled'`) so the two fields stay drop-in interchangeable
  during the release where both are written. An OMITTED `guardrailKey` selects
  the tenant's default tool guardrail rather than meaning "no guardrail" — to
  turn enforcement off, send `mode: 'off'`. `aegis` is still accepted and still
  served; where both are sent, `guardrail` wins.
- **`client.tools`** — the `/api/client/v1/tools*` endpoints it calls are no
  longer served by the Console runtime; every method now 404s. Warns on
  first use. Use `client.mcp` for tool execution/management, or
  `client.agents`'s `toolBindings` for an agent's own tools. Will be removed
  in a future major version.

### Fixed

- **HTTP retries honour `error.retryable: false`** — a `429`/`502`/`503`/`504`
  whose body says `retryable: false` is no longer retried. The Console sends
  this with a synchronous agent turn's `504 timeout`, whose tool calls may
  already have had side effects; blindly re-sending it would repeat them.
- `npm run lint` passes again (`varsIgnorePattern: '^_'` for intentionally
  discarded destructured fields; one documented `no-this-alias` disable).

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
