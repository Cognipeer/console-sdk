---
layout: home

hero:
  name: Console SDK
  text: TypeScript for the Cognipeer Console.
  tagline: One client, every Console resource — chat, agents, browsers, vectors, files, tracing. Calm types, streaming-first, OpenAI-compatible where it matters.
  image:
    src: /logo.svg
    alt: Cognipeer Console SDK
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/client
    - theme: alt
      text: View on GitHub
      link: https://github.com/Cognipeer/console-sdk

features:
  - icon: '01'
    title: Chat completions
    details: OpenAI-compatible chat with first-class streaming. Drop the client in where you already call OpenAI and keep your message shape.
  - icon: '02'
    title: Agents API
    details: Multi-turn Responses with tool bindings, version pinning, and structured outputs. Inspect runs through the same client.
  - icon: '03'
    title: Unified tools
    details: List, execute, and convert OpenAPI and MCP tools into Agent SDK objects without writing adapter glue per provider.
  - icon: '04'
    title: Browser automation
    details: Create browser profiles, drive live sessions, and expose each browser as its own MCP endpoint for Browser Use clients.
  - icon: '05'
    title: Embeddings & vectors
    details: A single API across Chroma, Postgres, Elasticsearch, Azure AI Search, and S3 Vectors. Build retrieval without committing to a backend on day one.
  - icon: '06'
    title: Files & memory
    details: Upload documents with markdown conversion, then thread them into long-lived memory the platform manages for you.
  - icon: '07'
    title: Config & guardrails
    details: Manage secrets, group resolution, and audit trails. Apply guardrails per environment without touching application code.
  - icon: '08'
    title: Tracing built in
    details: Every agent run produces a structured trace — spans, tool calls, latencies — viewable in Console or piped via OpenTelemetry.
  - icon: '09'
    title: Realtime & voice
    details: WebSocket sessions with streaming responses and an optional STT/TTS voice round-trip — drive them from the browser, Node, or Twilio Media Streams.
  - icon: '10'
    title: Agent Sandbox
    details: Remote runtime containers for agents — exec commands, run code, manage files and git, and snapshot or fork the whole environment over the API.
  - icon: '11'
    title: Batch, moderations & spend
    details: OpenAI-compatible async batch inference, content moderation backed by guardrails, and spend reports with enforceable budget caps.
  - icon: '12'
    title: Strict types
    details: Full TypeScript, no any escape hatches. Generics carry through streams, tool definitions, and structured outputs.
---

<div class="cgp-section">

<p class="eyebrow">Where this fits</p>

## SDK or Console — pick the surface that matches the work.

The SDK is the application-layer client. The Console is the platform. Most teams need both, but for different reasons.

<div class="cgp-split">

**Reach for the SDK when you are**

- Wiring Cognipeer into a Node, Next.js, or browser app
- Writing TypeScript and want resource methods, not raw HTTP
- Streaming chat, tracing agents, or driving browser sessions from code

**Go to [Console docs](https://cognipeer.github.io/cognipeer-console/) when you are**

- Provisioning tenants, providers, or deployment targets
- Reviewing raw API contracts or platform-level semantics
- Operating the platform rather than calling it

</div>

</div>

<div class="cgp-section">

<p class="eyebrow">Install</p>

## One package. Every resource on the client.

::: code-group

```bash [npm]
npm install @cognipeer/console-sdk
```

```bash [pnpm]
pnpm add @cognipeer/console-sdk
```

```bash [yarn]
yarn add @cognipeer/console-sdk
```

:::

</div>

<div class="cgp-section">

<p class="eyebrow">First call</p>

## A streaming chat completion in twelve lines.

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });

const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  stream: true,
  messages: [
    { role: 'system', content: 'You are a precise assistant.' },
    { role: 'user',   content: 'Summarize the Q3 release notes.' },
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

</div>

<div class="cgp-section">

<p class="eyebrow">Entry points</p>

## Where to start, by what you're trying to do.

| You are… | Open this | What you get |
| --- | --- | --- |
| Deciding how Console and the SDK divide responsibility | [Working with Console](/guide/working-with-console) | A clear split between platform ops and app integration |
| Wiring the client into a new service | [Getting started](/guide/getting-started) | Install, auth, base URL, the first request |
| Mapping existing HTTP calls to SDK methods | [Console API mapping](/api/console-mapping) | One-to-one method-to-endpoint reference |
| Following an end-to-end example | [Examples](/examples/) | Chat, streaming, RAG, memory, tracing — runnable |

</div>

<div class="cgp-section cgp-section-quiet">

<p class="eyebrow">Help</p>

## Stuck somewhere?

Open a [GitHub issue](https://github.com/Cognipeer/console-sdk/issues) — the team triages from there. For platform questions (provider keys, tenants, billing) head to the [Console docs](https://cognipeer.github.io/cognipeer-console/) instead.

</div>

<style scoped>
.cgp-section { margin-top: 72px; }
.cgp-section:first-of-type { margin-top: 96px; }
.cgp-section h2 {
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.16;
  margin: 8px 0 18px;
  max-width: 720px;
  border: 0;
  padding: 0;
}
.cgp-section h2::before { display: none; }
.cgp-section p.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 500;
  margin: 0 0 12px;
}
.cgp-section p.eyebrow::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.cgp-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 18px;
  padding: 24px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background: var(--bg-elev);
}
.cgp-split strong { font-weight: 500; color: var(--text); }
.cgp-split ul { margin: 8px 0 0; padding: 0; list-style: none; }
.cgp-split li {
  font-size: 14px;
  color: var(--text-soft);
  padding: 6px 0;
  border-bottom: 1px dashed var(--hairline);
}
.cgp-split li:last-child { border-bottom: 0; }
@media (max-width: 720px) {
  .cgp-split { grid-template-columns: 1fr; }
}
</style>
