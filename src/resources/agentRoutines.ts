import { HttpClient } from '../http';
import { newIdempotencyKey, preferHeader } from './agentRuns';
import {
  AgentRoutine,
  AgentRoutineCreateRequest,
  AgentRoutineDeleted,
  AgentRoutineDeliveryList,
  AgentRoutineDryRun,
  AgentRoutineList,
  AgentRoutineRotateSecretRequest,
  AgentRoutineRunOptions,
  AgentRoutineRunRequest,
  AgentRoutineUpdateRequest,
  AgentRoutineWebhookSecret,
  AgentRun,
  ListAgentRoutineDeliveriesQuery,
} from '../types';

function routinesPath(agentKey: string, suffix = ''): string {
  return `/api/client/v1/agents/${encodeURIComponent(agentKey)}/routines${suffix}`;
}

function routinePath(agentKey: string, routineId: string, suffix = ''): string {
  return routinesPath(agentKey, `/${encodeURIComponent(routineId)}${suffix}`);
}

/**
 * Routines of an agent: a prompt the agent runs on a cron schedule, once at a time, on
 * demand, or when an authenticated webhook delivery reaches the routine's URL. Every fire
 * is a run (`agents.runs.list({ routine_id })` is the history).
 *
 * @example
 * ```typescript
 * const routine = await client.agents.routines.create('report-bot', {
 *   name: 'Weekday digest',
 *   trigger: { type: 'schedule', cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
 *   prompt: 'Summarise yesterday',
 *   class: 'deferred',
 * });
 * const run = await client.agents.routines.run('report-bot', routine.id); // fire it now
 *
 * // A webhook trigger: post events to routine.webhook.url with routine.webhook.secret
 * const hook = await client.agents.routines.create('pr-reviewer', {
 *   name: 'Review pull requests',
 *   trigger: { type: 'webhook', preset: 'github', events: ['pull_request'] },
 *   prompt: 'Review PR #{{payload.pull_request.number}}',
 * });
 * ```
 */
export class AgentRoutinesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** The agent's routines. */
  async list(agentKey: string, options: { signal?: AbortSignal } = {}): Promise<AgentRoutineList> {
    return this.http.request<AgentRoutineList>('GET', routinesPath(agentKey), { signal: options.signal });
  }

  /**
   * Create a routine (HTTP `201`). A webhook trigger comes back with `webhook: { url, secret }`:
   * the secret is shown once. Rejects with `CognipeerAPIError` 400 `invalid_routine` (bad cron /
   * timezone / trigger, a missing prompt, bad inputs; `error.response.error.errors` lists the
   * fields) and 404 `agent_not_found`.
   */
  async create(agentKey: string, body: AgentRoutineCreateRequest, options: { signal?: AbortSignal } = {}): Promise<AgentRoutine> {
    return this.http.request<AgentRoutine>('POST', routinesPath(agentKey), { body, signal: options.signal });
  }

  /** 404 `routine_not_found` for an unknown id. */
  async get(agentKey: string, routineId: string, options: { signal?: AbortSignal } = {}): Promise<AgentRoutine> {
    return this.http.request<AgentRoutine>('GET', routinePath(agentKey, routineId), { signal: options.signal });
  }

  /**
   * Change a routine (any field of the create body; `enabled: false` pauses it). Moving a
   * webhook trigger away from `standard_webhooks` generates a secret, which comes back in
   * `webhook` once; moving it to `standard_webhooks` needs the sender's `secret`.
   */
  async update(
    agentKey: string,
    routineId: string,
    body: AgentRoutineUpdateRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentRoutine> {
    return this.http.request<AgentRoutine>('PATCH', routinePath(agentKey, routineId), { body, signal: options.signal });
  }

  /** Delete a routine; its past runs stay. */
  async delete(agentKey: string, routineId: string, options: { signal?: AbortSignal } = {}): Promise<AgentRoutineDeleted> {
    return this.http.request<AgentRoutineDeleted>('DELETE', routinePath(agentKey, routineId), { signal: options.signal });
  }

  /**
   * Fire a routine now (any trigger type). `body` may override `inputs` / `metadata` for
   * this fire. The answer is the {@link AgentRun}: HTTP `200` when it finished within `wait`
   * (or `Prefer: wait=N`), else `202` with the run still going: it never throws for that.
   * An `Idempotency-Key` is generated unless given; the same key with another request is `409
   * idempotency_key_conflict`.
   *
   * A webhook routine also takes a sample `payload` (and `headers`): the turn is built the way a
   * delivery's would be, without the event / filter checks. With `dry_run: true` nothing is
   * started and the answer is an {@link AgentRoutineDryRun}: the message and inputs the run
   * would get, and whether the event passes `events` and `filter`.
   *
   * Rejects with `CognipeerAPIError`: 400 (`invalid_inputs`, `invalid_payload`, `invalid_headers`,
   * `agent_inactive`, or a webhook turn that cannot be built), 404 `routine_not_found`, 409
   * `idempotency_key_conflict`, 429 with `Retry-After` (`agent_run_concurrency_limit`,
   * `spend_limit_exceeded`, `agent_quota_exceeded`).
   */
  async run(
    agentKey: string,
    routineId: string,
    body: AgentRoutineRunRequest & { dry_run: true },
    options?: AgentRoutineRunOptions,
  ): Promise<AgentRoutineDryRun>;
  async run(
    agentKey: string,
    routineId: string,
    body?: AgentRoutineRunRequest & { dry_run?: false },
    options?: AgentRoutineRunOptions,
  ): Promise<AgentRun>;
  async run(
    agentKey: string,
    routineId: string,
    body?: AgentRoutineRunRequest,
    options?: AgentRoutineRunOptions,
  ): Promise<AgentRun | AgentRoutineDryRun>;
  async run(
    agentKey: string,
    routineId: string,
    body: AgentRoutineRunRequest = {},
    options: AgentRoutineRunOptions = {},
  ): Promise<AgentRun | AgentRoutineDryRun> {
    const prefer = preferHeader(options.prefer);
    return this.http.request<AgentRun | AgentRoutineDryRun>('POST', routinePath(agentKey, routineId, '/run'), {
      body: options.wait === undefined ? body : { ...body, wait: options.wait },
      headers: {
        'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      signal: options.signal,
    });
  }

  /**
   * Replace the secret of a webhook trigger. For generated secrets the answer carries the new
   * `secret` (shown once); with `standard_webhooks` you give the sender's new `secret`. With
   * `grace_seconds` the old secret stays accepted that long, so senders can switch over.
   * 400 `routine_not_webhook` when the routine has another trigger.
   */
  async rotateWebhookSecret(
    agentKey: string,
    routineId: string,
    body: AgentRoutineRotateSecretRequest = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentRoutineWebhookSecret> {
    return this.http.request<AgentRoutineWebhookSecret>('POST', routinePath(agentKey, routineId, '/webhook/rotate-secret'), {
      body,
      signal: options.signal,
    });
  }

  /**
   * The delivery log of a webhook trigger, newest first (kept 7 days): every request to its URL
   * with the outcome and the run it started, never the payload. Page with `before` = the last
   * `id` of the previous page while `has_more`.
   */
  async deliveries(
    agentKey: string,
    routineId: string,
    query: ListAgentRoutineDeliveriesQuery = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentRoutineDeliveryList> {
    return this.http.request<AgentRoutineDeliveryList>('GET', routinePath(agentKey, routineId, '/deliveries'), {
      query: { before: query.before, limit: query.limit },
      signal: options.signal,
    });
  }
}
