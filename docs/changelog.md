# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
