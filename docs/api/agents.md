# Agents API

List, retrieve, and invoke AI agents via the Console SDK. Agents are invoked through the OpenAI Responses API format.

## Quick Start

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Invoke an agent
const response = await client.agents.responses.create({
  model: 'support-bot',
  input: 'How do I reset my password?',
});

console.log(response.output);
```

## List Agents

Fetch all agents available to the current API token.

```typescript
const agents = await client.agents.list();
console.log(agents);

// Filter by status
const activeAgents = await client.agents.list({ status: 'active' });
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | string | No | Filter: `active`, `inactive`, `draft` |

### Return Type

```typescript
interface AgentListItem {
  key: string;
  name: string;
  description?: string;
  config: {
    modelKey: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
}
```

## Get Agent

Retrieve details for a specific agent.

```typescript
const agent = await client.agents.get('support-bot');
console.log(agent.name, agent.config.modelKey);
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentKey` | string | Yes | Unique agent key |

### Files: `agent.attachments`

The single-agent lookup (not `list()`) also says whether the agent takes files, so
a client can decide whether to show an attach button before it uploads anything:

```typescript
const agent = await client.agents.get('support-bot');

if (agent.attachments?.enabled) {
  console.log(agent.attachments.max_files, agent.attachments.max_file_size_mb, agent.attachments.allowed_mime_types);
  if (!agent.attachments.accepts_images) console.log('Images would be replaced by a note: the model is text only');
}
```

```typescript
interface AgentAttachmentsInfo {
  enabled: boolean;              // files are on AND the agent's bucket can take a file now
  max_files: number;             // files one session holds (0 while off)
  max_file_size_mb: number;      // largest file (0 while off)
  allowed_mime_types: string[];  // `image/*` wildcards allowed; empty = any
  accepts_images: boolean;       // the agent's model reads images
}
```

Where the files live (bucket, folder, retention) is the agent's **Configure → Files**
setting in the Console, not something a caller chooses. Files are off by default for an
agent and need a bucket; with files off (or on with no bucket) an upload is refused with
`403 attachments_disabled`.

## Invoke Agent (Responses API)

Use `client.agents.responses.create()` to invoke an agent. The request format follows the OpenAI Responses API.

```typescript
const response = await client.agents.responses.create({
  model: 'support-bot',
  input: 'What are your business hours?',
});

console.log(response.id);     // "resp_64a1b2c3d4e5f6"
console.log(response.output); // Assistant response
console.log(response.usage);  // Token usage
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | string | Yes | Agent key |
| `input` | string \| InputItem[] | Yes | User message |
| `previous_response_id` | string | No | Continue a conversation (`resp_...` or `run_...`) |
| `session_id` | string | No | Continue a session (for example one from [`sessions.create()`](#sessions-start-list-delete)); same session as `previous_response_id` |
| `conversation` | string \| `{ id }` | No | OpenAI-style alias of `session_id` |
| `version` | number | No | Specific published version |
| `background` | boolean | No | Queue the turn and return an `AgentRun` — see [Background Runs](#background-runs) |

### Multi-Turn Conversations

Pass `previous_response_id` to continue a conversation:

```typescript
const first = await client.agents.responses.create({
  model: 'support-bot',
  input: 'I have a billing question',
});

const followUp = await client.agents.responses.create({
  model: 'support-bot',
  input: 'Can you show me the pricing page?',
  previous_response_id: first.id,
});
```

`session_id` (alias `conversation`, a string or `{ id }`) names the same conversation as
`previous_response_id` (`resp_<id>`) in the session's own words. Give one, or several that
agree: `session_id` or `conversation` naming a different session than `previous_response_id`
is a `400 session_conflict` (`session_id` and `conversation` disagreeing with each other is a
plain `400 invalid_request`), and a session of another agent or project is a
`404 session_not_found`. It is what you use to continue a session you
started with `sessions.create()`, because that one has no response yet:

```typescript
const session = await client.agents.sessions.create({ agent: 'support-bot' });

const reply = await client.agents.responses.create({
  model: 'support-bot',
  session_id: session.id,
  input: 'I have a billing question',
});
```

### Response Type

```typescript
interface AgentResponse {
  id: string;
  object: 'response';
  model: string;
  output: ResponseOutput[];
  status: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  created_at: number;
  previous_response_id: string | null;
}

interface ResponseOutput {
  type: 'message';
  role: 'assistant';
  content: ResponseContent[];
}

interface ResponseContent {
  type: 'output_text';
  text: string;
}
```

## Background Runs

Long agent turns (many tool calls, slow downstream services) can outlive
proxies and HTTP timeouts. Pass `background: true` to queue the turn and get
an `AgentRun` back immediately (`202`), then poll it or receive a callback.

```typescript
const run = await client.agents.responses.create(
  {
    model: 'research-agent',
    input: 'Compare these three vendors',
    background: true,
    callback_url: 'https://example.com/hooks/agent-run', // optional
    callback_secret: process.env.AGENT_CALLBACK_SECRET,   // optional, min 16 chars
  },
  { idempotencyKey: 'vendor-compare-42' },                // optional, sent as Idempotency-Key
);

run.id;     // "run_66f2..."
run.status; // "queued"

const done = await client.agents.runs.wait(run.id, {
  pollIntervalMs: 2000, // default 1000
  timeoutMs: 15 * 60_000, // default: wait until terminal
});

if (done.status === 'succeeded') {
  console.log(done.result?.output[0]?.content[0]?.text);
  console.log(done.result?.id); // "resp_..."
} else {
  console.log(done.status, done.error); // failed | canceled, { type, message }
}
```

### Background Parameters

| Name | Where | Description |
|------|-------|-------------|
| `background` | body | `true` queues the turn and returns an `AgentRun` |
| `callback_url` | body | Webhook the Console POSTs the terminal event to |
| `callback_secret` | body | Min 16 chars; signs callbacks with HMAC-SHA256 |
| `idempotencyKey` | 2nd argument | `Idempotency-Key` header. Background only — sending it on a synchronous call is a `400` |

Retrying an identical background request with the same `idempotencyKey`
returns the original run instead of starting a second one. Reusing the key
with a different request is a `409 idempotency_key_conflict`.

### Run Methods

```typescript
await client.agents.runs.get('run_66f2...');    // current status
await client.agents.runs.cancel('run_66f2...'); // request cancellation
await client.agents.runs.wait('run_66f2...', { signal: controller.signal });
```

- `wait()` resolves with the run for `succeeded`, `failed` **and** `canceled`
  — and for `requires_action`, where the run is paused on a tool approval or a
  question and polling would never end (`run.result.required_action.actions`
  lists what to answer with `client.agents.sessions.actions.resolve()`) —
  check `status`. It throws `AgentRunWaitTimeoutError` (with
  `lastRun`) when `timeoutMs` elapses and the signal's reason when `signal`
  aborts. Neither stops the run; call `cancel()` for that.
- `cancel()` is cooperative: the run it returns may still say `running` for
  about a second before it lands on `canceled`. Canceling a finished run is a
  `409` with `errorCode === 'agent_run_already_terminal'`.

### Continuing the Conversation

Either the run id (`run_...`) or its result id (`resp_...`) works as
`previous_response_id`:

```typescript
const next = await client.agents.responses.create({
  model: 'research-agent',
  input: 'Now summarize it in three bullets',
  previous_response_id: done.id,
});
```

### AgentRun Type

```typescript
// `requires_action` is not terminal: the run continues once the actions are resolved.
type AgentRunStatus = 'queued' | 'running' | 'requires_action' | 'succeeded' | 'failed' | 'canceled';

interface AgentRun {
  id: string;                 // "run_..."
  object: 'agent.run';
  status: AgentRunStatus;
  stop_reason?: string | null;  // 'end_turn' | 'limit' | 'requires_action' | 'cancelled' | 'error' | ...
  agent?: string;
  conversation_id?: string;
  result?: AgentResponse | null;                  // when succeeded, or the requires_action response
  error?: { type: string; message: string | null } | null; // when failed/canceled
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
}
```

The `202` from `create({ background: true })` is already the full run (`stop_reason`,
`agent`, `conversation_id`, `callback`... with `result: null` and `error: null` until
it finishes); `runs.get()` returns the same shape.

### Error Codes

Errors are `CognipeerAPIError`s; branch on `errorCode` (the body's
`error.code`) with `isAgentRunErrorCode`:

```typescript
import { AgentRunErrorCodes, isAgentRunErrorCode } from '@cognipeer/console-sdk';

try {
  await client.agents.responses.create({ model: 'research-agent', input: '...', previous_response_id: prev });
} catch (error) {
  if (isAgentRunErrorCode(error, AgentRunErrorCodes.Conflict)) {
    // 409: a run is already queued/running on this conversation
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.SyncTimeout)) {
    // 504: synchronous turn hit the server ceiling — retry with background: true
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.ConcurrencyLimit)) {
    // 429: too many background runs in flight for this tenant
  }
}
```

| `errorCode` | Status | Meaning |
|-------------|--------|---------|
| `agent_run_conflict` | 409 | A run is already active on this conversation (sync or background) |
| `timeout` | 504 | Synchronous turn exceeded the server ceiling. Tool side effects may have happened, so the SDK does **not** retry it |
| `agent_run_concurrency_limit` | 429 | Tenant's concurrent background-run limit reached |
| `idempotency_key_conflict` | 409 | `Idempotency-Key` reused with a different request |
| `idempotency_key_sync_not_supported` | 400 | `Idempotency-Key` sent without `background: true` |
| `agent_run_already_terminal` | 409 | `cancel()` on a finished run |
| `action_not_found` / `session_not_found` | 404 | No such action / conversation in this project; `session_not_found` is also a `session_id` / `conversation` of another agent or project |
| `session_conflict` | 400 | `session_id` / `conversation` and `previous_response_id` of one request name different sessions (`session_id` vs `conversation` alone is a `400 invalid_request`) |
| `attachments_disabled` | 403 | The agent takes no files: they are off for it, or on with no bucket chosen (`agents.get(key).attachments.enabled` says so in advance) |
| `storage_unavailable` | 409 | The bucket the agent keeps its files in cannot take a file now (deleted, disabled, or its provider is gone, inactive or not assigned to the project); the message names the bucket |
| `storage_not_configured` | 409 | The agent has files on but no bucket to keep them in (older data); pick a bucket in the agent's Files settings |
| `bucket_in_use` | 409 | From the Files management API: a bucket cannot be deleted or disabled while an agent keeps session files in it (`error.response.agents` lists them). No call of this SDK raises it |
| `action_not_pending` | 409 | The action was already answered |
| `action_cancelled` | 409 | The action was cancelled before it was answered (a new message withdrew it, a run cancel, the timeout policy); `error.response.error.action_status` is `cancelled` |
| `authorization_unavailable` | 503 | The Console could not decide whether this caller may answer (nothing changed; retry after `Retry-After`) |
| `markdown_unavailable` | 409 | `files.content(…, { variant: 'markdown' })` on a file without a text version (a picture, or a conversion that did not succeed) |
| `pending_action` | 409 | A new message was sent while approvals/questions are open |
| `action_expired` | 410 | The approval request ran out of time |
| `action_forbidden` | 403 | This caller may not answer the request (the Console's `agent.approve` permission, or the agent's approvers setting on a Console without the permission engine) |
| `invalid_resolution` | 400 | The answer does not fit the action |
| `invalid_budget` | 400 | The budget is malformed, missing from `sessions.update`, or not above what the session spent |
| `agent_background_disabled` | 400 | `background: true` / a budget resume on an agent with background execution disabled |
| `budget_override_forbidden` | 403 | The agent's own session budget binds API callers (they may lower, not raise or remove it) |
| `budget_reached` | 402 | The session used up its budget (`error.response.error.spent_usd` / `max_cost_usd`) |

### Verifying Callbacks (Node.js)

When the run finishes, the Console POSTs JSON to `callback_url` with:

- `X-Cognipeer-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(callback_secret, "<t>.<raw body>")>`
- `X-Cognipeer-Event: agent_run.succeeded | agent_run.failed | agent_run.canceled | agent_run.requires_action`
- `X-Cognipeer-Event-Id` — stable per run + event; deliveries are retried, so dedupe on it

`verifyWebhook` (alias: `verifyAgentRunCallback`) lives in the Node-only
`@cognipeer/console-sdk/webhooks` entry point (it uses `node:crypto`, which the
browser-safe main entry avoids). Webhook subscriptions (`client.webhooks`) are
signed with the same scheme. Always verify the **raw** request body:

```typescript
import express from 'express';
import { verifyWebhook } from '@cognipeer/console-sdk/webhooks';
import type { AgentRunCallbackEvent } from '@cognipeer/console-sdk';

app.post('/hooks/agent-run', express.raw({ type: 'application/json' }), (req, res) => {
  const ok = verifyWebhook({
    rawBody: req.body, // Buffer
    signatureHeader: req.get('X-Cognipeer-Signature'),
    secret: process.env.AGENT_CALLBACK_SECRET!,
    toleranceSeconds: 300, // default
  });
  if (!ok) return res.sendStatus(400);

  const event = JSON.parse(req.body.toString('utf8')) as AgentRunCallbackEvent;
  // event.event === 'agent_run.succeeded' → event.data.result
  res.sendStatus(204);
});
```

## Sessions: start, list, delete

A session is a conversation seen from the runtime side. `client.agents.sessions` starts
one without sending a message, lists them, reads their state and deletes them.

```typescript
// Start an empty session: nothing runs and nothing is spent.
const session = await client.agents.sessions.create({
  agent: 'support-bot',                 // required: the key of an active agent
  title: 'Invoice question',            // optional, at most 200 characters
  metadata: { ticket: 'T-1042' },       // optional: up to 16 string pairs, never read by the agent
  budget: { max_cost_usd: 2 },          // optional spend cap; null = none
});

session.id;             // pass it as `session_id`
session.runtime_status; // "idle"
session.metadata;       // { ticket: 'T-1042' }
```

The session belongs to the token's owner and is marked as coming from the API. The same
agent and budget rules as the first turn of a Responses call apply (`404 agent_not_found`,
`400 agent_not_active`, `400 invalid_metadata`, `400 invalid_budget`,
`403 budget_override_forbidden`).

### List sessions

`list()` is both a page and an async iterator, newest created first. Rows are summaries:
the session without its transcript (`message_count`) and without `pending_actions`.

```typescript
// One page.
const page = await client.agents.sessions.list({ agent: 'support-bot', status: 'requires_action', limit: 50 });
for (const s of page.data) console.log(s.id, s.title, s.message_count);
page.has_more;     // another page exists
page.next_cursor;  // pass as `after` to continue by hand
const next = await page.getNextPage(); // null on the last page

// Every session, fetching pages as you go (break to stop).
for await (const s of client.agents.sessions.list({ agent: 'support-bot' })) {
  console.log(s.id, s.runtime_status, s.spent_usd);
}
```

| Query | Description |
|-------|-------------|
| `agent` | Only this agent's sessions (its key) |
| `status` | `idle` (includes a session that has not run yet), `running`, `requires_action`, `budget_paused` |
| `limit` | Page size, 1 to 100 (default 20) |
| `after` | The `next_cursor` of the previous page |

The cursor marks the last row you read, so sessions created while you page never shift a row
into or out of a page you already have. Errors: `400 invalid_limit`, `invalid_status`,
`invalid_cursor`. A session list shows what the caller may see: sessions of other people only
when the Console's permissions allow it.

### Get, update, delete

```typescript
const state = await client.agents.sessions.get(session.id);       // runtime state, budget, spent_usd
await client.agents.sessions.update(session.id, { budget: null }); // set, raise or remove the spend cap
await client.agents.sessions.delete(session.id);                  // { id, object: 'agent.session', deleted: true }
```

`delete()` removes the session with its files (object, converted text and record), its event
log and any open approvals or questions. It is refused with `409 agent_run_conflict` while a
run is queued or running on the session (cancel it with `runs.cancel()` first) and answers
`404 session_not_found` for a session of another project.

## Session files

Files uploaded to a session are read by the agent in the turns that follow. The typical flow:
create the session, upload, then ask.

```typescript
import { readFile } from 'node:fs/promises';

const agent = await client.agents.get('support-bot');
if (!agent.attachments?.enabled) throw new Error('This agent takes no files');

const session = await client.agents.sessions.create({ agent: 'support-bot' });

const file = await client.agents.sessions.files.upload(session.id, await readFile('invoice.pdf'), {
  name: 'invoice.pdf',
  mimeType: 'application/pdf',
});
file.bucket_key; // "session-docs": the Document Store bucket it lives in
file.path;       // "agent-sessions/support-bot/<sessionId>/<unique name>": its path inside that bucket

// A file nobody has sent yet goes with the session's next message...
const reply = await client.agents.responses.create({
  model: 'support-bot',
  session_id: session.id,
  input: 'What is the total on this invoice?',
});

// ...or name it in the message.
await client.agents.responses.create({
  model: 'support-bot',
  session_id: session.id,
  input: [{ role: 'user', content: [
    { type: 'input_text', text: 'And the due date?' },
    { type: 'input_file', file_id: file.id },
  ] }],
});
```

| Call | What it does |
|------|--------------|
| `files.upload(sessionId, bytes, { name, mimeType?, signal? })` | Upload (201): the raw bytes as the request body, not base64 |
| `files.list(sessionId)` | The session's files, oldest first |
| `files.content(sessionId, fileId, { variant?, signal? })` | Download the bytes: `{ data, contentType, fileName? }` |
| `files.contentStream(sessionId, fileId, { variant?, signal? })` | The same as a stream (`{ body, contentType, fileName?, size? }`) for large files |
| `files.delete(sessionId, fileId)` | Delete the file (object, converted text and record) |

```typescript
const { data, contentType, fileName } = await client.agents.sessions.files.content(session.id, file.id);
await writeFile(fileName ?? 'download', data);

// The text the agent reads (documents become markdown), when the conversion succeeded.
const { data: md } = await client.agents.sessions.files.content(session.id, file.id, { variant: 'markdown' });
```

`variant` is `original` (default) or `markdown`; a file without a text version answers
`409 markdown_unavailable`, and a file that is not on the session `404 file_not_found`.
`fileName` is the base name from `Content-Disposition`. The content call needs a Console that serves the session-file content
route (`GET /agents/sessions/{id}/files/{fileId}/content`); on an older one it answers `404`.

A `SessionFile` carries `id`, `name`, `mime_type`, `size`, `conversion_status`
(`succeeded` = the agent can read the text; `failed` / `skipped` = only the original exists;
`pending` = still converting), `bucket_key`, `path`, `content_url` (the Console path that serves
the bytes), `created_at` and `expires_at`.
The agent's *Files* setting in the Console decides the bucket, folder, limits and retention;
changing the bucket later affects new files only. Uploads can be refused with
`403 attachments_disabled`, `409 storage_unavailable`, `409 storage_not_configured`,
`409 too_many_files`, `413 file_too_large`, `415 unsupported_file_type` or
`429 quota_exceeded`.

The files are ordinary objects in the bucket, so the Files API sees them too:
`client.files.list(file.bucket_key, { prefix: 'agent-sessions/support-bot/', purpose: 'conversation' })`
lists the agent's session files by folder.

An image reaches the model only when the agent's model reads images
(`agent.attachments.accepts_images`); otherwise the turn records a note that the image was
not sent.

## Approvals, Events and Webhooks

A turn can pause for a tool approval or a question (`status: 'requires_action'`
with `required_action`, or a run in `requires_action`). `client.agents.sessions`
reads the conversation's runtime state (`get`), answers actions
(`actions.resolve`), pages or follows the event log (`events.list`,
`events.stream`) and changes the session budget (`update`).
`client.webhooks` manages event subscriptions.

Answering an approval is the Console's `agent.approve` permission (the person who started the
session always may); a question follows session ownership. Managing webhooks is the Console's
`webhooks` permission: `webhooks.read` lists endpoints and deliveries (with each URL's userinfo
and query string removed, `https://host/path?…`), `webhooks.admin` changes anything and sees
the full URL. A call without the permission answers `403` (`forbidden`, with a `decisionId`).
See the [README](https://github.com/Cognipeer/console-sdk#approvals-and-questions-human-in-the-loop)
for examples.

## Legacy Chat Method

::: warning Deprecated
`client.agents.chat()` is deprecated. Use `client.agents.responses.create()` instead.
:::

```typescript
// Deprecated — avoid in new code
const result = await client.agents.chat('support-bot', {
  message: 'Hello',
});
```

An agent that pauses for an approval or a question answers with an empty `content`;
the result then also carries `status: 'requires_action'` and `pendingActions` (resolve
them with `client.agents.sessions.actions.resolve()`). A completed turn has neither.

## See Also

- [Agents API (Gateway)](https://cognipeer.github.io/cognipeer-console/api/agents)
- [Tools API](/api/tools) — Tools that can be bound to agents
- [Client Reference](/api/client)
