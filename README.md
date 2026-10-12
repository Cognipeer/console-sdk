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
- 🎧 **Realtime** - Low-latency voice sessions over WebSocket (binary PCM/G.711 audio, server turn detection, barge-in, first message, latency metrics) and Twilio phone calls
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

#### Agents
- `client.agents.responses.create(params, options?)` - Invoke an agent (OpenAI Responses API format)
- `client.agents.responses.create({ ..., background: true, callback_url?, callback_secret? }, { idempotencyKey? })` - Start a background run; returns an `AgentRun` (`run_...`) immediately
- `client.agents.runs.get(runId)` - Run status, with `result` once `succeeded` / `error` once `failed`/`canceled`
- `client.agents.runs.cancel(runId)` - Cooperatively cancel a `queued`/`running` run
- `client.agents.runs.wait(runId, { pollIntervalMs?, timeoutMs?, signal? })` - Poll until the run is terminal **or `requires_action`** (waiting on an approval/question)
- `client.agents.sessions.create({ agent, title?, metadata?, budget? })` - Start an empty session (nothing runs); continue it with `responses.create({ session_id })`
- `client.agents.sessions.list({ agent?, status?, limit?, after? })` - Await it for a page, or `for await` it for every session (newest first)
- `client.agents.sessions.delete(conversationId)` - Delete a session with its files, events and open actions
- `client.agents.sessions.get(conversationId)` - Runtime state: `runtime_status`, `stop_reason`, `pending_actions`, `last_event_seq`
- `client.agents.sessions.actions.list(conversationId)` / `.resolve(conversationId, actionId, body, { background? })` - Pending approvals/questions (read from the session; the Console has no client list route) and answering them
- `client.agents.sessions.events.list(conversationId, { after?, types?, limit? })` / `.stream(conversationId, { after?, types?, signal? })` - The session event log: paged, or followed live with automatic `Last-Event-ID` reconnect
- `client.agents.sessions.update(conversationId, { budget, resume })` - Raise, set or remove (`null`) the session spend budget (`budget` is required; `{ max_cost_usd, on_reach }`)
- `client.agents.sessions.files.upload/list/delete(conversationId, …)` - Files the agent can read in the conversation; each file says where it is stored (`bucket_key`, `path`)
- `client.agents.sessions.files.content(conversationId, fileId, { variant? })` / `.contentStream(…)` - Download a session file (the original, or the `markdown` text the agent reads)
- `client.agents.get(key).attachments` - Whether the agent takes files now, its limits, and whether its model reads images
- `client.webhooks.create/list/get/update/delete/rotateSecret/test/deliveries/redeliver/eventTypes` - Webhook subscriptions (objects keep camelCase field names, unlike the agent API's snake_case)
- `verifyWebhook({ rawBody, signatureHeader, secret })` from `@cognipeer/console-sdk/webhooks` (Node.js) - Verify a signed webhook delivery (`verifyAgentRunCallback` is the same check, kept for existing code)

```typescript
const run = await client.agents.responses.create(
  { model: 'research-agent', input: 'Compare these vendors', background: true },
  { idempotencyKey: 'job-42' },
);
const done = await client.agents.runs.wait(run.id, { timeoutMs: 15 * 60_000 });
if (done.status === 'succeeded') console.log(done.result?.output[0]?.content[0]?.text);
```

See [Agents → Background runs](docs/api/agents.md#background-runs) for callbacks and error codes.

##### Approvals and questions (human in the loop)

An agent can pause a turn to ask for a tool approval or to ask the user a question. The turn then
comes back with `status: 'requires_action'` (Responses API) or a run in `requires_action`, listing
what to answer. Answer with `sessions.actions.resolve()`; the turn continues from where it stopped.

```typescript
const res = await client.agents.responses.create({ model: 'ops-agent', input: 'Clean up staging' });

if (res.status === 'requires_action') {
  const conversationId = res.id.replace(/^resp_/, '');
  for (const action of res.required_action!.actions) {
    if (action.kind === 'tool_approval') {
      console.log('Agent wants to run', action.tool_name, action.args);
      // `approved_args` replaces the arguments; `remember_for_session` stops asking for this tool.
      const next = await client.agents.sessions.actions.resolve(conversationId, action.id, {
        decision: 'allow',
        remember_for_session: true,
      });
      // `next` is the continuation (Responses shape). While other actions of the same pause are
      // still open it is a bare `requires_action` body (empty `output`, no `usage`).
    } else {
      await client.agents.sessions.actions.resolve(conversationId, action.id, {
        answers: { [action.questions![0].question]: 'staging' }, // or { cancelled: true } to skip
      });
    }
  }
}
```

- `resolve(..., { background: true })` queues the continuation and returns an `AgentRun` (`202`).
- For a background run, `runs.wait()` returns when the run is `requires_action`; read
  `run.result.required_action.actions` and `run.stop_reason`. The `agent_run.requires_action`
  callback/webhook event fires at the same moment.
- Errors (`CognipeerAPIError`): `403 action_forbidden` (not an allowed approver), `404`
  `action_not_found`, `409 action_not_pending` (answered by someone else), `409 action_cancelled`
  (withdrawn before it was answered), `410 action_expired`, `400 invalid_resolution`,
  `503 authorization_unavailable` (the Console could not decide; nothing changed, retry). Test with `isAgentActionErrorCode(error, AgentActionErrorCodes.Expired)`.
- A new user message while an action is pending is rejected with `409 pending_action`
  (`AgentActionErrorCodes.PendingAction`, ids in `error.response.error.pending_action_ids`) unless the
  agent is configured to cancel pending requests.

##### Session events and live follow

Every session has an append-only event log (`user.message`, `agent.tool_use`, `agent.tool_result`,
`action.required`, `action.resolved`, `agent.message`, `session.status_idle`, `session.work_done`,
`session.error`, ...). Read it with `events.list()` or follow it:

```typescript
import { isSessionEvent } from '@cognipeer/console-sdk';

const session = await client.agents.sessions.get(conversationId);
const controller = new AbortController();

for await (const event of client.agents.sessions.events.stream(conversationId, {
  after: session.last_event_seq, // omit to replay the whole log first
  signal: controller.signal,
})) {
  if (event.type === 'agent.message.delta') process.stdout.write(event.data.text); // live only
  if (isSessionEvent(event, 'action.required')) notifyApprover(event.data.action_id);
  if (isSessionEvent(event, 'session.status_idle')) break; // the stream itself never ends on idle
}
```

`stream()` reconnects by itself (network drop, idle stall, the server's hourly cap) using
`Last-Event-ID`, never repeats or skips a persisted event, gives up after `maxReconnects` (default 8)
silent attempts, and throws the abort reason when `signal` aborts. `agent.message.delta` text chunks
are live-only (they have no `seq` and are not replayed); the full text is in `agent.message`.
Event `data` keys are snake_case (`tool_call_id`, `action_id`, `stop_reason`, ...); tool `args` and
question `answers` are passed through untouched. Unknown event types arrive as plain `{ type, data }`
objects: ignore them.

##### Sessions: start, list, delete

```typescript
// Start a session without a message (nothing runs, nothing is spent), then continue it by id.
const session = await client.agents.sessions.create({
  agent: 'support-bot',
  metadata: { ticket: 'T-1042' },   // up to 16 string pairs, returned as session.metadata
});
const reply = await client.agents.responses.create({
  model: 'support-bot',
  session_id: session.id,           // or `conversation: session.id` / `conversation: { id }` (OpenAI style)
  input: 'I have a billing question',
});

// One page (newest first)...
const page = await client.agents.sessions.list({ agent: 'support-bot', status: 'requires_action', limit: 50 });
console.log(page.data.map((s) => `${s.id} ${s.runtime_status} ${s.message_count} messages`));
const next = await page.getNextPage(); // null on the last page

// ...or every session, fetching pages as you go.
for await (const s of client.agents.sessions.list({ agent: 'support-bot' })) console.log(s.id, s.title);

await client.agents.sessions.delete(session.id); // with its files, events and open actions
```

`session_id`, `conversation` and `previous_response_id` name the same conversation: give one, or
several that agree (`400 session_conflict` when `session_id` / `conversation` and
`previous_response_id` name different sessions, `400 invalid_request` when `session_id` and
`conversation` disagree; `404 session_not_found` for another agent's or project's session). `delete()` is refused with `409 agent_run_conflict` while a run is active.
Details and the error table: [Agents → Sessions](docs/api/agents.md#sessions-start-list-delete).

##### Session budget and files

```typescript
// Raise the cap of a budget_paused session; it continues as a background run.
const run = await client.agents.sessions.update(conversationId, {
  budget: { max_cost_usd: 10, on_reach: 'pause' },
});
if (run.object === 'agent.run') await client.agents.runs.wait(run.id);
// budget: null removes the cap; resume: false changes it without continuing (answers the session).
// An agent with its own session budget lets API callers lower it but not raise/remove it (403 budget_override_forbidden).
```

Files go to a session before or between messages. Whether an agent takes files, and in which Document
Store bucket and folder it keeps them, is its **Configure → Files** setting in the Console; ask the
agent first:

```typescript
const agent = await client.agents.get('support-bot');
if (agent.attachments?.enabled) {
  const { max_files, max_file_size_mb, allowed_mime_types, accepts_images } = agent.attachments;
}

const session = await client.agents.sessions.create({ agent: 'support-bot' });

// Upload first (create -> upload -> ask)...
const file = await client.agents.sessions.files.upload(session.id, bytes, {
  name: 'invoice.pdf',
  mimeType: 'application/pdf',
});
file.bucket_key; // the bucket it is stored in
file.path;       // <folder>/<agentKey>/<sessionId>/<unique name>

// ...a file nobody has sent yet goes with the next message...
await client.agents.responses.create({ model: 'support-bot', session_id: session.id, input: 'Total?' });

// ...or name it explicitly.
await client.agents.responses.create({
  model: 'support-bot',
  session_id: session.id,
  input: [{ role: 'user', content: [
    { type: 'input_text', text: 'Summarise this' },
    { type: 'input_file', file_id: file.id },
  ] }],
});

// Read a file back: the bytes as uploaded, or the text the agent reads.
const { data, contentType, fileName } = await client.agents.sessions.files.content(session.id, file.id);
const { data: markdown } = await client.agents.sessions.files.content(session.id, file.id, { variant: 'markdown' });
// A large file: `contentStream()` returns { body: ReadableStream, contentType, fileName?, size? }.
```

Upload errors (`CognipeerAPIError.errorCode`, see `AgentActionErrorCodes`): `403 attachments_disabled`
(files off for the agent, or on with no bucket chosen), `409 storage_unavailable` (the bucket was deleted or
disabled, or its provider is unusable; the message names it), `409 storage_not_configured`,
`409 too_many_files`, `413 file_too_large`, `415 unsupported_file_type`, `429 quota_exceeded`. The file
content call needs a Console that serves the session-file content route; `variant: 'markdown'` on a
file without a text version is a `409 markdown_unavailable`.

##### Webhook subscriptions

Webhooks are managed with the Console's permission engine and nothing else: `webhooks.read` lists endpoints
and deliveries (each `url` comes back with its userinfo and query string removed, `https://host/path?…`),
`webhooks.admin` creates, changes, tests, rotates, redelivers and deletes, and sees the full URL. Workspace
owners and admins hold it by default; everybody else gets `403 forbidden` (with a `decisionId`) until it is
granted. A token acts for its owner, in its own project only.

```typescript
const hook = await client.webhooks.create({
  url: 'https://example.com/hooks/cognipeer',
  events: ['action.required', 'session.idled', 'agent_run.*'], // `prefix.*` patterns allowed
});
saveSecret(hook.secret); // returned only by create() and rotateSecret()
await client.webhooks.test(hook.id);
const { deliveries: failed, hasMore } = await client.webhooks.deliveries(hook.id, { status: 'failed' });
await client.webhooks.redeliver(failed[0].id); // queued again (202); sent asynchronously
```

Verify every delivery on the raw body and dedupe on the `webhook-id` header (a delivery is retried
until your endpoint answers 2xx; the Console disables an endpoint that redirects, resolves to a
blocked address or keeps failing):

```typescript
import { verifyWebhook, type WebhookEvent } from '@cognipeer/console-sdk/webhooks';

app.post('/hooks/cognipeer', express.raw({ type: 'application/json' }), (req, res) => {
  const ok = verifyWebhook({
    rawBody: req.body,
    signatureHeader: req.get('X-Cognipeer-Signature'),
    secret: process.env.COGNIPEER_WEBHOOK_SECRET!,
  });
  if (!ok) return res.sendStatus(400);
  const event: WebhookEvent = JSON.parse(req.body.toString('utf8'));
  // event.type: 'session.idled' | 'action.required' | 'agent_run.requires_action' | ...
  res.sendStatus(204);
});
```

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
- `client.realtime.connect({ model })` - Open a WebSocket session; `model` is a realtime model key or raw chat model key. Pass `{ agent }` instead to have a Console agent generate the responses. The generator is fixed once the conversation starts. Resolves once the server has created the session and rejects with the server's reason when the key is refused (`timeoutMs` bounds the wait)
- `conn.sendAudio(bytes)` / `conn.onAudio(cb)` - Voice: raw `pcm16` (24 kHz default) / G.711 input as binary frames, server turn detection (`semantic_vad` default), decoded Int16 PCM output; typed events via `conn.on(type, cb)` (see [docs/api/realtime.md](docs/api/realtime.md))
- `client.realtime.calls.create({ to, model })` / `.get(sessionId, { refresh? })` / `.hangup(sessionId)` - Outbound phone calls through the preset's Twilio connection (inbound calls: point the number at the Console's voice webhook; the server mints the media-stream URL)
- `connection.updateSession(session)` - Set instructions, STT/TTS models, voice; `model`/`agent_key` only before the first response (`generator_locked` afterwards)
- `connection.respond(text)` - Send a message and await the full response (text + optional audio); rejects if the socket closes first
- `connection.on('response.output_text.delta', cb)` - Stream deltas; use `'*'` for all events
- `connection.appendAudio(bytes)` / `commitAudio()` - Base64 audio input / manual end of turn (push-to-talk, `turn_detection: null`)
- `connection.createResponse()` / `cancelResponse()` / `close()`
- `connection.onClose(cb)` / `connection.closed` - Learn that the server closed the connection (`4401` unauthorized, `4402` license required, `1013` server busy, `1011` server error, a network drop…)

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
- `client.files.list(bucketKey, query?)` - List files (`prefix` browses one folder and returns `folders`; `purpose: 'conversation'` keeps only agent session files)
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
