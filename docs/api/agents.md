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

The `202` from `create({ background: true })` carries only `id`, `object`,
`status` and `created_at`; `runs.get()` returns the full shape.

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
| `action_not_found` / `session_not_found` | 404 | No such action / conversation in this project |
| `action_not_pending` | 409 | The action was already answered or cancelled |
| `pending_action` | 409 | A new message was sent while approvals/questions are open |
| `action_expired` | 410 | The approval request ran out of time |
| `action_forbidden` | 403 | The agent's approvers setting does not allow this caller |
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

## Approvals, Sessions and Webhooks

A turn can pause for a tool approval or a question (`status: 'requires_action'`
with `required_action`, or a run in `requires_action`). `client.agents.sessions`
reads the conversation's runtime state (`get`), answers actions
(`actions.resolve`), pages or follows the event log (`events.list`,
`events.stream`), changes the session budget (`update`) and handles session files
(`files`).
`client.webhooks` manages event subscriptions. See the
[README](https://github.com/Cognipeer/console-sdk#approvals-and-questions-human-in-the-loop)
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

## See Also

- [Agents API (Gateway)](https://cognipeer.github.io/cognipeer-console/api/agents)
- [Tools API](/api/tools) — Tools that can be bound to agents
- [Client Reference](/api/client)
