# Agents API

List, retrieve and run AI agents via the Console SDK: chat-style calls through the OpenAI Responses API format, jobs through the runs API, and work that starts on its own (a schedule, a set time, a webhook) through triggers.

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

### Variables and output: `agent.variables_schema`, `agent.output_schema`

The single-agent lookup (not `list()`) describes the agent as a typed function: `variables_schema` is the JSON Schema of the
[variables](#variables) a caller may send (`null` when the agent declares none), `output_schema` the schema of its structured
answer (`null` for a plain-text agent).

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
  accepts_images: boolean;       // uploads are on (`enabled`) AND the agent's model reads images; false while uploads are off
  outputs: {                     // files the agent writes for the person (see below)
    enabled: boolean;            // outputs are on, a bucket is set and it can take a file now
    max_files_per_turn: number;
    max_file_size_mb: number;
    types: string[];             // extensions it may write, without the dot
  };
}
```

`outputs` is independent of uploads: an agent with an attachments bucket can write files for the person while uploads
(`attachments.enabled`) are off. By default outputs are on when uploads are on and a bucket is set, and stay off with
uploads off until they are turned on. Files the agent wrote this turn come back as `output_files` on the Response
(`{ id, name, mime_type, size, download_url }`, with `file_path` annotations on the message; download with
`sessions.files.content()`). The agent can read session files (`session_files_list` / `session_files_read`) when uploads
or outputs are on.

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

console.log(response.id);          // "resp_<runId>" (the id of its run)
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
| `previous_response_id` | string | No | Continue a conversation (`resp_<runId>`; `run_...` and a legacy `resp_<sessionId>` work too) |
| `session_id` | string | No | Continue a session (for example one from [`sessions.create()`](#sessions-start-list-delete)); same session as `previous_response_id` |
| `conversation` | string \| `{ id }` | No | OpenAI-style alias of `session_id` |
| `version` | number \| `'draft'` | No | Pin a published version, or run the draft. Default: the published version |
| `text.format` | `json_schema` \| `json_object` \| `text` | No | Structured output for this turn: see [Structured output](#structured-output) |
| `metadata` | Record&lt;string, string&gt; | No | Up to 16 pairs, stored on the run and echoed back |
| `service_tier` | string | No | `flex` runs the turn as a low-priority `deferred` run |
| `variables` | object | No | Values for the variables the agent declares (`agent.variables_schema`), sent next to the message: see [Variables](#variables) |
| `background` | boolean | No | Do not wait: answer at once (`202`) with a `queued` / `in_progress` response (also `X-Cognipeer-Background: true`) — see [Long turns](#long-turns-202-and-background) |
| `stream` | boolean | No | Return an async iterator of `response.*` events — see [Streaming](#streaming) |
| `callback_url` / `callback_secret` | string | No | Async runs: POST the terminal event there (signed with the secret, min 16 chars) |
| `reasoning_effort` / `reasoning` | `none`…`high`, `xhigh`, `max` | No | Reasoning effort; the agent's own pick wins. Applied when the run executes inside the request (a waited call or a stream); a queued run (`background: true`, `service_tier: 'flex'`) uses the agent's own effort |
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

`agents.get(key)` returns `variables_schema` and `output_schema` (JSON Schema) when the agent declares variables or a
structured output: the agent as a typed function. Pass the variables with `variables` ([Variables](#variables)).

### Streaming

`stream: true` returns an async iterator of typed `response.*` events. A disconnect cancels the turn unless
`background: true`. Every event has a `sequence_number`.

```typescript
const stream = await client.agents.responses.create({ model: 'support-bot', input: 'Hi', stream: true });
for await (const event of stream) {
  if (event.type === 'response.output_text.delta') process.stdout.write(event.delta);
  if (event.type === 'response.reasoning_summary_text.delta') process.stderr.write(event.delta); // the agent's thinking, when shown
  if (event.type === 'response.completed') console.log(event.response.usage);
  if (event.type === 'response.incomplete') console.log('stopped early', event.response.incomplete_details); // a limit, or a cancel
  if (event.type === 'error') throw new Error(event.message);
}
```

The order: `response.created`, `response.in_progress`; a reasoning item (`response.output_item.added`,
`response.reasoning_summary_part.added`, `response.reasoning_summary_text.delta`..., then the `.done` events) when the agent
shows its reasoning; the message item (`response.output_item.added`, `response.content_part.added`,
`response.output_text.delta`..., `.done` events); then one closing event carrying the whole Response, with its output files:
`response.completed` (also a turn that paused: `status: 'requires_action'`), `response.incomplete` (a limit, or a cancelled
run: `status: 'cancelled'`) or `response.failed` (preceded by an `error` event with `code`, `message` and `error_type`).
A retry with the same `Idempotency-Key` of a run that already exists is answered as a short stream: the stored answer,
or the run as it stands. `: ping` comments keep idle connections open and are skipped for you.

### Long turns: 202 and background

A call waits for the answer up to the Console's window (10 minutes by default; the plan may shorten it). When the turn is
still going, the Console answers HTTP `202`: the SDK does **not** throw, it returns the response with
`status: 'in_progress'` (or `'queued'`). The turn keeps running. `background: true` asks for that at once, and
`retrieve()` then reports `background: true` (also for a run started with `stream: true`). `background` is what the request
asked for: a `service_tier: 'flex'` call is queued but reads `background: false`.

If the run a waiting call is attached to is ended elsewhere before it finishes (the server shut down and handed its runs over,
or the worker was lost), the call throws a `503` `CognipeerAPIError` with `errorCode === 'agent_run_interrupted'`
(`AgentRunErrorCodes.Interrupted`) instead of returning a partial answer; tool calls may have run, so retry with an
`idempotencyKey`. A `stream: true` call is checked against the run caps and the agent quota before it opens: over a limit it
throws the plain `429` of the call (`retryAfterMs` set), not an event on the stream.


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
ended. To stop the turn of an inline call (a streamed or waiting `responses.create`, chat completions, A2A) from a second
request, cancel its session: `client.agents.sessions.cancel(res.cognipeer.session_id)` answers
`{ object: 'agent.session.cancel', session_id, cancelled, run_ids }` (`cancelled: false`: nothing was running, not an error).

### Response Type

```typescript
interface AgentResponse {
  id: string;                     // "resp_<runId>"
  object: 'response';
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'incomplete' | 'failed' | 'cancelled' | 'requires_action';
  output: ResponseOutputItem[];   // a reasoning item (when shown) and the answer message; empty while queued / in progress
  output_text?: string;
  output_parsed?: unknown;        // structured output
  output_error?: string;
  output_files?: AgentOutputFile[];
  incomplete_details?: { reason: string } | null;
  error?: { code: string; message: string } | null;   // when status is 'failed'
  usage: ResponseUsage | null;   // null before there is an answer; the two detail objects below are always present (0 when not reported)
  //   ResponseUsage = { input_tokens, input_tokens_details: { cached_tokens }, output_tokens,
  //                     output_tokens_details: { reasoning_tokens }, total_tokens }   (reasoning_tokens is 0 for an agent run)
  created_at: number;
  metadata?: Record<string, string> | null;
  text?: { format?: ResponsesTextFormat };
  service_tier?: string;          // 'flex' for a deferred run
  background?: boolean;           // what the request asked for: true for background: true (flex reads false)
  previous_response_id: string | null;
  conversation?: { id: string } | null;
  version: number | null;
  cognipeer?: { run_id?: string; session_id?: string; agent_model?: string };  // run_id is "run_<id>"
}
```

## Variables

An agent can declare **variables**: named, typed values that a caller sends **next to** the message. A variable has a name and
a type (`string` for text, `number`, `integer`, `boolean` for yes/no, or `json`), is required or optional, and may have a label,
a list of allowed values and a default (**Configure → Variables** in the Console; up to 32 per agent).

- **They are checked before the model is called.** A missing required value, an unknown name, a wrong type or a value outside
  the allowed ones is a `400 invalid_variables` with `errors: [{ field, message }]`, and nothing is spent. Defaults are applied;
  each text value is at most 8 KiB and all values together at most 32 KiB.
- **The agent sees them twice.** Its instructions can use them as <code v-pre>{{variables.&lt;name&gt;}}</code>, and every value is also added to the
  user message as a `Variables` JSON block, so the model reads them even when the instructions do not mention them.
- **They are published.** `agents.get(key).variables_schema` is a JSON Schema of the agent's variables (`null` when it has none),
  so n8n, CI scripts, other agents and forms know what to send.

```typescript
const agent = await client.agents.get('report-bot');
agent.variables_schema; // { type: 'object', properties: { team: { type: 'string' }, ... }, required: ['team'] }

await client.agents.runs.create('report-bot', {
  input: 'Weekly numbers',                       // the message
  variables: { team: 'ops', region: 'EMEA' },    // the variables, next to it
});
```

**Best for programs and automation.** Use variables for runs that a program starts: the runs API, [triggers](#triggers) (a schedule trigger with
fixed values, a webhook trigger that maps event fields into them, like <code v-pre>{{payload.pull_request.number}}</code>), n8n or CI pipelines, an agent
that another agent calls as a tool, forms. `variables` is accepted by `runs.create()`, `responses.create()`, chat completions,
A2A data parts and `triggers.run()`.

**Careful in chat.** Chat clients (Open WebUI, other OpenAI-compatible apps, the portal chat UI) send only the person's text and
never fill variables. A **required variable without a default makes every chat message fail with `400 invalid_variables`**, so
for an agent that is also used in chat keep its variables optional, or give each one a default.

Values belong to the turn that sends them. A follow-up turn of the same session sends them again (an optional one left out
falls back to its default), and the `Variables` block of a turn stays in that turn's message in the session history, so
sending the same values on every turn repeats the block there.

## Runs

`client.agents.runs` is the canonical surface for jobs: start a turn now, later or at low priority, follow it, cancel it.
Responses, chat completions and A2A are dialects over the same runs.

```typescript
// Hold the call up to 30 s; past that the run is returned as it is (202), never an error.
const run = await client.agents.runs.create(
  'research-agent',
  {
    input: 'Compare these three vendors',
    variables: { region: 'EMEA' },              // the agent's variables, next to the message
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
for await (const r of client.agents.runs.list({ trigger_id: 'trg_1' })) console.log(r.id); // every page

await client.agents.runs.events('run_66f2...', { after: 10 });          // the run's session events (JSON)
for await (const event of client.agents.runs.events.stream('run_66f2...')) { /* SSE, resumes with Last-Event-ID */ }

await client.agents.runs.resolveAction('run_66f2...', 'act_1', { decision: 'allow' }); // a pending approval / question
await client.agents.runs.resolveAction('run_66f2...', 'act_1', { decision: 'allow' }, { background: true }); // returns the queued AgentRun (202)
```

- `create()` returns the `AgentRun`: finished within `wait`, otherwise `queued` / `scheduled` / `running`
  (HTTP `202`). An `Idempotency-Key` is generated when you pass none, so a retried request never starts a second run;
  the same key with a different request is `409 idempotency_key_conflict`. `prefer: { wait, respondAsync }` sends the
  RFC 7240 `Prefer` header. `stream: true` returns an async iterator of `response.*` events instead (the run continues
  when the connection closes, unless `on_disconnect: 'cancel'`; the generated key applies to streams too).
  `wait` is capped by the Console's window (10 minutes by default).
- `wait()` uses the Console's `?wait=` long-poll (one quiet request lasts `waitSeconds`, default 20, capped below the
  client timeout) and resolves with the run for `succeeded`, `failed` **and** `canceled` — and for `requires_action`,
  where the run is paused on an approval or a question and waiting would never end (`run.result.required_action.actions`
  lists what to answer). It throws `AgentRunWaitTimeoutError` (with `lastRun`) when `timeoutMs` elapses and the
  signal's reason when `signal` aborts. Neither stops the run; call `cancel()` for that.
- `cancel()` ends a `scheduled`, `queued` or `requires_action` run at once; a `running` one stops cooperatively (the
  returned run may still say `running` with `cancel_requested_at` for about a second). Canceling a finished run is a `409`
  with `errorCode === 'agent_run_already_terminal'`.
- `list()` filters: `agent`, `status`, `class`, `session_id`, `trigger_id`, `channel`, `trigger`, `metadata` (up to 3 exact pairs),
  `created_after`, `created_before`, `limit` (max 100), `after`. Newest first.

A2A `message/stream` runs the task on the same engine: a client disconnect does not cancel it, and `tasks/resubscribe`
(params `{ id }`) reattaches: the current Task first, then the status and artifact updates until the final status event
(a task that already finished gets its Task and the final status event at once). `tasks/cancel` stops it.

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
  channel?: 'runs' | 'responses' | 'chat_completions' | 'a2a' | 'trigger';
  trigger?: 'request' | 'schedule' | 'once' | 'manual' | 'webhook';  // what started the run
  trigger_id?: string | null;        // the trigger that fired it
  metadata?: Record<string, string> | null;
  stop_reason?: string | null;
  result?: AgentResponse | null;     // Responses-shaped, when finished (or the requires_action response)
  output_text?: string | null;
  output_parsed?: unknown;
  output_error?: string | null;      // why the answer does not fit the schema
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

## Triggers

A trigger starts an agent on its own: on a schedule, once at a set time, by hand, or when an external system posts a webhook.
An agent can have several triggers (a schedule trigger and a webhook trigger, say), and each trigger has **one type**, with
the settings of that type in the sub-object named after it. A trigger saves a prompt (and [variables](#variables)). Every fire is
an ordinary run (`channel: 'trigger'`, `runs.list({ trigger_id })` is the history), unattended: approvals follow the agent's
unattended policy.

| `type` | Settings | Fires |
|--------|----------|-------|
| `schedule` | `schedule`: `cron` (5 fields), `timezone` (IANA, default `UTC`) | on every cron tick |
| `once` | `once`: `run_at` (ISO 8601 or unix seconds, not in the past) **or** `delay_seconds` | once; `run_at` is returned as an ISO string |
| `manual` | none | only with `triggers.run()` |
| `webhook` | `webhook`: `preset`, `auth`, `header_name`, `secret`, `events`, `filter`, `include_payload` | when an authenticated delivery reaches the trigger's URL: [Webhook triggers](#webhook-triggers) |

```typescript
const trigger = await client.agents.triggers.create('report-bot', {
  name: 'Weekday digest',
  type: 'schedule',
  schedule: { cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
  // or type: 'once' with once: { run_at: '2026-12-01T09:00:00Z' } | once: { delay_seconds: 3600 }, or type: 'manual' (no sub-object)
  prompt: 'Summarise yesterday',      // required unless the agent has variables and `variables` gives them
  variables: { team: 'ops' },         // values for the agent's variables
  class: 'deferred',                  // 'default' | 'deferred'
  version: 3,                         // pin a version; omitted / null = the published one
  metadata: { source: 'trigger' },    // copied onto every run
  callback: { url: 'https://example.com/hooks/digest', secret: process.env.DIGEST_SECRET }, // write-only secret
  response_format: { type: 'json_object' },
});

trigger.id;           // a bare id, no prefix
trigger.type;         // 'schedule' | 'once' | 'manual' | 'webhook'
if (trigger.type === 'schedule') trigger.schedule.cron; // only the sub-object named after the type is present
trigger.next_fire_at; // unix seconds (null for manual, webhook and a finished once)
trigger.last_run_id;  // "run_..." of the last fire that started a run
trigger.last_status;  // 'started' | 'failed' | null (with `last_error`)

// An agent can have several triggers: add a webhook trigger next to the schedule one.
await client.agents.triggers.create('report-bot', {
  name: 'On deploy',
  type: 'webhook',
  webhook: { preset: 'generic' },
  prompt: 'Summarise the deploy',
});

await client.agents.triggers.list('report-bot');   // { object: 'list', data: AgentTrigger[], has_more: false }: both
await client.agents.triggers.get('report-bot', trigger.id);
await client.agents.triggers.update('report-bot', trigger.id, { enabled: false }); // PATCH: omitted fields stay
await client.agents.triggers.delete('report-bot', trigger.id);                     // { id, object: 'agent.trigger.deleted', deleted: true }
```

Timestamps are unix seconds, except `once.run_at` (ISO). `create()` answers HTTP `201`. To change the type of a trigger, or
the settings of its type, `update()` takes `type` together with the sub-object. Errors: `400 invalid_trigger`
(`error.response.error.errors` lists `{ field, message }`: a bad cron, timezone or type, a missing prompt, variables that
do not fit the agent, an unknown `version`), `404 trigger_not_found`, `404 agent_not_found`.

### Run now

```typescript
const run = await client.agents.triggers.run(
  'report-bot',
  trigger.id,
  { variables: { team: 'sales' }, metadata: { requested_by: 'anil' } },   // merged over the trigger's variables / metadata
  { wait: 10, idempotencyKey: 'digest-2026-10-17' },                       // idempotencyKey is generated when omitted
);
run.status; // 'succeeded' (HTTP 200) | 'queued' | 'running' (HTTP 202: never an error, follow it with runs.wait)
```

`wait` holds the call up to that many seconds (capped by the Console's window); `prefer: { wait, respondAsync }` sends the
`Prefer` header instead. Errors: `400` `invalid_variables`, `invalid_metadata`, `agent_inactive`; `404 trigger_not_found`;
`409 idempotency_key_conflict` (the key was used by another request); `429` with a `Retry-After` header and
`agent_run_concurrency_limit`, `spend_limit_exceeded` or `agent_quota_exceeded`.

### Webhook triggers

A webhook trigger has a public URL. A sender posts JSON to it, the Console checks the delivery's credentials, applies the
trigger's `events` and `filter`, builds the turn from the trigger's `prompt` and `variables` (templates over the event) and
starts a run. Senders need no API token.

```typescript
const trigger = await client.agents.triggers.create('pr-reviewer', {
  name: 'Review pull requests',
  type: 'webhook',
  webhook: {
    preset: 'github',                                   // github | gitlab | azure_devops | generic
    events: ['pull_request'],                           // event names to accept; empty / omitted = all
    filter: [                                           // all must match
      { path: 'payload.action', op: 'in', value: ['opened', 'synchronize'] },
      { path: 'payload.pull_request.draft', op: 'eq', value: false },
    ],
    include_payload: true,                              // default: append the event payload (JSON) to the message
  },
  prompt: 'Review pull request #{{payload.pull_request.number}} ({{payload.pull_request.html_url}})',
});

if (trigger.type === 'webhook') {
  trigger.webhook.url;     // the URL to give the sender
  trigger.webhook.secret;  // only in the answer that created the trigger (or gave it a new secret): shown once
  // every later read: { url, preset, auth, header_name, secret_hint, secret_source, previous_secret_valid_until, events, filter, include_payload }
}
```

The secret is generated by the Console and shown once, in `webhook.secret` of the answer that created the trigger; afterwards
only `webhook.secret_hint` (its last 4 characters). With `standard_webhooks` the sender generates it: pass the sender's
`whsec_...` as `webhook.secret`. (`AgentTriggerWithSecret` is the type of a webhook trigger that carries its secret.)

| Preset | `auth` (first = default) | The sender sends | Event name | Delivery id |
|--------|--------------------------|------------------|------------|-------------|
| `github` | `github_signature` | `X-Hub-Signature-256: sha256=<hex HMAC-SHA256(secret, body)>` | `X-GitHub-Event` | `X-GitHub-Delivery` |
| `gitlab` | `gitlab_token`, `standard_webhooks` | `X-Gitlab-Token: <secret>` | payload `object_kind`, `event_name`, or `X-Gitlab-Event` | `webhook-id` or `Idempotency-Key` |
| `azure_devops` | `basic`, `header` | Basic auth with the secret as the password, or `header_name` (default `x-cognipeer-token`) | payload `eventType` | payload `id` |
| `generic` | `bearer`, `signature`, `header`, `standard_webhooks` | `Authorization: Bearer <secret>`, a signature (below), or `header_name` | payload `event` or `type`, or `X-Cognipeer-Event` | `X-Cognipeer-Event-Id`, `webhook-id` or `Idempotency-Key` |

**Prompt and variables are templates** (Mustache) over `payload`, `headers`, `event`, `delivery_id`, `preset`, `received_at`,
`trigger` and `agent`. Every value taken from the event is inserted as JSON text (a string comes quoted), and the turn tells
the agent that everything from the event is external data. A variable whose value is exactly one tag (<code v-pre>"{{payload.number}}"</code>)
keeps the value's type. A webhook trigger needs a prompt unless it includes the payload or gives variables.
`filter` rules read `payload.*`, `headers.*` (an allow-list per preset), `event`; ops: `eq`, `neq`, `in`, `not_in`,
`exists`, `not_exists`, `contains`, `starts_with`, `glob`; `*` in a path matches every list item. The `events` list is a
convenience filter on a name the sender (or its header) supplies: conditions that matter belong in `payload.*` filter rules.

**Sign a delivery** (auth `signature`, preset `generic`) with `signTriggerWebhook`, exported from the package root (it
needs no Node.js APIs):

```typescript
import { signTriggerWebhook } from '@cognipeer/console-sdk';

const body = JSON.stringify({ event: 'deploy.failed', service: 'api' });
await fetch(url, {                  // url and secret: `trigger.webhook.url` / `.secret` of the answer that created the trigger
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...signTriggerWebhook(secret, body, { eventId: 'deploy-42' }),
  },
  body, // the exact string that was signed
});
```

It returns `x-cognipeer-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>` (accepted within 5 minutes
of the Console's clock), `x-cognipeer-event-id` (yours, or a random one: the Console treats the same id with the same body
as a duplicate and starts no second run, so reuse yours when retrying) and, with `{ event }`, `x-cognipeer-event`.

**Try it without a sender.** On a webhook trigger `run()` takes a sample `payload` and `headers` and builds the turn the way
a delivery would (the `events` and `filter` checks are not applied, and the sample's own text is never treated as a template).
With `dry_run: true` nothing starts: it answers an `AgentTriggerDryRun`.

```typescript
const dry = await client.agents.triggers.run('pr-reviewer', trigger.id, {
  payload: { action: 'opened', pull_request: { number: 7, draft: false } },
  headers: { 'x-github-event': 'pull_request' },
  dry_run: true,
});
dry.matched;   // does it pass `events` and `filter`? (`dry.reason` says why not)
dry.prompt;    // the message the run would get
dry.variables; // the resolved variables; `dry.errors` lists `{ field, message }` when the turn cannot be built
```

**Rotate the secret** with `rotateWebhookSecret`; `grace_seconds` (0 to 86400, default 0) keeps the current secret
accepted that long, so senders can switch over. Standard Webhooks triggers pass the sender's new `secret`.

```typescript
const rotated = await client.agents.triggers.rotateWebhookSecret('pr-reviewer', trigger.id, { grace_seconds: 3600 });
rotated.secret;                // the new secret, shown once (not returned with standard_webhooks)
rotated.previous_valid_until;  // unix seconds the old one is accepted until
```

**The delivery log** shows what became of each request to the URL (kept 7 days), never its payload:

```typescript
const page = await client.agents.triggers.deliveries('pr-reviewer', trigger.id, { limit: 50 });
for (const d of page.data) console.log(d.received_at, d.outcome, d.http_status, d.event, d.run_id, d.reason);
if (page.has_more) await client.agents.triggers.deliveries('pr-reviewer', trigger.id, { before: page.data.at(-1)!.id });
```

`outcome` is `accepted` (a run started), `duplicate`, `filtered`, `ignored` (a ping, a test, a disabled trigger),
`unauthorized`, `rejected` (a rate or run limit) or `failed`; `reason` is a fixed text such as `signature mismatch` or
`event "x" is not selected`. Errors: `400 trigger_not_webhook` (`rotateWebhookSecret` on a trigger of another type), `400 invalid_limit`.

Webhook subscriptions (`client.webhooks`) receive `trigger.fired` (`data`: `triggerId`, `agentKey`, `trigger` (what started
the fire: `schedule` | `once` | `manual` | `webhook`), `runId`, and `event` for a webhook delivery) and `trigger.failed`
(`triggerId`, `agentKey`, `trigger`, `event?`, `reason`; sent at most once per trigger and reason per hour).

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
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.InvalidVariables)) {
    // 400: `variables` do not fit agent.variables_schema (or a chat call lacks a required one); error.response.error.errors lists the fields
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.SpendLimitExceeded)) {
    // 429: wait `Retry-After` seconds
  } else if (isAgentRunErrorCode(error, AgentRunErrorCodes.Interrupted)) {
    // 503: the run was ended elsewhere (shutdown, lost worker); retry with an idempotency key
  }
}
```

| `errorCode` | Status | Meaning |
|-------------|--------|---------|
| `agent_run_conflict` | 409 | A run is already active on this conversation |
| `agent_run_concurrency_limit` | 429 | Tenant's concurrent run limit reached (or the deferred queue is full); `Retry-After` says when to retry (30 s). A stream is refused before it opens, so this is the call's plain error |
| `spend_limit_exceeded` / `agent_quota_exceeded` | 429 | A spend limit or the plan's agent quota is used up (`Retry-After`, 60 s for the quota); the same on `triggers.run()`. A run uses a quota unit only once it is admitted |
| `agent_run_interrupted` | 503 | The run the call waited on was ended elsewhere (the server shut down, the worker was lost) before it finished; no answer. `retryable` and `side_effects_possible` are both `true` in the body |
| `invalid_json` | 400 | The body of `runs.create()` / `responses.create()` is not a JSON object |
| `invalid_version` | 400 | `version` is not a positive integer, a numeric string or `'draft'` (an unknown version is `404 version_not_found`) |
| `attachment_unreachable` | 400 | A remote file or image URL could not be fetched, or did not arrive within the outbound timeout |
| `agent_inactive` | 400 | The agent (of a run or a trigger) is not active |
| `invalid_trigger` | 400 | A trigger write was refused; `error.response.error.errors` lists `{ field, message }` |
| `trigger_not_found` / `trigger_not_webhook` | 404 / 400 | No such trigger; `rotateWebhookSecret()` on a trigger that is not a webhook trigger |
| `invalid_payload` / `invalid_headers` | 400 | `triggers.run()` sample `payload` is not a JSON object or array / `headers` is not an object of strings |
| `sandbox_secrets_unreadable` | 409 | Saving an agent whose stored sandbox secrets cannot be decrypted (the encryption key changed) with masked values mixed with new ones; enter every secret again to replace them. Until then reads of the agent's sandbox config carry `sandbox.secretsUnreadable: true` with an empty secrets list, and the sandbox tools run without secrets and say so in their result |
| `idempotency_key_conflict` | 409 | `Idempotency-Key` reused with a different request |
| `invalid_variables` | 400 | `variables` do not fit the agent's `variables_schema`: a required one is missing (also on a chat call, which never sends them), a wrong type, a value outside the allowed ones (`errors: [{ field, message }]`) |
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

When the run finishes, the Console POSTs JSON (`{ id, event, createdAt, runId, sessionId, conversationId, data }`) to
`callback_url` with:

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
