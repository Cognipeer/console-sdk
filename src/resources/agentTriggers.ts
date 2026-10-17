import { HttpClient } from '../http';
import { newIdempotencyKey, preferHeader } from './agentRuns';
import {
  AgentRun,
  AgentTrigger,
  AgentTriggerCreateRequest,
  AgentTriggerDeleted,
  AgentTriggerDeliveryList,
  AgentTriggerDryRun,
  AgentTriggerList,
  AgentTriggerRotateSecretRequest,
  AgentTriggerRunOptions,
  AgentTriggerRunRequest,
  AgentTriggerUpdateRequest,
  AgentTriggerWebhookSecret,
  ListAgentTriggerDeliveriesQuery,
} from '../types';

function triggersPath(agentKey: string, suffix = ''): string {
  return `/api/client/v1/agents/${encodeURIComponent(agentKey)}/triggers${suffix}`;
}

function triggerPath(agentKey: string, triggerId: string, suffix = ''): string {
  return triggersPath(agentKey, `/${encodeURIComponent(triggerId)}${suffix}`);
}

/**
 * Triggers of an agent: each one starts the agent with a prompt on its own, on a cron schedule, once at a
 * set time, by hand, or when an external system posts an authenticated webhook to the trigger's URL. An agent can
 * have several triggers; each one has one `type` and the settings of that type in the sub-object named after it
 * (`schedule`, `once`, `webhook`). Every fire is a run (`agents.runs.list({ trigger_id })` is the history).
 *
 * @example
 * ```typescript
 * const trigger = await client.agents.triggers.create('report-bot', {
 *   name: 'Weekday digest',
 *   type: 'schedule',
 *   schedule: { cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
 *   prompt: 'Summarise yesterday',
 *   class: 'deferred',
 * });
 * const run = await client.agents.triggers.run('report-bot', trigger.id); // fire it now
 *
 * // A webhook trigger: post events to trigger.webhook.url with trigger.webhook.secret
 * const hook = await client.agents.triggers.create('pr-reviewer', {
 *   name: 'Review pull requests',
 *   type: 'webhook',
 *   webhook: { preset: 'github', events: ['pull_request'] },
 *   prompt: 'Review PR #{{payload.pull_request.number}}',
 * });
 * if (hook.type === 'webhook') console.log(hook.webhook.url, hook.webhook.secret);
 * ```
 */
export class AgentTriggersResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** The agent's triggers. */
  async list(agentKey: string, options: { signal?: AbortSignal } = {}): Promise<AgentTriggerList> {
    return this.http.request<AgentTriggerList>('GET', triggersPath(agentKey), { signal: options.signal });
  }

  /**
   * Create a trigger (HTTP `201`): one `type` with the sub-object named after it. A webhook trigger comes back with
   * `webhook.secret`: the secret is shown once (`AgentTriggerWithSecret`; not with `standard_webhooks`, where you
   * give the sender's secret). Rejects with `CognipeerAPIError` 400 `invalid_trigger` (bad cron / timezone / type, a
   * missing prompt, bad variables; `error.response.error.errors` lists the fields) and 404 `agent_not_found`.
   */
  async create(agentKey: string, body: AgentTriggerCreateRequest, options: { signal?: AbortSignal } = {}): Promise<AgentTrigger> {
    return this.http.request<AgentTrigger>('POST', triggersPath(agentKey), { body, signal: options.signal });
  }

  /** 404 `trigger_not_found` for an unknown id. */
  async get(agentKey: string, triggerId: string, options: { signal?: AbortSignal } = {}): Promise<AgentTrigger> {
    return this.http.request<AgentTrigger>('GET', triggerPath(agentKey, triggerId), { signal: options.signal });
  }

  /**
   * Change a trigger (any field of the create body; `enabled: false` pauses it). To change its type, or the
   * settings of its type, send `type` with the sub-object. Moving a webhook trigger away from `standard_webhooks`
   * generates a secret, which comes back in `webhook.secret` once; moving it to `standard_webhooks` needs the
   * sender's `secret`.
   */
  async update(
    agentKey: string,
    triggerId: string,
    body: AgentTriggerUpdateRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentTrigger> {
    return this.http.request<AgentTrigger>('PATCH', triggerPath(agentKey, triggerId), { body, signal: options.signal });
  }

  /** Delete a trigger; its past runs stay. */
  async delete(agentKey: string, triggerId: string, options: { signal?: AbortSignal } = {}): Promise<AgentTriggerDeleted> {
    return this.http.request<AgentTriggerDeleted>('DELETE', triggerPath(agentKey, triggerId), { signal: options.signal });
  }

  /**
   * Fire a trigger now (any type). `body` may override `variables` / `metadata` for
   * this fire. The answer is the {@link AgentRun}: HTTP `200` when it finished within `wait`
   * (or `Prefer: wait=N`), else `202` with the run still going: it never throws for that.
   * An `Idempotency-Key` is generated unless given; the same key with another request is `409
   * idempotency_key_conflict`.
   *
   * A webhook trigger also takes a sample `payload` (and `headers`): the turn is built the way a
   * delivery's would be, without the event / filter checks. With `dry_run: true` nothing is
   * started and the answer is an {@link AgentTriggerDryRun}: the message and variables the run
   * would get, and whether the event passes `events` and `filter`.
   *
   * Rejects with `CognipeerAPIError`: 400 (`invalid_variables`, `invalid_payload`, `invalid_headers`,
   * `agent_inactive`, or a webhook turn that cannot be built), 404 `trigger_not_found`, 409
   * `idempotency_key_conflict`, 429 with `Retry-After` (`agent_run_concurrency_limit`,
   * `spend_limit_exceeded`, `agent_quota_exceeded`).
   */
  async run(
    agentKey: string,
    triggerId: string,
    body: AgentTriggerRunRequest & { dry_run: true },
    options?: AgentTriggerRunOptions,
  ): Promise<AgentTriggerDryRun>;
  async run(
    agentKey: string,
    triggerId: string,
    body?: AgentTriggerRunRequest & { dry_run?: false },
    options?: AgentTriggerRunOptions,
  ): Promise<AgentRun>;
  async run(
    agentKey: string,
    triggerId: string,
    body?: AgentTriggerRunRequest,
    options?: AgentTriggerRunOptions,
  ): Promise<AgentRun | AgentTriggerDryRun>;
  async run(
    agentKey: string,
    triggerId: string,
    body: AgentTriggerRunRequest = {},
    options: AgentTriggerRunOptions = {},
  ): Promise<AgentRun | AgentTriggerDryRun> {
    const prefer = preferHeader(options.prefer);
    return this.http.request<AgentRun | AgentTriggerDryRun>('POST', triggerPath(agentKey, triggerId, '/run'), {
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
   * 400 `trigger_not_webhook` when the trigger has another type.
   */
  async rotateWebhookSecret(
    agentKey: string,
    triggerId: string,
    body: AgentTriggerRotateSecretRequest = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentTriggerWebhookSecret> {
    return this.http.request<AgentTriggerWebhookSecret>('POST', triggerPath(agentKey, triggerId, '/webhook/rotate-secret'), {
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
    triggerId: string,
    query: ListAgentTriggerDeliveriesQuery = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentTriggerDeliveryList> {
    return this.http.request<AgentTriggerDeliveryList>('GET', triggerPath(agentKey, triggerId, '/deliveries'), {
      query: { before: query.before, limit: query.limit },
      signal: options.signal,
    });
  }
}
