# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-07-14

### Added
- Aegis API (`client.aegis`, Enterprise) — enforcement-plane policy evaluation: `evaluate()` returns an `allow`/`redact`/`require_approval`/`sandbox`/`block` decision with findings, risk score and a sanitized resource; `shields.list()` and `shields.audit(shieldId)` read the enforcement instances and their decision trails. Shields are configured in the Console dashboard (`/dashboard/aegis`).

## [1.4.1] - 2026-07-07

### Added
- `client.sandbox.listeningPorts(id)` — TCP ports currently LISTENing inside a sandbox, with a `loopbackOnly` flag (a service bound only to 127.0.0.1 must be restarted on 0.0.0.0 to be previewable).
- `SandboxPreviewInfo.allPorts` — when true (platform default), **any** port is previewable through `previewUrl(id, port)` / share links, not just the suggested list; the platform provisions an on-demand forwarder for unpublished ports.

## [1.3.1] - 2026-06-10

### Added
- Agent Sandbox API (`client.sandbox`) — remote runtime containers with `exec`/`code`, lifecycle (`start`/`stop`/`delete`), file IO (`fs.*` and volume `uploadFiles`/`listFiles`/`downloadFile`), `git.*`, detached `sessions.*`, and `snapshot`/`fork`/`restoreSnapshot`/`waitUntilRunning`.
- Realtime API (`client.realtime`) — WebSocket sessions with `connect`/`url`/`twilioStreamUrl`, the `RealtimeConnection` event API and `respond()` helper, optional voice (STT/TTS) round-trip, and realtime model presets (`client.realtime.models`).

### Changed
- Documented the full API surface on the docs site (previously README-only): Batches, Moderations, Spend & Budgets, Realtime, Agent Sandbox, plus LangChain and OpenTelemetry integration pages.

## [1.2.0] - 2026-06-03

### Added
- Batch API (`client.batches`) — OpenAI-compatible async bulk inference: `create`/`list`/`retrieve`/`cancel`/`items`/`results`/`resultsRaw`.
- Moderations API (`client.moderations.create`) — OpenAI-compatible content classification backed by guardrails.
- Spend API (`client.spend.report`) and Budgets API (`client.budgets` — `list`/`create`/`update`/`delete`/`status`).

### Removed
- `client.browserAgents` (superseded by the `browsers` / browser sessions / per-browser MCP split).

## [1.1.0] - 2026-05-21

### Added
- Audio API (`client.audio.transcriptions`, `audio.translations`, `audio.speech`).
- OCR API (`client.ocr.extract`).
- Automations API (`client.automations`).
- Crawler API (`client.crawler` + `client.crawler.jobs`).
- JS Sandbox API (`client.jsSandbox`).
- Reranker API (`client.rerankers`, Cohere-compatible).
- MCP API (`client.mcp.console`, `client.mcp.server(key)`) with REST + JSON-RPC + SSE helpers.
- Tracing streaming (`startStream` / `appendEvent` / `endStream`) and direct OTLP ingest (`ingestOtlp`).
- File providers (`client.files.providers`) and binary `client.files.download(...)`.

### Changed
- `HttpClient` now supports binary responses and multipart uploads.
- Default `baseURL` is the host root. Legacy URLs ending in `/api/client/v1` are normalised automatically.

### Fixed
- URL double-prefix bug when the default `baseURL` was used with resource paths that already include `/api/client/v1`.

## [1.0.2] - 2025-10-09

### Fixed
- Documentation deployment configuration for GitHub Pages

## [1.0.0] - 2025-10-08

### Added
- Initial release of Cognipeer Console SDK
- Chat completions with streaming support
- Embeddings API
- Vector operations (Pinecone, Chroma, Qdrant)
- File management with markdown conversion
- Agent tracing and observability
- Full TypeScript support
- ESM and CommonJS builds
- Comprehensive documentation

### Features
- OpenAI-compatible API
- Type-safe client
- Error handling
- Request/response validation
- Multi-provider support

[1.0.2]: https://github.com/Cognipeer/console-sdk/compare/v1.0.0...v1.0.2
[1.0.0]: https://github.com/Cognipeer/console-sdk/releases/tag/v1.0.0
