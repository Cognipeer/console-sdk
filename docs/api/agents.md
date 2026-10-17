# Agents API

List, retrieve and run AI agents via the Console SDK: chat-style calls through the OpenAI Responses API format, jobs through the runs API, recurring work through routines.

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

console.log(response.output_text);
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
The agent runs its **published** version (its draft only when it was never published); `version: 3` pins a version and
`version: 'draft'` runs the draft.

```typescript
const response = await client.agents.responses.create({
  model: 'support-bot',
  input: 'What are your business hours?',
});

console.log(response.id);          // "resp_run_66f2..." (the id of its run)
console.log(response.output_text); // the answer
console.log(response.usage);       // Token usage
```

The agent's own configuration decides instructions, sampling and tools: `instructions`, `temperature`, `top_p` and
`max_output_tokens` are not part of the agent request (the Console lists ignored parameters in the
`X-Cognipeer-Ignored-Params` response header).

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | string | Yes | Agent key (`support-bot` or `agent:support-bot`) |
| `input` | string \| InputItem[] | Yes | User message: text, `input_file` (`file_id`, `file_data`, `file_url`), `input_image` |
| `previous_response_id` | string | No | Continue a conversation (`resp_<runId>`; legacy `resp_<conversationId>` and `run_...` still work) |
| `session_id` | string | No | Continue a session (for example one from [`sessions.create()`](#sessions-start-list-delete)); same session as `previous_response_id` |
| `conversation` | string \| `{ id }` | No | OpenAI-style alias of `session_id` |
| `version` | number \| `'draft'` | No | Pin a published version, or run the draft. Default: the published version |
| `text.format` | `json_schema` \| `json_object` \| `text` | No | Structured output for this turn: see [Structured output](#structured-output) |
| `metadata` | Record&lt;string, string&gt; | No | Up to 16 pairs, stored on the run and echoed back |
| `service_tier` | string | No | `flex` runs the turn as a low-priority `deferred` run |
| `inputs` | object | No | Values for the inputs the agent declares (`agent.input_schema`) |
| `background` | boolean | No | Do not wait: answer at once (`202`) with a `queued` / `in_progress` response — see [Long turns](#long-turns-202-and-background) |
| `stream` | boolean | No | Return an async iterator of `response.*` events — see [Streaming](#streaming) |
| `callback_url` / `callback_secret` | string | No | Async runs: POST the terminal event there (signed with the secret, min 16 chars) |
| `reasoning_effort` / `reasoning` | `none`…`high`, `xhigh`, `max` | No | Reasoning effort; the agent's own pick wins |
| `agent_model`, `runtime_context`, `budget`, `include_reasoning` | | No | As documented on `AgentResponseCreateRequest` |

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

### Structured output

`text.format` asks for JSON that fits a schema, replacing the agent's own structured output for this turn.
The parsed answer is `output_parsed`; an answer that does not fit is `output_error`.

```typescript
const res = await client.agents.responses.create({
  model: 'invoice-bot',
  input: 'Extract the totals from this invoice: ...',
  text: {
    format: {
      type: 'json_schema',
      name: 'invoice',
      schema: { type: 'object', properties: { total: { type: 'number' } }, required: ['total'] },
      strict: true,
    },
  },
});

res.output_parsed; // { total: 42 }
res.output_text;   // '{"total":42}'
```

`agents.get(key)` returns `input_schema` and `output_schema` (JSON Schema) when the agent declares inputs or a
structured output: the agent as a typed function. Pass the inputs with `inputs`.

### Streaming

`stream: true` returns an async iterator of typed `response.*` events (`response.created`, `response.output_text.delta`,
`response.completed`...). A disconnect cancels the turn unless `background: true`.

```typescript
const stream = await client.agents.responses.create({ model: 'support-bot', input: 'Hi', stream: true });
for await (const event of stream) {
  if (event.type === 'response.output_text.delta') process.stdout.write(event.delta);
  if (event.type === 'response.completed') console.log(event.response.usage);
  if (event.type === 'error') throw new Error(event.message);
}
```

### Long turns: 202 and background

A call waits for the answer up to the Console's window. When the turn is still going, the Console answers HTTP `202`:
the SDK does **not** throw, it returns the response with `status: 'in_progress'` (or `'queued'`). The turn keeps
running. `background: true` asks for that at once.

```typescript
const res = await client.agents.responses.create({ model: 'research-agent', input: 'Compare these vendors' });

if (res.status === 'queued' || res.status === 'in_progress') {
  const run = await client.agents.runs.wait(res.cognipeer!.run_id!, { timeoutMs: 15 * 60_000 });
  console.log(run.output_text, run.output_parsed);
}

// or read / stop it by response id
const current = await client.agents.responses.retrieve(res.id);
await client.agents.responses.cancel(res.id); // POST /responses/{id}/cancel
```

`retrieve(id)` returns the response as it is now (`queued`, `in_progress`, then final); `cancel(id)` returns the
`cancelled` response, or `in_progress` while a cooperative stop lands, and the finished response when it already
ended.

### Response Type

```typescript
interface AgentResponse {
  id: string;                     // "resp_<runId>"
  object: 'response';
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'incomplete' | 'failed' | 'cancelled' | 'requires_action';
  output: ResponseOutputMessage[];
  output_text?: string;
  output_parsed?: unknown;        // structured output
  output_error?: string;
  output_files?: AgentOutputFile[];
  incomplete_details?: { reason: string } | null;
  error?: { message: string } | null;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number };
  created_at: number;
  metadata?: Record<string, string> | null;
  previous_response_id: string | null;
  conversation?: { id: string } | null;
  version: number | null;
  cognipeer?: { run_id?: string; session_id?: string; agent_model?: string };
}
```

## Runs

`client.agents.runs` is the canonical surface for jobs: start a turn now, later or at low priority, follow it, cancel it.
Responses, chat completions and A2A are dialects over the same runs.

```typescript
// Hold the call up to 30 s; past that the run is returned as it is (202), never an error.
const run = await client.agents.runs.create(
  'research-agent',
  {
    input: 'Compare these three vendors',
    inputs: { region: 'EMEA' },                 // the agent's declared inputs
    class: 'deferred',                          // low-priority queue (default: 'default')
    delay_seconds: 3600,                        // or run_at: '2026-10-18T06:00:00Z' -> status 'scheduled'
    metadata: { ticket: 'OPS-12' },
    callback: { url: 'https://example.com/hooks/agent-run', secret: process.env.AGENT_CALLBACK_SECRET },
    response_format: { type: 'json_schema', json_schema: { name: 'cmp', schema: { type: 'object' } } },
    wait: 30,
  },
  { idempotencyKey: 'vendor-compare-42' },     // optional; generated when omitted
);

run.id;     // "run_66f2..."
run.status; // 'succeeded' | 'queued' | 'scheduled' | 'running' | ...

const done = await client.agents.runs.wait(run.id, { timeoutMs: 15 * 60_000 });
if (done.status === 'succeeded') console.log(done.output_text, done.output_parsed);
else console.log(done.status, done.error); // failed | canceled, { type, message }
```

### Run methods

```typescript
await client.agents.runs.create(agentKey, body, { idempotencyKey?, prefer?, signal? });
await client.agents.runs.get('run_66f2...', { wait: 20 });  // ?wait= long-poll
await client.agents.runs.wait('run_66f2...', { timeoutMs, signal });
await client.agents.runs.cancel('run_66f2...');
await client.agents.runs.queue();                           // running / queued / scheduled per class + limits

const page = await client.agents.runs.list({ agent: 'research-agent', status: ['failed', 'canceled'], limit: 50 });
page.data; page.has_more; await page.getNextPage();
for await (const r of client.agents.runs.list({ routine_id: 'rtn_1' })) console.log(r.id); // every page

await client.agents.runs.events('run_66f2...', { after: 10 });          // the run's session events (JSON)
for await (const event of client.agents.runs.events.stream('run_66f2...')) { /* SSE, resumes with Last-Event-ID */ }

await client.agents.runs.resolveAction('run_66f2...', 'act_1', { decision: 'allow' }); // a pending approval / question
```

- `create()` returns the `AgentRun`: finished within `wait`, otherwise `queued` / `scheduled` / `running`
  (HTTP `202`). An `Idempotency-Key` is generated when you pass none, so a retried request never starts a second run;
  the same key with a different request is `409 idempotency_key_conflict`. `prefer: { wait, respondAsync }` sends the
  RFC 7240 `Prefer` header. `stream: true` returns an async iterator of `response.*` events instead.
- `wait()` uses the Console's `?wait=` long-poll (one quiet request lasts `waitSeconds`, default 20, capped below the
  client timeout) and resolves with the run for `succeeded`, `failed` **and** `canceled` — and for `requires_action`,
  where the run is paused on an approval or a question and waiting would never end (`run.result.required_action.actions`
  lists what to answer). It throws `AgentRunWaitTimeoutError` (with `lastRun`) when `timeoutMs` elapses and the
  signal's reason when `signal` aborts. Neither stops the run; call `cancel()` for that.
- `cancel()` ends a `scheduled`, `queued` or `requires_action` run at once; a `running` one stops cooperatively (the
  returned run may still say `running` with `cancel_requested_at` for about a second). Canceling a finished run is a `409`
  with `errorCode === 'agent_run_already_terminal'`.
- `list()` filters: `agent`, `status`, `class`, `session_id`, `routine_id`, `channel`, `metadata` (up to 3 exact pairs),
  `created_after`, `created_before`, `limit` (max 100), `after`. Newest first.

### AgentRun Type

```typescript
// `requires_action` is not terminal: the run continues once the actions are resolved.
type AgentRunStatus = 'scheduled' | 'queued' | 'running' | 'requires_action' | 'succeeded' | 'failed' | 'canceled';

interface AgentRun {
  id: string;                 // "run_..."
  object: 'agent.run';
  status: AgentRunStatus;
  class?: 'default' | 'deferred';
  agent?: string;
  version?: number | null;
  session_id?: string;        // also conversation_id
  channel?: 'runs' | 'responses' | 'chat_completions' | 'a2a' | 'routine';
  trigger?: 'request' | 'schedule' | 'once' | 'manual';
  routine_id?: string | null;
  metadata?: Record<string, string> | null;
  stop_reason?: string | null;
  result?: AgentResponse | null;     // Responses-shaped, when finished (or the requires_action response)
  output_text?: string | null;
  output_parsed?: unknown;
  error?: { type: string; message: string | null } | null;
  scheduled_for?: number | null;
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  detached_at?: number | null;       // the caller stopped waiting (a 202)
  cancel_requested_at?: number | null;
  callback?: { url: string; status: string | null; attempts: number; signed: boolean } | null;
}
```

## Routines

A routine is a prompt an agent runs on a cron schedule (with an IANA timezone), once at a time, or only on demand.
Every fire is a run (`runs.list({ routine_id })` is the history).

```typescript
const routine = await client.agents.routines.create('report-bot', {
  name: 'Weekday digest',
  trigger: { type: 'schedule', cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
  // or { type: 'once', run_at: '...' } | { type: 'once', delay_seconds: 3600 } | { type: 'manual' }
  prompt: 'Summarise yesterday',
  inputs: { team: 'ops' },
  class: 'deferred',
  metadata: { source: 'routine' },
});

await client.agents.routines.list('report-bot');
await client.agents.routines.get('report-bot', routine.id);
await client.agents.routines.update('report-bot', routine.id, { enabled: false });
const run = await client.agents.routines.run('report-bot', routine.id, { inputs: { team: 'sales' }, wait: 10 });
await client.agents.routines.delete('report-bot', routine.id);
```

Webhook events: `routine.fired` (a run was created) and `routine.failed` (it could not be created).

## Continuing the Conversation

The response id (`resp_<runId>`) or the run id (`run_...`) works as `previous_response_id`:

```typescript
const next = await client.agents.responses.create({
  model: 'research-agent',
  input: 'Now summarize it in three bullets',
  previous_response_id: done.id,
});
```

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
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.ConcurrencyLimit)) {
    // 429: too many runs in flight for this tenant (or the deferred queue is full)
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.InvalidInputs)) {
    // 400: `inputs` do not fit agent.input_schema; error.response.error.errors lists the fields
  }
}
```

| `errorCode` | Status | Meaning |
|-------------|--------|---------|
| `agent_run_conflict` | 409 | A run is already active on this conversation |
| `agent_run_concurrency_limit` | 429 | Tenant's concurrent run limit reached (or the deferred queue is full) |
| `idempotency_key_conflict` | 409 | `Idempotency-Key` reused with a different request |
| `invalid_inputs` | 400 | `inputs` do not fit the agent's input schema (`errors: [{ field, message }]`) |
| `invalid_response_format` | 400 | `text.format` / `response_format` cannot be used |
| `agent_run_already_terminal` | 409 | `runs.cancel()` on a finished run |
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

## See Also

- [Agents API (Gateway)](https://cognipeer.github.io/cognipeer-console/api/agents)
- [Tools API](/api/tools) — Tools that can be bound to agents
- [Client Reference](/api/client)
