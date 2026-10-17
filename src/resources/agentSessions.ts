import { abortReason, sleep } from '../abort';
import { fileNameFromContentDisposition } from '../contentDisposition';
import { HttpClient } from '../http';
import { SseParser, SseMessage } from '../sse';
import {
  AgentActionsPendingResponse,
  AgentConversationCancelResult,
  AgentResponse,
  AgentRun,
  AgentSession,
  AgentSessionCreateRequest,
  AgentSessionDeleted,
  AgentSessionList,
  AgentSessionSummary,
  AgentSessionUpdateRequest,
  CognipeerAPIError,
  CognipeerError,
  ListAgentSessionsQuery,
  ListSessionEventsQuery,
  PendingAction,
  ResolveActionBody,
  ResolveActionOptions,
  SessionEventList,
  SessionEventStreamOptions,
  SessionFile,
  SessionFileContent,
  SessionFileContentOptions,
  SessionFileContentStream,
  SessionFileDeleted,
  SessionFileList,
  SessionStreamEvent,
  UploadSessionFileOptions,
} from '../types';

const SESSIONS_PATH = '/api/client/v1/agents/sessions';

/** `application/json`, `application/vnd.x+json`: what the upload route takes for its JSON envelope. */
const JSON_MIME_TYPE = /^application\/(?:[\w.+-]+\+)?json\b/i;

function sessionPath(conversationId: string, suffix = ''): string {
  return `${SESSIONS_PATH}/${encodeURIComponent(conversationId)}${suffix}`;
}

function filePath(conversationId: string, fileId: string, suffix = ''): string {
  return sessionPath(conversationId, `/files/${encodeURIComponent(fileId)}${suffix}`);
}

/**
 * One page of {@link AgentSessionsResource.list}, newest created first. Also an
 * async iterable: `for await (const session of page)` walks this page and every
 * page after it.
 *
 * It is not a thenable, so `await sessions.list()` resolves to the page itself.
 * `JSON.stringify(page)` gives the Console's list body (`object`, `data`,
 * `has_more`, `next_cursor`).
 */
export class AgentSessionPage implements AsyncIterable<AgentSessionSummary> {
  readonly object = 'list' as const;
  /** The sessions of this page, without their transcripts or pending actions. */
  readonly data: AgentSessionSummary[];
  /** Another page exists after this one. */
  readonly has_more: boolean;
  /** Pass as `after` for the next page; null on the last page. */
  readonly next_cursor: string | null;
  readonly #fetchNext: (cursor: string) => Promise<AgentSessionPage>;

  /** @internal Built by `sessions.list()`. */
  constructor(list: AgentSessionList, fetchNext: (cursor: string) => Promise<AgentSessionPage>) {
    this.data = list.data ?? [];
    this.has_more = list.has_more === true;
    this.next_cursor = typeof list.next_cursor === 'string' && list.next_cursor !== '' ? list.next_cursor : null;
    this.#fetchNext = fetchNext;
  }

  /** Whether {@link getNextPage} has a page to fetch. */
  hasNextPage(): boolean {
    return this.has_more && this.next_cursor !== null;
  }

  /** The page after this one (same filters), or null on the last page. */
  async getNextPage(): Promise<AgentSessionPage | null> {
    if (!this.hasNextPage()) return null;
    return this.#fetchNext(this.next_cursor as string);
  }

  /** Every session of this page, then of the pages after it (fetched lazily, one at a time). */
  async *[Symbol.asyncIterator](): AsyncGenerator<AgentSessionSummary, void, undefined> {
    yield* this.data;
    for (let next = await this.getNextPage(); next; next = await next.getNextPage()) {
      yield* next.data;
    }
  }

  toJSON(): AgentSessionList {
    return { object: this.object, data: this.data, has_more: this.has_more, next_cursor: this.next_cursor };
  }
}

/**
 * What `sessions.list()` returns: awaitable for the first page, and an async
 * iterable over every session.
 */
export type AgentSessionListCall = Promise<AgentSessionPage> & AsyncIterable<AgentSessionSummary>;

/**
 * Sessions sub-resource: start a session, list and delete them, and reach the
 * runtime state of a conversation, its event log, its pending approvals /
 * questions and its files.
 *
 * @example
 * ```typescript
 * // Start a session, hand it a file, then ask about it.
 * const session = await client.agents.sessions.create({ agent: 'support-bot', metadata: { ticket: 'T-1042' } });
 * await client.agents.sessions.files.upload(session.id, bytes, { name: 'invoice.pdf', mimeType: 'application/pdf' });
 * const reply = await client.agents.responses.create({
 *   model: 'support-bot',
 *   session_id: session.id,
 *   input: 'What is the total on this invoice?',
 * });
 *
 * // A turn that paused for an approval.
 * const res = await client.agents.responses.create({ model: 'ops-agent', input: 'Clean up the staging DB' });
 * if (res.status === 'requires_action') {
 *   const [action] = res.required_action!.actions;
 *   const next = await client.agents.sessions.actions.resolve(res.cognipeer!.session_id!, action.id, { decision: 'allow' });
 * }
 * ```
 */
export class AgentSessionsResource {
  private http: HttpClient;
  public readonly events: AgentSessionEventsResource;
  public readonly actions: AgentSessionActionsResource;
  public readonly files: AgentSessionFilesResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.events = new AgentSessionEventsResource(http);
    this.actions = new AgentSessionActionsResource(http);
    this.files = new AgentSessionFilesResource(http);
  }

  /**
   * Start a session for an agent without sending a message (201). Nothing runs and
   * nothing is spent: use it to upload files before the first message
   * (`sessions.files.upload`), to give the session a budget or `metadata`, then send
   * the first message with `responses.create({ session_id })`.
   *
   * The session belongs to the token's owner and is marked as coming from the API.
   * The same agent and budget rules as the first turn of a Responses call apply.
   *
   * Rejects with `CognipeerAPIError`: 400 (`agent` missing, `agent_not_active`,
   * `invalid_metadata`, `invalid_budget`), 403 `budget_override_forbidden` (the agent's
   * own session budget binds API callers and this one would raise or remove it), 404
   * `agent_not_found`.
   */
  async create(body: AgentSessionCreateRequest, options: { signal?: AbortSignal } = {}): Promise<AgentSession> {
    return this.http.request<AgentSession>('POST', SESSIONS_PATH, { body, signal: options.signal });
  }

  /**
   * The sessions of the token's project, newest created first (rows without their
   * transcript: `message_count`, no `pending_actions`; `get()` has those).
   *
   * Await it for one page (`data`, `has_more`, `next_cursor`, and `getNextPage()`),
   * or iterate it for every session, fetching pages as you go:
   *
   * ```typescript
   * const page = await client.agents.sessions.list({ agent: 'support-bot', limit: 50 });
   * for (const s of page.data) console.log(s.id, s.runtime_status);
   * const more = await page.getNextPage(); // null on the last page
   *
   * for await (const s of client.agents.sessions.list({ status: 'requires_action' })) {
   *   console.log(s.id, s.agent);
   * }
   * ```
   *
   * The cursor marks the last row you read, so sessions created while you page never
   * shift a row into or out of a page you already have. Rejects with
   * `CognipeerAPIError` 400 `invalid_limit` / `invalid_status` / `invalid_cursor`. The
   * `signal` applies to every page request.
   */
  list(query: ListAgentSessionsQuery = {}, options: { signal?: AbortSignal } = {}): AgentSessionListCall {
    const fetchPage = async (after: string | undefined): Promise<AgentSessionPage> => {
      const list = await this.http.request<AgentSessionList>('GET', SESSIONS_PATH, {
        query: { agent: query.agent, status: query.status, limit: query.limit, after },
        signal: options.signal,
      });
      return new AgentSessionPage(list, fetchPage);
    };
    const first = fetchPage(query.after);
    return Object.assign(first, {
      async *[Symbol.asyncIterator](): AsyncGenerator<AgentSessionSummary, void, undefined> {
        yield* await first;
      },
    });
  }

  /**
   * Delete a session with its files (object, converted text and record), its event
   * log and any open approvals or questions.
   *
   * Rejects with `CognipeerAPIError`: 404 `session_not_found`, 409
   * `agent_run_conflict` (a run is queued or running on it: stop it with
   * `sessions.cancel()` first).
   */
  async delete(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<AgentSessionDeleted> {
    return this.http.request<AgentSessionDeleted>('DELETE', sessionPath(conversationId), {
      signal: options.signal,
    });
  }

  /**
   * Stop the turn running on a session: the way to stop an inline call (`responses.create`,
   * chat completions, A2A) from a second request. Its queued or running runs stop too.
   * Cooperative: the turn ends at its next checkpoint, keeping what it had streamed
   * (`stop_reason: cancelled`). Open approvals / questions are cancelled when the caller may
   * answer them. `cancelled: false` means nothing was running (not an error).
   *
   * Rejects with `CognipeerAPIError` 404 `session_not_found`.
   * @param conversationId - The session id (`session_id` of a run, `cognipeer.session_id` or `conversation.id` of a response)
   */
  async cancel(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<AgentConversationCancelResult> {
    return this.http.request<AgentConversationCancelResult>(
      'POST',
      sessionPath(conversationId, '/cancel'),
      { signal: options.signal },
    );
  }

  /**
   * Runtime state of a conversation: whether a turn is running, how the last
   * one ended, the actions waiting for an answer and the newest event seq
   * (resume `events.stream({ after })` from it).
   * @param conversationId - The conversation id (a response id without its `resp_` prefix)
   */
  async get(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<AgentSession> {
    return this.http.request<AgentSession>('GET', sessionPath(conversationId), {
      signal: options.signal,
    });
  }

  /**
   * Change a session's spend budget (raise it, set one, or remove it with
   * `budget: null`; `budget` is required). A `budget_paused` session continues
   * by itself unless `resume: false`: the call then answers `202` with the
   * queued background {@link AgentRun} (`object: 'agent.run'`, the full run
   * shape) instead of the updated {@link AgentSession} (`200`). Tell them
   * apart with `result.object`.
   *
   * Rejects with `CognipeerAPIError`: 400 `invalid_budget` (malformed, or not
   * above what the session already spent), 403 `budget_override_forbidden`
   * (the agent has its own session budget and does not let API callers raise
   * or remove it; lowering it is allowed), 404 `session_not_found`, 409
   * `agent_run_conflict` (a run is already active).
   */
  async update(
    conversationId: string,
    body: AgentSessionUpdateRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentSession | AgentRun> {
    return this.http.request<AgentSession | AgentRun>('PATCH', sessionPath(conversationId), {
      body,
      signal: options.signal,
    });
  }
}

/**
 * The append-only event log of a session: `list()` pages through it,
 * `stream()` follows it live and resumes after a dropped connection.
 */
export class AgentSessionEventsResource {
  private http: HttpClient;
  private readonly eventsPath: (id: string, suffix: string) => string;
  private readonly afterParam: string;

  /**
   * @param scope - Another event log with the same frames (a run's: `agents.runs.events`):
   *   its path under the API and the name of its `after` query parameter.
   */
  constructor(
    http: HttpClient,
    scope: { path?: (id: string, suffix: string) => string; afterParam?: string } = {},
  ) {
    this.http = http;
    this.eventsPath = scope.path ?? ((id, suffix) => sessionPath(id, suffix));
    this.afterParam = scope.afterParam ?? 'after';
  }

  /**
   * Events after `after` (a seq), oldest first. Page with
   * `after: page.last_seq` while `page.has_more`.
   */
  async list(
    conversationId: string,
    query: ListSessionEventsQuery = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<SessionEventList> {
    return this.http.request<SessionEventList>('GET', this.eventsPath(conversationId, '/events'), {
      query: {
        [this.afterParam]: query.after,
        types: query.types?.length ? query.types.join(',') : undefined,
        limit: query.limit,
      },
      signal: options.signal,
    });
  }

  /**
   * Follow the event log as an async iterator: replays what is stored after
   * `after`, then delivers new events as they happen, including live
   * `agent.message.delta` text chunks (not stored, never replayed).
   *
   * The connection is resumed automatically after a drop, an idle stall or a
   * server-side end (the Console closes a stream after an hour) with
   * `Last-Event-ID` set to the last seq seen, so no persisted event is lost or
   * repeated. It gives up after `maxReconnects` consecutive attempts that
   * receive nothing, and fails at once on a non-retryable HTTP status (401,
   * 403, 404...). The stream never ends by itself when the session goes idle:
   * `break` out of the loop (e.g. on `session.status_idle`) or pass a `signal`.
   * Aborting the signal makes the iterator throw its abort reason.
   *
   * @example
   * ```typescript
   * for await (const event of client.agents.sessions.events.stream(conversationId, { after: session.last_event_seq })) {
   *   if (isSessionEvent(event, 'action.required')) askUser(event.data);
   *   if (isSessionEvent(event, 'session.status_idle')) break;
   * }
   * ```
   */
  async *stream(
    conversationId: string,
    options: SessionEventStreamOptions = {},
  ): AsyncGenerator<SessionStreamEvent, void, undefined> {
    const { signal } = options;
    const maxReconnects = options.maxReconnects ?? 8;
    const baseDelayMs = Math.max(0, options.reconnectDelayMs ?? 1_000);
    const maxDelayMs = Math.max(baseDelayMs, options.maxReconnectDelayMs ?? 15_000);

    const state: StreamState = { lastSeq: Math.max(0, options.after ?? 0), progressed: false };
    let failures = 0;

    for (;;) {
      if (signal?.aborted) throw abortReason(signal);
      state.progressed = false;

      let failure: unknown;
      try {
        yield* this.connect(conversationId, options, state);
        failure = new CognipeerError('The session event stream ended');
      } catch (error) {
        // The caller's own abort ends the stream; anything else is judged below.
        if (signal?.aborted) throw abortReason(signal);
        if (!isRetryableStreamError(error)) throw error;
        failure = error;
      }

      // A connection that delivered anything was healthy: only silent ones count.
      failures = state.progressed ? 0 : failures + 1;
      if (failures > maxReconnects) throw failure;

      let delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, failures - 1));
      const retryAfterMs = failure instanceof CognipeerAPIError ? failure.retryAfterMs : undefined;
      if (retryAfterMs !== undefined) delayMs = Math.max(delayMs, Math.min(retryAfterMs, MAX_HONOURED_RETRY_AFTER_MS));
      await sleep(delayMs, signal);
    }
  }

  /** One connection: yields events until it ends or breaks. Mutates `state`. */
  private async *connect(
    conversationId: string,
    options: SessionEventStreamOptions,
    state: StreamState,
  ): AsyncGenerator<SessionStreamEvent, void, undefined> {
    const idleTimeoutMs = options.idleTimeoutMs ?? 45_000;
    // The connection has its own controller: the http client attaches listeners
    // to the signal it is given, and a long-lived caller signal must not collect
    // one per reconnect.
    const connection = new AbortController();
    const onCallerAbort = () => connection.abort(options.signal?.reason);
    if (options.signal?.aborted) onCallerAbort();
    else options.signal?.addEventListener('abort', onCallerAbort, { once: true });

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const resumeFrom = state.lastSeq;
      const response = await this.http.requestStream('GET', this.eventsPath(conversationId, '/events/stream'), {
        query: {
          [this.afterParam]: resumeFrom > 0 ? resumeFrom : undefined,
          types: options.types?.length ? options.types.join(',') : undefined,
        },
        headers: {
          Accept: 'text/event-stream',
          ...(resumeFrom > 0 ? { 'Last-Event-ID': String(resumeFrom) } : {}),
        },
        signal: connection.signal,
      });

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();

      for (;;) {
        const chunk = await readWithIdleTimeout(reader, idleTimeoutMs);
        if (chunk.done) return;
        // Any bytes, even a `: ping` comment, show the connection is alive.
        state.progressed = true;
        for (const message of parser.push(decoder.decode(chunk.value, { stream: true }))) {
          const event = toStreamEvent(message, state);
          if (event) yield event;
        }
      }
    } finally {
      options.signal?.removeEventListener('abort', onCallerAbort);
      connection.abort();
      if (reader) {
        await reader.cancel().catch(() => undefined);
        try {
          reader.releaseLock();
        } catch {
          // A read that is still settling keeps the lock; the stream is cancelled anyway.
        }
      }
    }
  }
}

type ReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>;

/** Longest `Retry-After` the stream waits out before reconnecting. */
const MAX_HONOURED_RETRY_AFTER_MS = 30_000;

interface StreamState {
  /** Highest persisted seq delivered; the reconnect resumes after it. */
  lastSeq: number;
  /** Whether the current connection received any bytes. */
  progressed: boolean;
}

/** No bytes (not even the server's keep-alive ping) arrived within `idleTimeoutMs`. */
class StreamIdleTimeoutError extends CognipeerError {
  constructor(idleTimeoutMs: number) {
    super(`No data on the session event stream for ${idleTimeoutMs}ms`);
    this.name = 'StreamIdleTimeoutError';
  }
}

/** The server sent an `event: error` frame and is closing the stream. */
class SessionStreamServerError extends CognipeerError {
  constructor(message: string) {
    super(message);
    this.name = 'SessionStreamServerError';
  }
}

/** Statuses a reconnect can plausibly fix; the rest (401, 403, 404...) will not change. */
function isRetryableStreamError(error: unknown): boolean {
  if (error instanceof CognipeerAPIError) {
    const status = error.statusCode ?? 0;
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }
  // Network failures, the http client's own timeout, idle stalls, server error frames.
  return true;
}

function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
): Promise<ReadResult> {
  if (!(idleTimeoutMs > 0)) return reader.read();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new StreamIdleTimeoutError(idleTimeoutMs)), idleTimeoutMs);
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * One SSE message as the SDK's event shape, or null for a frame to drop (a
 * persisted event already delivered, an unreadable body). Persisted frames
 * advance `state.lastSeq`.
 *
 * A client-API frame is `{ seq?, type, data, run_id?, created_at }`, the same
 * shape `events.list` returns (live `agent.message.delta` frames have no `seq`;
 * a persisted frame also carries it as the SSE `id:`).
 */
function toStreamEvent(message: SseMessage, state: StreamState): SessionStreamEvent | null {
  if (message.event === 'error') {
    let reason = 'The session event stream failed';
    try {
      const body = JSON.parse(message.data) as { error?: unknown };
      if (typeof body.error === 'string') reason = body.error;
    } catch {
      // keep the generic reason
    }
    throw new SessionStreamServerError(reason);
  }

  let frame: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(message.data);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    frame = parsed as Record<string, unknown>;
  } catch {
    // Never log the payload: it is conversation content.
    console.warn(`Failed to parse session event (${message.data.length} chars) — skipping malformed frame`);
    return null;
  }
  if (typeof frame.type !== 'string') return null;

  const idSeq = message.id !== undefined && /^\d+$/.test(message.id) ? Number(message.id) : undefined;
  const seq = typeof frame.seq === 'number' ? frame.seq : idSeq;
  if (seq !== undefined) {
    // A reconnect replays from the last seq, but a proxy or a race can repeat one.
    if (seq <= state.lastSeq) return null;
    state.lastSeq = seq;
  }

  const runId = frame.run_id;
  const createdAt = frame.created_at;
  return {
    ...(seq !== undefined ? { seq } : {}),
    type: frame.type,
    data: (frame.data !== null && typeof frame.data === 'object' ? frame.data : {}) as Record<string, unknown>,
    ...(typeof runId === 'string' ? { run_id: runId } : {}),
    created_at: typeof createdAt === 'string' ? createdAt : '',
  } as SessionStreamEvent;
}

/**
 * The approvals and questions of a session.
 *
 * `resolve()` answers one. A turn that raised several at once continues when
 * the last of them is answered; until then the call returns a `requires_action`
 * response listing what is still open.
 */
export class AgentSessionActionsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * The actions currently waiting for an answer (`status: 'pending'`).
   *
   * The Console has no client route that lists actions (only the dashboard
   * does), so this reads `pending_actions` from the session record
   * (`sessions.get()`). Answered and expired actions are not listed — the
   * event log (`action.resolved`) has them.
   */
  async list(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<PendingAction[]> {
    const session = await this.http.request<AgentSession>('GET', sessionPath(conversationId), {
      signal: options.signal,
    });
    return session.pending_actions ?? [];
  }

  /**
   * Answer a pending approval or question and let the paused turn continue.
   *
   * - Tool approval: `{ decision: 'allow' | 'deny', comment?, approved_args?, remember_for_session? }`
   * - Question: `{ answers: { '<question text>': 'value' | ['v1', 'v2'] } }`, or `{ cancelled: true }` to skip
   *
   * Returns the continuation (200) in the Responses shape: a full
   * {@link AgentResponse} (`completed` / `incomplete`, or `requires_action`
   * when the continuation paused anew), or — while other actions of the same
   * pause are still open — an {@link AgentActionsPendingResponse}
   * (`status: 'requires_action'`, empty `output`, no `usage`). With
   * `{ background: true }` the continuation is queued instead and the
   * {@link AgentRun} comes back right away (`202`); follow it with
   * `agents.runs.wait()`.
   *
   * Rejects with `CognipeerAPIError`: 403 `action_forbidden` (not an allowed
   * approver), 404 `action_not_found` / `session_not_found`, 409
   * `action_not_pending` (already answered), `action_cancelled` (withdrawn before
   * it was answered) or `agent_run_conflict` (a run is active), 410
   * `action_expired`, 400 `invalid_resolution`,
   * 503 `authorization_unavailable` (the Console could not decide; nothing
   * changed, retry). `error.response.error.action_status` carries the final state
   * of a request that is no longer open. See `AgentActionErrorCodes`.
   */
  async resolve(
    conversationId: string,
    actionId: string,
    body: ResolveActionBody,
    options: ResolveActionOptions & { background: true },
  ): Promise<AgentRun>;
  async resolve(
    conversationId: string,
    actionId: string,
    body: ResolveActionBody,
    options?: ResolveActionOptions & { background?: false },
  ): Promise<AgentResponse | AgentActionsPendingResponse>;
  async resolve(
    conversationId: string,
    actionId: string,
    body: ResolveActionBody,
    options?: ResolveActionOptions,
  ): Promise<AgentResponse | AgentActionsPendingResponse | AgentRun>;
  async resolve(
    conversationId: string,
    actionId: string,
    body: ResolveActionBody,
    options: ResolveActionOptions = {},
  ): Promise<AgentResponse | AgentActionsPendingResponse | AgentRun> {
    return this.http.request<AgentResponse | AgentActionsPendingResponse | AgentRun>(
      'POST',
      sessionPath(conversationId, `/actions/${encodeURIComponent(actionId)}`),
      {
        body: options.background === undefined ? body : { ...body, background: options.background },
        signal: options.signal,
      },
    );
  }
}

/**
 * Files attached to a conversation. The agent reads them in later turns; hand
 * one to a turn with an `input_file` / `input_image` part (`{ file_id }`) on a
 * request that continues the conversation (`session_id`, `conversation` or
 * `previous_response_id`). A file nobody has sent yet goes with the session's next
 * message anyway (unless the agent's *attach new uploads* setting is off).
 *
 * Whether an agent takes files, and where it keeps them (the bucket and folder of
 * its Files settings), is the Console's setting: `agents.get(key).attachments`
 * says whether and how much; each file says where it is (`bucket_key`, `path`).
 */
export class AgentSessionFilesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Upload a file (201). The bytes are sent as the raw request body
   * (`POST`, `Content-Type: <mimeType>`, `?name=<name>`), not base64. (The
   * route also takes a JSON `{ name, content_type, data: <base64> }` body for
   * small files; the SDK always uses the raw form, and therefore sends a JSON
   * `mimeType` as `application/octet-stream` — see {@link UploadSessionFileOptions}.)
   *
   * Rejects with `CognipeerAPIError` when the file exceeds the agent's
   * `maxFileSizeMb` / `maxFiles` (`file_too_large`, `too_many_files`), its type
   * is not allowed (`unsupported_file_type`), the agent takes no attachments
   * (`attachments_disabled`, 403: files are off for it, or on with no bucket chosen),
   * the bucket it keeps files in cannot take one now (`storage_unavailable`, 409,
   * naming the bucket; `storage_not_configured` for files on with no bucket in older
   * data) or the tenant is over quota (`quota_exceeded`). See `AgentActionErrorCodes`.
   */
  async upload(
    conversationId: string,
    file: Blob | Uint8Array | ArrayBuffer,
    options: UploadSessionFileOptions = {},
  ): Promise<SessionFile> {
    const named = file as { name?: unknown; type?: unknown };
    const name = options.name ?? (typeof named.name === 'string' ? named.name : undefined);
    if (!name) {
      throw new CognipeerError('sessions.files.upload needs a file name: pass options.name (or a File)');
    }
    const declared = options.mimeType
      ?? (typeof named.type === 'string' && named.type ? named.type : undefined)
      ?? 'application/octet-stream';
    // The upload route reads any JSON content type as its base64 envelope; the file name decides how a .json file is read.
    const mimeType = JSON_MIME_TYPE.test(declared) ? 'application/octet-stream' : declared;

    return this.http.requestRaw<SessionFile>('POST', sessionPath(conversationId, '/files'), file, {
      contentType: mimeType,
      query: { name },
      signal: options.signal,
    });
  }

  /** The conversation's files. */
  async list(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<SessionFile[]> {
    const response = await this.http.request<SessionFileList>('GET', sessionPath(conversationId, '/files'), {
      signal: options.signal,
    });
    return response.data;
  }

  /**
   * Download a file's bytes (`GET …/files/{fileId}/content`), buffered like
   * `client.files.download()`: the original as uploaded, or with
   * `variant: 'markdown'` the text the agent reads. Returns the bytes, the
   * `Content-Type` and the file name from `Content-Disposition`.
   *
   * 404 `file_not_found` when the file is not on this conversation (or was deleted
   * or expired); 409 `markdown_unavailable` when `variant: 'markdown'` is asked for
   * a file that has no text version (its `conversion_status` is not `succeeded`).
   * For a large file use {@link contentStream}.
   */
  async content(
    conversationId: string,
    fileId: string,
    options: SessionFileContentOptions = {},
  ): Promise<SessionFileContent> {
    const response = await this.http.requestBinary('GET', filePath(conversationId, fileId, '/content'), {
      query: { variant: options.variant },
      signal: options.signal,
    });
    const fileName = fileNameFromContentDisposition(response.headers?.get('content-disposition'));
    return {
      data: response.data,
      contentType: response.contentType,
      ...(fileName ? { fileName } : {}),
    };
  }

  /**
   * Like {@link content}, but hands the body back as a stream instead of buffering
   * it: pipe it to disk or to your own response. The client timeout covers the wait
   * for the response headers only (a transfer that keeps producing bytes is not cut
   * off); `signal` can abort it at any point. Cancel `body` if you stop reading early.
   */
  async contentStream(
    conversationId: string,
    fileId: string,
    options: SessionFileContentOptions = {},
  ): Promise<SessionFileContentStream> {
    const { body, headers } = await this.http.requestStream('GET', filePath(conversationId, fileId, '/content'), {
      query: { variant: options.variant },
      signal: options.signal,
    });
    const fileName = fileNameFromContentDisposition(headers.get('content-disposition'));
    const length = Number(headers.get('content-length'));
    return {
      body,
      contentType: headers.get('content-type') || 'application/octet-stream',
      ...(fileName ? { fileName } : {}),
      ...(headers.get('content-length') && Number.isFinite(length) ? { size: length } : {}),
    };
  }

  /** Delete a file (object, converted text and record); 404 `file_not_found` when it is not on this conversation. */
  async delete(
    conversationId: string,
    fileId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<SessionFileDeleted> {
    return this.http.request<SessionFileDeleted>('DELETE', filePath(conversationId, fileId), {
      signal: options.signal,
    });
  }
}
