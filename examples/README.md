# Cognipeer Console SDK Examples

Runnable scripts that exercise individual SDK surfaces. Each example is a
single TypeScript file you can run with `tsx`.

## Setup

```bash
npm install
export COGNIPEER_API_KEY=your-api-key
# Optional: point at a non-default Console (defaults to https://api.cognipeer.com)
export COGNIPEER_BASE_URL=https://your-console.example.com
```

## Running examples

```bash
npm run example:chat              # Basic chat completion
npm run example:streaming         # Streaming chat
npm run example:rag               # RAG with vectors
npm run example:memory            # Scoped memories: add, search, recall

# New in 1.1.0
npm run example:audio             # TTS → MP3 → STT round-trip
npm run example:crawler           # Ad-hoc crawl + poll + read results
npm run example:reranker          # Cohere-compatible reranking
npm run example:js-sandbox        # Run JS inside a managed isolate
npm run example:mcp-console       # Talk to the built-in Console MCP server
npm run example:tracing-stream    # Streaming tracing session (start/append/end)
```

## Environment knobs

Most examples are happy with just `COGNIPEER_API_KEY`. A few accept overrides:

| Variable | Used by | Purpose |
|----------|---------|---------|
| `COGNIPEER_BASE_URL` | all | Override the default host root. |
| `COGNIPEER_TTS_MODEL`, `COGNIPEER_TTS_VOICE`, `COGNIPEER_STT_MODEL` | audio | Pick model/voice. |
| `COGNIPEER_CRAWL_URLS` | crawler | Comma-separated URLs to crawl (default: `https://example.com`). |
| `COGNIPEER_RERANKER_KEY` | reranker | Required — pick a reranker configured in Console. |
| `COGNIPEER_JS_RUNTIME_KEY` | js-sandbox | Optional runtime to target. |
| `COGNIPEER_VECTOR_PROVIDER_KEY`, `COGNIPEER_EMBEDDING_MODEL_KEY` | memory, rag | Provider/embedding overrides. |

## File list

| File | Topic |
|------|-------|
| `chat-basic.ts` | Basic chat completion |
| `chat-streaming.ts` | Streaming chat completion |
| `rag-example.ts` | RAG / vector search |
| `memory-basic.ts` | Memory stores |
| `audio-tts-stt.ts` | Text-to-speech → speech-to-text |
| `crawler-adhoc.ts` | Run an ad-hoc crawl and read results |
| `reranker-basic.ts` | Run a Cohere-compatible reranker |
| `js-sandbox-basic.ts` | Execute JS inside a sandbox runtime |
| `mcp-console.ts` | Drive the built-in Console MCP server |
| `tracing-stream.ts` | Stream a tracing session event-by-event |

## Prerequisites

- Node.js 18+
- Cognipeer Console account
- API key from your dashboard

## Documentation

See the [full documentation](https://cognipeer.github.io/console-sdk) for more details.
