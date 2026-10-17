import { abortReason, sleep } from '../abort';
import { HttpClient } from '../http';
import { AgentSessionEventsResource } from './agentSessions';
import {
  AgentActionsPendingResponse,
  AgentResponse,
  AgentResponseStreamEvent,
  AgentRun,
  AgentRunCreateOptions,
  AgentRunCreateRequest,
  AgentRunGetOptions,
  AgentRunList,
  AgentRunPrefer,
  AgentRunQueue,
  AgentRunWaitOptions,
  AgentRunWaitTimeoutError,
  ListAgentRunsQuery,
  ListSessionEventsQuery,
  ResolveActionBody,
  ResolveActionOptions,
  SessionEventList,
  SessionEventStreamOptions,
  SessionStreamEvent,
  isAgentRunSettled,
} from '../types';

const RUNS_PATH = '/api/client/v1/agents/runs';

function runPath(runId: string, suffix = ''): string {
  return `${RUNS_PATH}/${encodeURIComponent(runId)}${suffix}`;
}

/** Default seconds one `wait()` long-poll asks the Console to hold the request (its own window is longer: 10 minutes by default). */
const DEFAULT_WAIT_SECONDS = 20;

/** Headroom kept between a long-poll and the client's request timeout. */
const TIMEOUT_HEADROOM_MS = 5_000;

/** A fresh `Idempotency-Key` for a call that was given none. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `sdk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** `Prefer` header value (RFC 7240) of `options.prefer`; undefined when there is none. */
export function preferHeader(prefer: string | AgentRunPrefer | undefined): string | undefined {
  if (prefer === undefined) return undefined;
  if (typeof prefer === 'string') return prefer;
  const parts: string[] = [];
  if (prefer.wait !== undefined) parts.push(`wait=${Math.max(0, Math.floor(prefer.wait))}`);
  if (prefer.respondAsync) parts.push('respond-async');
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Unix seconds / ISO string / Date as the query value the Console reads. */
function timeQuery(value: number | string | Date | undefined): string | number | undefined {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  return value;
}

/**
 * One page of {@link AgentRunsResource.list}, newest first. Also an async iterable:
 * `for await (const run of page)` walks this page and every page after it.
 * It is not a thenable, so `await runs.list()` resolves to the page itself.
 */
export class AgentRunPage implements AsyncIterable<AgentRun> {
  readonly object = 'list' as const;
  readonly data: AgentRun[];
  readonly first_id: string | null;
  /** Pass as `after` for the next page. */
  readonly last_id: string | null;
  /** Another page exists after this one. */
  readonly has_more: boolean;
  readonly #fetchNext: (cursor: string) => Promise<AgentRunPage>;

  /** @internal Built by `runs.list()`. */
  constructor(list: AgentRunList, fetchNext: (cursor: string) => Promise<AgentRunPage>) {
    this.data = list.data ?? [];
    this.first_id = list.first_id ?? this.data[0]?.id ?? null;
    this.last_id = list.last_id ?? this.data[this.data.length - 1]?.id ?? null;
    this.has_more = list.has_more === true;
    this.#fetchNext = fetchNext;
  }

  /** Whether {@link getNextPage} has a page to fetch. */
  hasNextPage(): boolean {
    return this.has_more && this.last_id !== null;
  }

  /** The page after this one (same filters), or null on the last page. */
  async getNextPage(): Promise<AgentRunPage | null> {
    if (!this.hasNextPage()) return null;
    return this.#fetchNext(this.last_id as string);
  }

  /** Every run of this page, then of the pages after it (fetched lazily, one at a time). */
  async *[Symbol.asyncIterator](): AsyncGenerator<AgentRun, void, undefined> {
    yield* this.data;
    for (let next = await this.getNextPage(); next; next = await next.getNextPage()) {
      yield* next.data;
    }
  }

  toJSON(): AgentRunList {
    return { object: this.object, data: this.data, first_id: this.first_id, last_id: this.last_id, has_more: this.has_more };
  }
}

/** What `runs.list()` returns: awaitable for the first page, and an async iterable over every run. */
export type AgentRunListCall = Promise<AgentRunPage> & AsyncIterable<AgentRun>;

/**
 * `runs.events`: the session events of one run. Call it for a page
 * (`runs.events(runId, { after })`, same as `.list()`), or follow it live with `.stream()`.
 */
export interface AgentRunEvents {
  (runId: string, query?: ListSessionEventsQuery, options?: { signal?: AbortSignal }): Promise<SessionEventList>;
  /** Events after `after` (a seq), oldest first. */
  list(runId: string, query?: ListSessionEventsQuery, options?: { signal?: AbortSignal }): Promise<SessionEventList>;
  /**
   * Follow the run's events as an async iterator, resuming after a dropped connection
   * with `Last-Event-ID` (same behaviour and options as `sessions.events.stream()`).
   * Ends only when you `break` or abort: stop on `session.status_idle` or a terminal
   * `agent.message` event.
   */
  stream(runId: string, options?: SessionEventStreamOptions): AsyncGenerator<SessionStreamEvent, void, undefined>;
}

/**
 * Runs API: start an agent turn (now, later, deferred), follow it, cancel it. The
 * canonical, most complete surface; Responses, chat completions and A2A are
 * dialects over the same runs.
 *
 * @example
 * ```typescript
 * // Fire and forget: queued, answered later (callback or wait).
 * const run = await client.agents.runs.create('report-bot', {
 *   input: 'Weekly numbers',
 *   class: 'deferred',
 *   metadata: { ticket: 'OPS-12' },
 * });
 * const done = await client.agents.runs.wait(run.id, { timeoutMs: 10 * 60_000 });
 * console.log(done.output_text, done.output_parsed);
 *
 * // Hold the call for up to 30 s, 202 with the run when it takes longer.
 * const quick = await client.agents.runs.create('support-bot', { input: 'Hi', wait: 30 });
 *
 * // Page through finished runs.
 * for await (const r of client.agents.runs.list({ agent: 'report-bot', status: 'failed' })) console.log(r.id, r.error);
 * ```
 */
export class AgentRunsResource {
  private http: HttpClient;
  /** The session events of a run: `runs.events(runId)` for a page, `runs.events.stream(runId)` live. */
  public readonly events: AgentRunEvents;

  constructor(http: HttpClient) {
    this.http = http;
    const log = new AgentSessionEventsResource(http, {
      path: (id, suffix) => runPath(id, suffix),
      afterParam: 'after_seq',
    });
    const list: AgentRunEvents['list'] = (runId, query, options) => log.list(runId, query, options);
    this.events = Object.assign(list, {
      list,
      stream: (runId: string, options?: SessionEventStreamOptions) => log.stream(runId, options),
    });
  }

  /**
   * Start a run of an agent. Answers with the {@link AgentRun}: `succeeded` (or
   * `failed` / `requires_action`) when it settled within `wait`, otherwise `queued` /
   * `scheduled` / `running` (HTTP `202`; never an error): follow it with `wait()`,
   * `get()`, `events.stream()` or a `callback`.
   *
   * An `Idempotency-Key` is generated when `options.idempotencyKey` is not given, so a
   * request the client retries never starts a second run.
   *
   * With `stream: true` the call returns an async iterator of `response.*` events
   * instead. A stream that closes early does not stop the run (`on_disconnect`: `continue`,
   * the default); follow it with `wait()` or `events.stream()`.
   *
   * Rejects with `CognipeerAPIError`: 400 (`invalid_inputs`, `invalid_response_format`...),
   * 404 (`agent_not_found`), 409 (`agent_run_conflict`, `idempotency_key_conflict`),
   * 429 (`agent_run_concurrency_limit`, `agent_quota_exceeded`; also for `stream: true`, which is
   * checked before the stream opens, so it is the plain error of the call, with `retryAfterMs`).
   * A body that is not a JSON object is 400 `invalid_json`. A call refused before its run
   * exists leaves no session behind.
   *
   * A retry of a `stream: true` call with the same idempotency key is answered as a stream too
   * (the stored terminal event of a finished run, or a further `response.in_progress` while it
   * still goes on). `reasoning` applies to a streamed run; a queued run uses the agent's own effort.
   */
  async create(
    agentKey: string,
    body: AgentRunCreateRequest & { stream?: false },
    options?: AgentRunCreateOptions,
  ): Promise<AgentRun>;
  async create(
    agentKey: string,
    body: AgentRunCreateRequest & { stream: true },
    options?: AgentRunCreateOptions,
  ): Promise<AsyncGenerator<AgentResponseStreamEvent, void, undefined>>;
  async create(
    agentKey: string,
    body: AgentRunCreateRequest,
    options?: AgentRunCreateOptions,
  ): Promise<AgentRun | AsyncGenerator<AgentResponseStreamEvent, void, undefined>>;
  async create(
    agentKey: string,
    body: AgentRunCreateRequest,
    options: AgentRunCreateOptions = {},
  ): Promise<AgentRun | AsyncGenerator<AgentResponseStreamEvent, void, undefined>> {
    const path = `/api/client/v1/agents/${encodeURIComponent(agentKey)}/runs`;
    const prefer = preferHeader(options.prefer);
    const request = {
      body,
      headers: {
        'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      signal: options.signal,
    };
    if (body.stream) {
      return this.http.stream<AgentResponseStreamEvent>('POST', path, request);
    }
    return this.http.request<AgentRun>('POST', path, request);
  }

  /**
   * The runs of the token's project, newest first. Await it for one page (`data`,
   * `has_more`, `last_id`, `getNextPage()`), or iterate it for every run:
   *
   * ```typescript
   * const page = await client.agents.runs.list({ status: ['queued', 'running'], limit: 50 });
   * for await (const run of client.agents.runs.list({ routine_id: 'rtn_1' })) console.log(run.id);
   * ```
   */
  list(query: ListAgentRunsQuery = {}, options: { signal?: AbortSignal } = {}): AgentRunListCall {
    const params: Record<string, string | number | undefined> = {
      agent: query.agent,
      status: Array.isArray(query.status) ? query.status.join(',') : query.status,
      class: query.class,
      session_id: query.session_id,
      routine_id: query.routine_id,
      channel: query.channel,
      trigger: query.trigger,
      created_after: timeQuery(query.created_after),
      created_before: timeQuery(query.created_before),
      limit: query.limit,
    };
    for (const [key, value] of Object.entries(query.metadata ?? {})) params[`metadata[${key}]`] = value;
    const fetchPage = async (after: string | undefined): Promise<AgentRunPage> => {
      const list = await this.http.request<AgentRunList>('GET', RUNS_PATH, {
        query: { ...params, after },
        signal: options.signal,
      });
      return new AgentRunPage(list, fetchPage);
    };
    const first = fetchPage(query.after);
    return Object.assign(first, {
      async *[Symbol.asyncIterator](): AsyncGenerator<AgentRun, void, undefined> {
        yield* await first;
      },
    });
  }

  /**
   * Get a run; carries `result` / `output_text` / `output_parsed` once it finished and
   * `error` once it `failed` / `canceled`. With `wait` the Console holds the request up
   * to that many seconds until the run settles.
   * @param runId - The run id exactly as returned (`run_<id>`)
   */
  async get(runId: string, options: AgentRunGetOptions = {}): Promise<AgentRun> {
    return this.http.request<AgentRun>('GET', runPath(runId), {
      query: options.wait && options.wait > 0 ? { wait: Math.floor(options.wait) } : undefined,
      signal: options.signal,
    });
  }

  /**
   * Request cancellation. A `scheduled` / `queued` / `requires_action` run is `canceled`
   * at once; a `running` one asks the executor to stop, so the returned run may still read
   * `running` (with `cancel_requested_at`) until it lands: use `wait()` to see it. A paused run
   * also ends `canceled` (`canceled_by_caller`, with its callback and `agent_run.canceled` event) when
   * its pause is dropped another way: a new message to an agent set to cancel pending requests, a
   * session truncate, or a timeout of `onTimeout: 'cancel'`.
   *
   * Throws `CognipeerAPIError` with `errorCode === 'agent_run_already_terminal'`
   * (409) if the run already finished, and a 404 if it does not exist.
   */
  async cancel(runId: string, options: { signal?: AbortSignal } = {}): Promise<AgentRun> {
    return this.http.request<AgentRun>('POST', runPath(runId, '/cancel'), { body: {}, signal: options.signal });
  }

  /**
   * Hold on until the run reaches `succeeded`, `failed` or `canceled` — or
   * `requires_action`, where it waits on a person — and return it. Uses the Console's
   * `?wait=` long-poll: one quiet request lasts `waitSeconds` (default 20), and the
   * answer arrives the moment the run settles. Does not throw on
   * `failed`/`canceled`/`requires_action`: check `run.status`. A `requires_action` run lists
   * what to answer in `run.result.required_action.actions`; answer them with
   * `runs.resolveAction()` or `client.agents.sessions.actions.resolve()`.
   *
   * Throws `AgentRunWaitTimeoutError` when `timeoutMs` elapses, and the signal's abort
   * reason when `signal` aborts. Neither stops the run itself.
   */
  async wait(runId: string, options: AgentRunWaitOptions = {}): Promise<AgentRun> {
    const minGapMs = Math.max(0, options.pollIntervalMs ?? 1000);
    const { timeoutMs, signal } = options;
    const deadline = timeoutMs !== undefined ? Date.now() + timeoutMs : undefined;
    const clientTimeoutMs = this.http.getTimeoutMs?.();
    const ceilingSeconds =
      typeof clientTimeoutMs === 'number' ? Math.floor((clientTimeoutMs - TIMEOUT_HEADROOM_MS) / 1000) : Infinity;
    const perPollSeconds = Math.max(0, Math.min(options.waitSeconds ?? DEFAULT_WAIT_SECONDS, ceilingSeconds));

    for (;;) {
      if (signal?.aborted) throw abortReason(signal);
      const startedAt = Date.now();
      const remainingSeconds = deadline !== undefined ? Math.floor((deadline - startedAt) / 1000) : Infinity;
      const run = await this.get(runId, { wait: Math.min(perPollSeconds, remainingSeconds), signal });
      if (isAgentRunSettled(run.status)) return run;

      const now = Date.now();
      if (deadline !== undefined && now >= deadline) {
        throw new AgentRunWaitTimeoutError(runId, timeoutMs as number, run);
      }
      const gap = minGapMs - (now - startedAt);
      if (gap > 0) await sleep(deadline !== undefined ? Math.min(gap, deadline - now) : gap, signal);
    }
  }

  /**
   * What is running and waiting: tenant-wide counters per execution class with their
   * limits, plus the caller's project under `project`.
   */
  async queue(options: { signal?: AbortSignal } = {}): Promise<AgentRunQueue> {
    return this.http.request<AgentRunQueue>('GET', `${RUNS_PATH}/queue`, { signal: options.signal });
  }

  /**
   * Answer an approval or a question of a `requires_action` run; the run continues.
   * Same body and answer as `sessions.actions.resolve()`: the continuation's Response (`200`),
   * a `requires_action` response while other actions of the pause are open (`200`), or with
   * `background: true` the {@link AgentRun} (`202`). 404 `action_not_found` for an action that
   * is not one of this run's.
   */
  async resolveAction(
    runId: string,
    actionId: string,
    body: ResolveActionBody,
    options: ResolveActionOptions & { background: true },
  ): Promise<AgentRun>;
  async resolveAction(
    runId: string,
    actionId: string,
    body: ResolveActionBody,
    options?: ResolveActionOptions & { background?: false },
  ): Promise<AgentResponse | AgentActionsPendingResponse>;
  async resolveAction(
    runId: string,
    actionId: string,
    body: ResolveActionBody,
    options?: ResolveActionOptions,
  ): Promise<AgentResponse | AgentActionsPendingResponse | AgentRun>;
  async resolveAction(
    runId: string,
    actionId: string,
    body: ResolveActionBody,
    options: ResolveActionOptions = {},
  ): Promise<AgentResponse | AgentActionsPendingResponse | AgentRun> {
    return this.http.request<AgentResponse | AgentActionsPendingResponse | AgentRun>(
      'POST',
      runPath(runId, `/actions/${encodeURIComponent(actionId)}`),
      {
        body: options.background === undefined ? body : { ...body, background: options.background },
        signal: options.signal,
      },
    );
  }
}
