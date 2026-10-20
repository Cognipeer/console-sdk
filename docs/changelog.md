# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-10-17

The agent platform release: runs, triggers (schedule, once, manual and webhook; an agent can have several) and the
OpenAI dialects over one engine. Needs the Console
release that ships the agent runs API (`/client/v1/agents/{key}/runs`, triggers, `/client/v1/responses` for
agents with the published version by default). `client.automations` (built-in automations) is unchanged.

### Added

- **Agent reminders.** `client.agents.sessions.reminders.list(sessionId, { status?: 'active' | 'all' })` and
  `.cancel(sessionId, reminderId)` (`AgentSessionRemindersResource`); types `AgentReminder`, `AgentReminderStatus`,
  `ListAgentRemindersQuery`, `AgentReminderList`. `AgentRunChannel` gains `'reminder'`; the `user.message` session
  event may carry `origin: 'reminder'` and `session.status_running` `trigger: 'reminder'`.
- **Sandbox env from Config.** `SandboxCreateRequest.envRefs` / `groupRefs` take sandbox variables from Config (one item
  per variable, or whole groups) instead of typed values; new `ConfigValueRef` / `ConfigGroupRef` types.
- **Inline browser screenshots.** `client.browserSessions.screenshot(key, { inline: true })` returns the image as a
  base64 content block (`BrowserScreenshotInlineResult`); `persist: false` skips saving it. New types
  `BrowserContentBlock` and `BrowserScreenshotInlineResult`. Calls without `inline` are unchanged.

### Breaking changes

- **`client.agents.chat()` is removed.** Use `client.agents.responses.create({ model, input })`
  (`res.output_text`, `res.conversation.id` for the session).
- **Agents run the published version by default** on `agents.responses.create()` (the draft only when
  nothing was ever published). Pin with `version: 3`, run the draft with `version: 'draft'`.
- **`responses.create()` never returns an `AgentRun`.** `background: true` and a turn past the Console's
  wait window answer HTTP `202`, and the SDK returns the `AgentResponse` with `status: 'queued' | 'in_progress'`
  (`cognipeer.run_id` is the run to follow). The `AgentBackgroundResponseCreateRequest` type is removed.
- **Agent request type** (`AgentResponseCreateRequest`) drops `instructions`, `temperature`, `top_p` and
  `max_output_tokens`: the agent's own configuration applies (the Console ignores them and lists them in
  `X-Cognipeer-Ignored-Params`). `version` is `number | 'draft'`.
- **Response ids are `resp_<runId>`.** The session is `res.conversation.id` / `res.cognipeer.session_id`; do not
  strip a `resp_` prefix to get it. `AgentResponse.status` is now
  `queued | in_progress | completed | incomplete | failed | cancelled | requires_action`.
- **`responses.cancel(id)`** posts to `/client/v1/responses/{id}/cancel` and returns the `AgentResponse`
  (was `{ id, conversation_id, cancelled, run_ids }` from `/agents/responses/{id}/cancel`). `AgentResponseCancelResult`
  is removed. `sessions.cancel()` uses `/client/v1/agents/sessions/{id}/cancel` and answers
  `{ object: 'agent.session.cancel', session_id, cancelled, run_ids }` (`conversation_id` is gone; `run_ids` are `run_<id>`).
- **`AgentResponse.output`** is `(ResponseReasoningItem | ResponseOutputMessage)[]`: the reasoning item comes first when
  the agent shows its reasoning. `usage` is `null` until the turn has an answer; `error` is `{ code, message }`.
- **`ModelList.models`** (the registry rows) is always present; an agent entry's `description` is always a string.
- **`AgentRunCallbackEvent`** carries `sessionId` and `conversationId`; the never-sent `tenantId` / `projectId` are removed.
- **`runs.wait()`** uses the `?wait=` long-poll instead of 1 s polling: `pollIntervalMs` is now the smallest gap
  between polls, `waitSeconds` sets one poll's length (default 20, capped below the client timeout).
- **`AgentRun`** has the new run shape (`class`, `version`, `session_id`, `channel`, `trigger`, `trigger_id`,
  `metadata`, `output_text`, `output_parsed`, `scheduled_for`, `detached_at`); `AgentRunStatus` gains `scheduled`.
- **Removed:** error codes `agent_background_disabled` (`AgentActionErrorCodes.BackgroundDisabled`),
  `idempotency_key_sync_not_supported` and the sync `timeout` 504 (`AgentRunErrorCodes.SyncTimeout`,
  `IdempotencyKeySyncNotSupported`: a turn past the window is a `202` now); webhook events `schedule.fired` /
  `schedule.failed` and the `WebhookScheduleEvent` type (replaced by `trigger.fired` / `trigger.failed`).
- Removed the orphan JS Sandbox comment and `examples/js-sandbox-basic.ts` (`client.jsSandbox` no longer exists).
- **`client.browserMcp` is removed**, with `BrowserMcpResource` and the `BrowserMcp*` types: the Console no longer serves
  a per-browser MCP endpoint (`/browser/:browserKey/mcp/*`). Publish the browser from the Console's MCP module (**MCP
  Servers → New server → Internal service → Browser**) and use `client.mcp.server(serverKey)`; `browser_open_session`
  returns the `sessionKey` every page tool takes.

### Added

- **`client.agents.runs`**: `create(agentKey, body, options?)` (`wait`, `class: 'default' | 'deferred'`, `run_at` /
  `delay_seconds`, `variables`, `response_format`, `callback`, `metadata`, `session_id`, `version`, `stream`; the
  `Prefer` header via `options.prefer`; an `Idempotency-Key` is generated when none is given), `list(query)`
  (OpenAI list envelope, `AgentRunPage` with `getNextPage()` and async iteration), `get(id, { wait })`, `cancel(id)`,
  `wait(id)`, `events(id)` / `events.stream(id)` (SSE with resume), `queue()`, `resolveAction(runId, actionId, body)`.
- **`client.agents.triggers`**: `list`, `create`, `get`, `update`, `delete`, `run(agentKey, triggerId, body?, options?)`.
  A trigger starts an agent with a prompt on its own: on a cron schedule (+ IANA timezone), once, by hand, or on a
  **webhook**. An agent can have several triggers; each has one `type` (`schedule`, `once`, `manual`, `webhook`) and the
  settings of that type in the sub-object named after it (`schedule`, `once`, `webhook`). `list()` returns the list
  envelope `{ object: 'list', data, has_more }`, ids are bare (no prefix), timestamps unix seconds (only `once.run_at` is
  ISO), `delete()` answers `{ id, object: 'agent.trigger.deleted', deleted: true }`. Each fire is a run
  (`channel: 'trigger'`, `runs.list({ trigger_id })`). `run()` answers the run (`200`, or `202` while it goes), takes `wait`
  in the call options, and an `Idempotency-Key` is generated when none is given; `429` carries `Retry-After`.
- **Webhook triggers** (`type: 'webhook'`, `webhook: { preset, auth, events, filter, include_payload }`; presets `github`,
  `gitlab`, `azure_devops`, `generic`): a new trigger comes back with `webhook.secret` (shown once;
  `AgentTriggerWithSecret`); `triggers.rotateWebhookSecret(agentKey, triggerId, { grace_seconds?, secret? })`;
  `triggers.deliveries(agentKey, triggerId, { before?, limit? })` (the delivery log);
  `triggers.run(..., { payload, headers, dry_run })` builds the turn from a sample event, or with `dry_run: true`
  answers an `AgentTriggerDryRun` and starts nothing.
- **`signTriggerWebhook(secret, body, { timestamp?, eventId?, event? })`**, exported from the package root (no Node.js
  APIs): the `x-cognipeer-signature` / `x-cognipeer-event-id` / `x-cognipeer-event` headers for a webhook trigger with
  auth `signature`. Tested against the Console's verifier.
- **Variables**: an agent's declared variables are sent as `variables` next to the message (`runs.create()`,
  `responses.create()`, chat completions, `triggers.create()` / `update()` / `run()`) and published as
  `Agent.variables_schema`; a missing required value or a wrong type is `400 invalid_variables`
  (`AgentRunErrorCodes.InvalidVariables`). Best for runs a program starts (the runs API, triggers, n8n / CI, an agent called
  as a tool); chat clients never send them, so a required variable without a default fails every chat call. The README
  and the Agents API page (Variables) explain it.
- **`responses.create({ stream: true })`** returns an async iterator of typed `response.*` events
  (`AgentResponseStreamEvent`, `isResponseStreamEvent`); `responses.retrieve(id)`.
- Request fields on agent responses: `text.format` (structured output), `metadata`, `service_tier`, `variables`,
  `background`, `callback_url` / `callback_secret`, `stream`, `store`; `input_file.file_url`.
  `AgentResponse` gains `output_text`, `output_parsed`, `output_error`, `output_files`, `error`, `metadata`,
  `text`, `service_tier`, `background` (also reported by `retrieve()` for a run started with `background: true`,
  streamed or not), `conversation`, `cognipeer.run_id` / `session_id`; `isAgentResponseFinal()`. Stream events include
  the reasoning summary events (`response.reasoning_summary_*`), `response.incomplete` (a limit or a cancelled run) and
  `response.failed`; the `error` event carries `error_type`.
- **`client.models.list()`** typed with the project's models and its active agents (`id: 'agent:<key>'`,
  `cognipeer.kind === 'agent'`; `isAgentModelEntry`).
- **Chat completions**: `response_format`, `stream_options.include_usage`, `service_tier`, `metadata`, `variables`,
  `conversation_id`; per-call `{ sessionId, idempotencyKey, signal }`; the `202` body (`choices: []`,
  `cognipeer.status` `queued | in_progress`, `run_id`, `session_id`), `output_files` / `stop_reason` / `stop_detail`
  and the usage chunk are typed.
- `ReasoningEffort` accepts `xhigh` and `max`. `Agent.variables_schema` / `output_schema`. `Agent.attachments.outputs`
  (`enabled`, `max_files_per_turn`, `max_file_size_mb`, `types`): files the agent writes for the person work with uploads
  off when the agent has an attachments bucket. `AgentConfig.sandbox.secretsUnreadable`: stored sandbox secrets that can
  no longer be decrypted (see `AgentConfigErrorCodes.SandboxSecretsUnreadable`, `409 sandbox_secrets_unreadable`).
- `runs.create({ stream: true })` sends an `Idempotency-Key` like every other run call (the Console accepts it on streams);
  `runs.resolveAction()` takes `{ background: true }` and answers the queued run; `runs.list({ trigger })` (a run's
  `trigger` is also `webhook`); `AgentRun.output_error`.
- Webhook events `trigger.fired`, `trigger.failed` and `feedback.recorded` (typed, in `WEBHOOK_EVENT_TYPES`; trigger
  events carry `triggerId`, `agentKey`, `trigger` (what started the fire), `runId` / `reason`, `event`); `agent_run.*` event
  data carries `sessionId`, `status`, `class`, `metadata`, `triggerId`. `verifyAgentRunCallback` and the callback types are
  unchanged.
- Error codes `invalid_variables` and `invalid_response_format`, `spend_limit_exceeded`, `agent_quota_exceeded` and
  `agent_inactive` (`AgentRunErrorCodes`); run error reasons `expired` and `interrupted`.
- Error codes `agent_run_interrupted` (503: the run a waiting call is attached to was ended elsewhere; retry with an
  idempotency key), `invalid_json`, `invalid_version` and `attachment_unreachable` (`AgentRunErrorCodes.Interrupted`,
  `InvalidJson`, `InvalidVersion`, `AttachmentUnreachable`). Note the client retries a `503` on its own unless the body
  says `retryable: false`.
- `ChatCompletionRequest.version` (`number | 'draft'`) pins an agent version on `/chat/completions`.

### Changed (platform fixes, no API change)

- `ResponseUsage` always carries `input_tokens_details.cached_tokens` and `output_tokens_details.reasoning_tokens`
  (both required in the type; `0` when not reported, and `reasoning_tokens` is `0` for agents).
- `ModelList`: a token that can read agents but not models lists the agents only (`models: []`, no providers).
- A stream that would exceed the concurrency cap or the agent quota is refused with a plain `429` before it opens
  (`Retry-After` 30 s for the cap, 60 s for the quota); concurrency `429`s carry `Retry-After` on every call.
- `AgentResponse.background` reports what the request asked for (a flex call reads `false`); `reasoning` applies to
  runs that execute inside the request only; `accepts_images` is `false` while uploads are off.
- `AgentRunCallbackEvent.id` is `evt_<runId>_<event>` for the first delivery and gets a `_<generation>` suffix for
  later generations of a run; `runs.resolveAction()` answers `resp_<runId>` for pending and resumed outcomes;
  `runs.cancel()` of a paused run ends it as `canceled` with `canceled_by_caller`.


## [3.2.0] - 2026-10-14

### Added

- `client.agents.sessions.cancel(conversationId)` -> `POST /client/v1/agents/conversations/:id/cancel`,
  result `{ conversation_id, cancelled, run_ids }`.
- `client.agents.responses.cancel(responseId)` -> `POST /client/v1/agents/responses/:id/cancel`
  (`resp_<conversationId>` or `run_<runId>`), result `{ id, conversation_id, cancelled, run_ids }`.
- Request fields `agent_model`, `reasoning_effort`, `reasoning` on agent responses and chat
  completions, and `include_reasoning` on agent responses; `Agent.models` (model choices),
  `AgentConfig.showReasoning`, and `cognipeer.agent_model` on responses.

### Changed

- Docs that pointed to `runs.cancel()` for stopping a turn now point to `sessions.cancel()` /
  `responses.cancel()`.

## [3.1.0] - 2026-10-11

Agent sessions: starting, listing and deleting sessions, continuing one by id, files that live in a
Document Store bucket, approvals and questions (human in the loop), the session event log, and webhook
subscriptions. Additive: nothing in 3.0.0 changes behaviour, except that `agents.runs.wait()` now
also returns a run that is `requires_action` (see Changed). The approvals/events/actions calls need
a Console with the agent runtime phase 1 release; the sessions and session-file calls below need the
Console release that ships the sessions API and session files on buckets. Every request and response shape was checked
against that Console's `/api/client/v1` routes (agent family: snake_case, including pending
actions, event `data`, budgets and error fields; webhooks: camelCase, wrapped in
`{ endpoint }` / `{ endpoints }` / `{ delivery }` / `{ deliveries, hasMore }`).

### Added

- **`client.agents.sessions`**
  - `create({ agent, title?, metadata?, budget?, runtime_context? })` — start a session without
    sending a message (201; `runtime_status: 'idle'`, no messages; nothing runs and nothing is
    spent). Upload files to it first, then send the first message with `session_id`. The same agent
    and budget rules as a first Responses turn (`400 agent_not_active` / `invalid_metadata` /
    `invalid_budget`, `403 budget_override_forbidden`, `404 agent_not_found`).
  - `list({ agent?, status?, limit?, after? })` — the project's sessions, newest first, as a page
    **and** an async iterator: `await list()` resolves to an `AgentSessionPage` (`data`,
    `has_more`, `next_cursor`, `hasNextPage()`, `getNextPage()`), `for await (const s of list())`
    walks every page lazily. Rows are summaries (`message_count`, no transcript or
    `pending_actions`). `400 invalid_limit` / `invalid_status` / `invalid_cursor`.
  - `delete(conversationId)` — delete a session with its files, events and open actions
    (`{ id, object: 'agent.session', deleted: true }`; `409 agent_run_conflict` while a run is active).
  - `get(conversationId)` — runtime state: `runtime_status`, `stop_reason`, `pending_actions`,
    `last_event_seq`; also `title`, `created_at`, `updated_at` and `metadata` (the pairs given to
    `create()`).
  - `actions.list(conversationId)` (the pending actions, read from `get()`) and
    `actions.resolve(conversationId, actionId, body, { background?, signal? })` — answer a tool
    approval (`{ decision, comment?, approved_args?, remember_for_session? }`) or a question
    (`{ answers }` / `{ cancelled: true }`). Returns the continuation in the Responses shape, or the
    queued `AgentRun` with `background: true`.
  - `events.list(conversationId, { after?, types?, limit? })` and `events.stream(conversationId,
    { after?, types?, signal?, maxReconnects?, reconnectDelayMs?, maxReconnectDelayMs?,
    idleTimeoutMs? })` — an async iterator over the SSE log that reconnects with `Last-Event-ID`
    (bounded retries, idle-stall detection, no repeated or skipped persisted events), yields live
    `agent.message.delta` chunks, and throws the abort reason when `signal` aborts.
  - `update(conversationId, { budget, resume })` — set, raise or remove (`null`) a session spend
    budget (`budget` is required, `{ max_cost_usd, on_reach }`); may answer 202 with the queued
    `AgentRun` that continues a `budget_paused` session. `budget` is also accepted by `responses.create()` when it starts a conversation.
  - `files.upload / list / delete` — files the agent can read; `upload` sends the raw bytes
    (`POST`, `Content-Type: <mime>`, `?name=`; a JSON mime type goes out as
    `application/octet-stream` because the route reads JSON bodies as a base64 envelope).
    `input_file` (`file_id` or inline `file_data`) / `input_image` parts are accepted in
    `ResponseInputItem.content`. A `SessionFile` now says where it is stored: `bucket_key` (the
    Document Store bucket of the agent's Files setting) and `path`
    (`<folder>/<agentKey>/<sessionId>/<unique name>`).
  - `files.content(sessionId, fileId, { variant?, signal? })` and `files.contentStream(…)` — download
    a session file (`GET …/files/{fileId}/content`): `{ data, contentType, fileName? }` buffered, or
    `{ body, contentType, fileName?, size? }` as a stream. `variant: 'original'` (default) or
    `'markdown'` (the text the agent reads). Needs a Console that serves the content route.
- **`responses.create({ session_id })`** (alias `conversation`: a string or `{ id }`, OpenAI style) —
  continue a session by id, the way `previous_response_id` does, for a session that has no response
  yet (one from `sessions.create()`). Give one of `session_id`, `conversation` and
  `previous_response_id`, or several that agree: `session_id` / `conversation` naming a different
  session than `previous_response_id` is `400 session_conflict` (the two of them disagreeing with
  each other is `400 invalid_request`), a session of another agent or project `404 session_not_found`. `file_id` input parts work with any of
  the three; `budget` is ignored on a continued session, as with `previous_response_id`.
- **`Agent.attachments`** on `agents.get(key)` (`AgentAttachmentsInfo`: `enabled`, `max_files`,
  `max_file_size_mb`, `allowed_mime_types`, `accepts_images`) — whether the agent takes files right
  now (files on AND a usable bucket), its limits, and whether its model reads images (an image sent
  to a text-only model is replaced by a note).
- Error codes in `AgentActionErrorCodes`: `ActionCancelled` (`action_cancelled`, 409: the request was
  cancelled before it was answered; `NotPending` now means answered), `AuthorizationUnavailable`
  (`authorization_unavailable`, 503), `MarkdownUnavailable` (`markdown_unavailable`, 409: a markdown
  variant of a file without a text version), `SessionConflict` (`session_conflict`),
  `StorageUnavailable` (`storage_unavailable`, 409: the agent's bucket cannot take a file; the
  message names it), `StorageNotConfigured` (`storage_not_configured`, 409), `AttachmentsDisabled`
  (`attachments_disabled`, 403: files off for the agent, or on with no bucket) and `BucketInUse`
  (`bucket_in_use`, 409, from the Files management API: a bucket agents keep session files in cannot
  be deleted or disabled; no call of this SDK raises it). `SessionNotFound` also covers a
  `session_id` of another agent or project.
- Files API: `files.list(bucket, { prefix, purpose })` browses one folder (the answer adds `folders`
  and `prefix`) and filters to agent session files (`purpose: 'conversation'`) or the rest
  (`'other'`); `FileObject` gains `purpose`, `conversationId`, `agentKey`, `expiresAt`, `uploadedBy`
  for session files. New types: `ListFilesResponse`.
- Types: `AgentSessionCreateRequest`, `ListAgentSessionsQuery`, `AgentSessionStatusFilter`,
  `AgentSessionSummary`, `AgentSessionList`, `AgentSessionDeleted`, `AgentSessionPage` (class),
  `AgentSessionListCall`, `AgentAttachmentsInfo`, `SessionFileContent`, `SessionFileContentOptions`,
  `SessionFileContentStream`.
- `HttpClient.requestBinary()` also returns the response `headers` (for metadata that rides there,
  such as the file name of a download).
- `client.webhooks` — `create`, `list`, `get`, `update`, `delete` (answers `{ deleted: true }`),
  `rotateSecret`, `test`, `deliveries` (answers `{ deliveries, hasMore }`, pages with `skip`),
  `redeliver` and `eventTypes`. The signing secret is returned by `create` and `rotateSecret` only.
  Webhook objects keep camelCase field names. Managing them is the Console permission engine's call and
  nothing else: `webhooks.read` for `list` / `get` / `deliveries` / `eventTypes` and `webhooks.admin` for
  every call that changes something (owners and admins hold it by default; being a project admin is no
  longer enough on its own); a caller with only `webhooks.read` sees each endpoint `url` with its
  userinfo and query string removed (`https://host/path?…`); a refusal is `403 forbidden` with a
  `decisionId`, and `503 authorization_unavailable` means the engine could not decide (never an allow).
- **`verifyWebhook`** in `@cognipeer/console-sdk/webhooks` — the generic check for any signed
  delivery (`X-Cognipeer-Signature: t=…,v1=…`, same scheme as agent-run callbacks), with the
  `WebhookEvent` types. `verifyAgentRunCallback` and `VerifyAgentRunCallbackParams` still work
  (`verifyAgentRunCallback` now delegates to `verifyWebhook`).
- Types: `PendingAction` (`tool_approval` / `user_question`), `ToolApprovalResolution`,
  `UserQuestionResolution`, `ResolveActionBody`, `AgentSession`, `SessionEvent` (the documented
  event types plus an unknown-type fallback), `SessionStreamEvent`, `isSessionEvent()`,
  `AgentSessionBudget`, `SessionFile`, `WebhookEndpoint`, `WebhookDelivery`, `WebhookEvent`,
  `WEBHOOK_EVENT_TYPES`, `AgentActionErrorCodes` / `isAgentActionErrorCode()`, `isAgentRunSettled()`.
- `AgentResponse.status` gains `incomplete` and `requires_action`, with `required_action`
  (`{ type: 'agent_actions', actions }`), `stop_reason`, `stop_detail` and `incomplete_details`.
  `AgentRunStatus` gains `requires_action` and `AgentRun` gains `stop_reason`; callbacks gain the
  `agent_run.requires_action` event.
- `HttpClient.requestRaw()` — a request whose body is sent as raw bytes under a caller-chosen
  `Content-Type`.

### Changed

- `AgentSession` (and the new `AgentSessionSummary`) carries `title`, `created_at`, `updated_at` and
  `metadata`; `SessionFile` carries `bucket_key`, `path` and `content_url`. These are response fields the
  Console always sends, so they are required in the types: code that builds these objects by hand (test
  doubles) needs the new fields. `WebhookEndpoint.urlRedacted` (optional) is `true` when the caller may
  not read the whole URL and `url` is the shortened form.
- Documentation: a file for `input_file` / `input_image` is named with `session_id`, `conversation` or
  `previous_response_id`; answering an approval is the Console's `agent.approve` permission
  (`403 action_forbidden`).
- `agents.runs.wait()` returns when the run reaches `requires_action` (it is waiting on a person,
  so polling would never end), in addition to `succeeded` / `failed` / `canceled`. Check
  `run.status`. `isAgentRunTerminal()` is unchanged: `requires_action` is not terminal.
- Type widening: `AgentResponse.status` is no longer limited to `'completed' | 'failed'`; an
  exhaustive `switch` over it needs the new cases.
- `agents.chat()` (legacy) adds `status` and `pendingActions` to its result when the turn did not
  complete, so a paused agent (`requires_action`, empty `content`) is no longer indistinguishable
  from an empty answer. A completed turn keeps the exact old shape.

### Fixed

- `CognipeerAPIError.errorCode` is read from the top-level `code` when `error` is just the message
  string (`{ error: 'Webhook not found', code: 'not_found' }`, the shape of the webhook routes), so
  `not_found`, `forbidden`, `limit_reached`, `endpoint_disabled` and `delivery_pending` are no longer
  lost. `error.code` still wins when both are present.
- The `User-Agent` header carried a stale `@cognipeer/console-sdk/1.1.0`; it now sends the package
  version (it shows in the Console's audit log).
- Stale doc comments: the `202` of `responses.create({ background: true })` is the full `AgentRun`
  (not just `id` / `object` / `status` / `created_at`); `CreateWebhookRequest.projectId` — a client
  token can only create a webhook for its own project; `UserQuestionPendingAction` has no `tool_name`.

## [3.0.0] - 2026-10-07

Realtime: the SDK now speaks the Console's realtime voice-engine protocol (v2) and the v1 surface
is gone, so this release needs a Console with the realtime voice engine. Everything outside
`client.realtime` is unchanged. The lists below are relative to 2.1.0.

### Removed (breaking)

- `realtime.twilioStreamUrl(model)` — the API-key Twilio route
  (`/realtime/twilio?api_key=…&model=…`) is gone. Media-stream URLs
  (`/realtime/twilio/stream/<token>`) are minted by the Console for inbound webhooks and
  `calls.create()`.
- `tts_format` on `RealtimeSessionUpdate`, `CreateRealtimeModelRequest` and `RealtimeModel` — use
  `output_audio_format`.
- Container audio. `input_audio_format` took a MIME type (`audio/webm`, `audio/wav`…) and TTS could
  answer in `mp3`, `opus`, `aac`, `flac`, `wav` or `pcm`. Both directions are now raw
  `'pcm16' | 'g711_ulaw' | 'g711_alaw'` (`RealtimeAudioFormat`, `RealtimeOutputAudioFormat`), and
  `RealtimeSessionUpdate.input_audio_format` is typed accordingly.
- Preset fields `input_audio_format`, `tts_format`, `turn_silence_ms`, `turn_silence_threshold` and
  `greeting` (view, create and update). Turn taking is `turn_detection`; the greeting is
  `first_message`.

### Changed (breaking)

- **`connect()` resolves when the Console has created the session** (`session.created`), not when
  the socket opens. The server accepts the upgrade first and checks the key, the preset and the
  agent afterwards, so 2.1.0 resolved a connection that was about to be closed (`4401`) for an
  invalid or unscoped key, a disabled preset or an unknown agent. It now rejects with the server's
  reason (or the close code), and gives up after `connect({ timeoutMs })` (default 30 s, `0` = wait
  forever). The initial `session.update` is still sent when the socket opens; the server holds it
  while it authenticates. `session.created` has been handled by the time `connect()` resolves —
  read `connection.session` instead of listening for it — while what the server sends right behind
  it (the echo of the initial `session.update`, a text greeting) is delivered to the listeners you
  attach straight after `await connect()`.
- **`connect()` sends the API key as an `Authorization: Bearer` header** when the WebSocket
  implementation can set upgrade headers — the `ws` package (imported with `import` or `require`),
  Node >= 22's global `WebSocket`, Bun — instead of always using `?api_key=`. Browsers keep the
  query fallback. The Console only accepts `?api_key=` from tokens scoped to the realtime service,
  so a tenant's full-scope token must go in the header. Override with
  `connect({ auth: 'header' | 'query' })`; add upgrade headers with `connect({ headers })`.
  A session needs **write** access to the realtime service, and a caller that picks its own
  generator — `connect({ agent })`, a raw chat model key, or a `session.update` switching `model`,
  `agent_key` or `agent_version` — also needs `agents` / `models` write: a token scoped to realtime
  alone can run presets only.
  `connect()` also attaches its listeners before the socket opens (no missed `session.created`),
  sets `binaryType = 'arraybuffer'` on Blob-defaulting sockets, and rejects when the socket closes
  before it opens.
- **`respond()` answers its own message.** It sends one `response.create { input }` and follows the
  first response created after the server echoes that user item, so a greeting (running, or
  starting on connect right after the call) or a voice turn is ignored — 2.1.0 took the first
  `response.output_text.done` / `response.done` of any response. It resolves
  `{ text, audio?, responseId? }`; `audio` is the response's raw bytes (JSON and binary transport)
  joined and base64-encoded once, where 2.1.0 concatenated the base64 text of each delta. It rejects
  when the response fails or is blocked, on an error its own request raised (audio and speech errors
  — `tts_failed`, `invalid_audio`, `transcription_failed`… — are ignored: a sentence whose speech
  failed does not fail the response), when the socket closes or `close()` is called, and after
  `timeoutMs`; a call on a closed connection no longer leaves its timer running.
- `WebSocketLike.send` takes `string | ArrayBufferLike | ArrayBufferView` and `WebSocketLike` has an
  optional `binaryType`: a custom implementation passed to `connect({ webSocket })` must accept
  binary frames. `WebSocketConstructorLike` takes the optional second constructor argument.
- Server defaults (documented): `pcm16` @ 24 kHz in and out (`audio/webm` in before),
  `turn_detection: { type: 'semantic_vad' }` (`null` = push-to-talk), and agent sessions — presets
  and `{ agent }` alike — run the **published** version (`{ agent }` sessions ran the draft).
- Preset views: the voice-engine fields are always present (`null` when unset) except
  `turn_detection`, which is absent when the preset does not set it (`null` only means manual
  commit), so `models.update(id, { ...retrieved })` keeps server VAD. `agent_version` is `published`
  for agent presets without a stored version.

### Added

- **Binary audio input** — `connection.sendAudio(audio)` sends raw `pcm16` / G.711 bytes as a binary
  WebSocket frame (no base64). Accepts `Buffer`, `Uint8Array`, `ArrayBuffer` and any typed array;
  `Int16Array` goes out as s16le, `Float32Array` (Web Audio samples) is converted to `pcm16`.
  `appendAudio()` (base64 JSON) accepts the same inputs.
- **Decoded audio output** — `connection.onAudio(cb)` delivers `RealtimeAudioChunk`s from both JSON
  `response.audio.delta` and binary frames (`audio_transport: 'binary'`): raw `bytes`, decoded `pcm`
  (`Int16Array`, G.711 included), `sampleRate`, `contentType`, response id and sentence text. Binary
  frames are decoded with the format and rate their response started with.
- **Typed session config** (`RealtimeSessionUpdate`): `input_audio_sample_rate`,
  `output_audio_format`, `output_audio_sample_rate`, `audio_transport`, `turn_detection`
  (`semantic_vad` / `server_vad`, thresholds, eagerness, interrupt settings),
  `input_audio_transcription`, `stt_mode`, `first_speaker`, `first_message`, `wait_for_user_ms`,
  `variables`, `agent_version`, `tool_wait_audio`.
- **Typed server events** — `connection.on(type, cb)` infers the payload from
  `RealtimeServerEventMap`, including `session.ended`, `input_audio_buffer.speech_started` /
  `speech_stopped`, `output_audio_buffer.cleared`, `response.audio_transcript.delta`,
  `response.metrics` (per-turn latency: turn detection, STT, LLM first token, TTS first byte, e2e —
  every field optional: `e2e_ms` / `total_ms` exist only for a turn that followed detected user
  speech, not for the agent's greeting, typed text or a push-to-talk commit, and `llm_*` are absent
  for a static first message) and `conversation.item.input_audio_transcription.delta`.
- **Connection lifecycle** — `connection.onClose(cb)` and `connection.closed` report how a
  connection ended (`4401` unauthorized, `4402` license required — no active ENTERPRISE license —,
  `1013` server busy — the node is at its live-session cap, try again shortly —, `1009` too much
  data, `1011` server error, a network drop) instead of failing silently; `connect({ timeoutMs })`.
  Before the session exists the server sends an `error` event with the matching code
  (`unauthorized`, `license_required`, `server_busy`) and `connect()` rejects with it; on a running
  session `forbidden` (a `session.update` switched agent, model or agent version without the
  permission to) and `event_too_large` (a non-audio event over 256 KB) leave the socket open.
  `forbidden` never fails a pending `respond()`.
- **First message & variables** — `connect({ session, variables, firstSpeaker, firstMessage })`
  sends them in one initial `session.update`; `connection.startFirstMessage()`,
  `connection.setVariables()`, `createResponse({ input, first_message })`.
- `connection.reportPlayback(responseId, playedMs)` (`output_audio_buffer.played`) and the
  `connection.session` getter — `RealtimeSessionView` mirrors the server echo: `variable_keys`
  (names only — values are never echoed), `degraded` (why server turn detection runs below full
  quality; re-sent in `session.updated` when it changes), and the effective `turn_detection` /
  `first_message` views with every field present.
- **Telephony calls** — `client.realtime.calls.create({ to, model, connection?, ring_timeout_sec?,
  machine_detection?, … })`, `.get(sessionId, { refresh? })` (`refresh: true` asks Twilio for the
  live state, recovering a call whose status callback was lost) and `.hangup(sessionId)`
  (`/api/client/v1/realtime/calls`), all returning the server's `RealtimeCall` view.
  `calls.create` answers `session_status: 'pending'` with `started_at` set, and honours
  `first_message.interruptible` (a per-call message that does not set it keeps the preset's value).
- Presets (`RealtimeModel`, `CreateRealtimeModelRequest`): `turn_detection`, `stt_mode`,
  `stt_language`, `stt_prompt` (STT vocabulary / spelling hints — brand and product names, max 1000
  characters), `first_speaker`, `first_message`, `wait_for_user_ms`, `interrupt_min_ms`,
  `agent_version`, `output_audio_format`, `tool_wait_audio` and `telephony`
  (`RealtimeModelTelephonyView`). `UpdateRealtimeModelRequest` accepts `null` to clear an optional
  field (`{ voice: null }`; `{ turn_detection: null }` = manual commit), and accepts what
  `models.retrieve()` returns, so `models.update(id, { ...retrieved, name })` compiles and works
  as is: the `null` sub-fields of the `first_message` / `telephony` views
  (`UpdateRealtimeFirstMessage`, `UpdateRealtimeModelTelephony`), the `turn_detection` view, a `null`
  `chat_model_key` / `agent_key` (ignored) and the read-only keys (`id`, `object`, `created_at`,
  `updated_at`; ignored). `first_message` and `telephony` merge into the stored setting sub-field
  by sub-field (a `null` removes one key); `turn_detection` replaces the whole setting (an object
  without `type` = `semantic_vad`).
- `url()` accepts `firstSpeaker`, `variables` and `includeApiKey`; `float32ToPcm16` /
  `pcm16ToFloat32` helpers.
- `docs/api/realtime.md` is now a full protocol reference (events, audio formats, turn detection,
  first message, connecting and closing, telephony, latency metrics, Twilio setup and trial-account
  notes).

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

## [1.5.0] - 2026-07-14

### Added
- Aegis API (`client.aegis`, Enterprise) — enforcement-plane policy evaluation: `evaluate()` returns an `allow`/`redact`/`require_approval`/`sandbox`/`block` decision with findings, risk score and a sanitized resource; `shields.list()` and `shields.audit(shieldId)` read the enforcement instances and their decision trails. Shields are configured in the Console dashboard (`/dashboard/aegis`).

## [1.4.1] - 2026-07-07

### Added
- `client.sandbox.listeningPorts(id)` — TCP ports currently LISTENing inside a sandbox, with a `loopbackOnly` flag (a service bound only to 127.0.0.1 must be restarted on 0.0.0.0 to be previewable).
- `SandboxPreviewInfo.allPorts` — when true (platform default), **any** port is previewable through `previewUrl(id, port)` / share links, not just the suggested list; the platform provisions an on-demand forwarder for unpublished ports.

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
