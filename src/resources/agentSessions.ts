import { abortReason, sleep } from '../abort';
import { HttpClient } from '../http';
import { SseParser, SseMessage } from '../sse';
import { unwrapList, unwrapOne } from '../unwrap';
import {
  AgentResponse,
  AgentRun,
  AgentSession,
  AgentSessionUpdateRequest,
  CognipeerAPIError,
  CognipeerError,
  ListSessionEventsQuery,
  PendingAction,
  ResolveActionBody,
  ResolveActionOptions,
  SessionEventList,
  SessionEventStreamOptions,
  SessionFile,
  SessionStreamEvent,
  UploadSessionFileOptions,
} from '../types';

const SESSIONS_PATH = '/api/client/v1/agents/sessions';

function sessionPath(conversationId: string, suffix = ''): string {
  return `${SESSIONS_PATH}/${encodeURIComponent(conversationId)}${suffix}`;
}

/**
 * Sessions sub-resource: the runtime state of a conversation, its event log,
 * its pending approvals / questions and its files.
 *
 * @example
 * ```typescript
 * const res = await client.agents.responses.create({ model: 'ops-agent', input: 'Clean up the staging DB' });
 * if (res.status === 'requires_action') {
 *   const [action] = res.required_action!.actions;
 *   const conversationId = res.id.replace(/^resp_/, '');
 *   const next = await client.agents.sessions.actions.resolve(conversationId, action.id, { decision: 'allow' });
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
   * `budget: null`). A `budget_paused` session continues by itself unless
   * `resume: false`: then the call answers with the queued background
   * {@link AgentRun} (`object: 'agent.run'`) instead of the session.
   *
   * Requires a Console with agent runtime phase 1 (session budget). Rejects
   * with 400 when the new `maxCostUsd` does not exceed what the session spent.
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

  constructor(http: HttpClient) {
    this.http = http;
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
    return this.http.request<SessionEventList>('GET', sessionPath(conversationId, '/events'), {
      query: {
        after: query.after,
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
      const response = await this.http.requestStream('GET', sessionPath(conversationId, '/events/stream'), {
        query: {
          after: resumeFrom > 0 ? resumeFrom : undefined,
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
 * The stream frames its payload as `{ seq?, type, data, runId?, createdAt }`
 * (camelCase) while `events.list` returns `run_id` / `created_at`; both are
 * normalized to the list shape here.
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

  const runId = frame.run_id ?? frame.runId;
  const createdAt = frame.created_at ?? frame.createdAt;
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
   * Read from the session record (`sessions.get()`), which is what the Console
   * exposes to API callers; answered and expired actions are not listed — the
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
   * - Tool approval: `{ decision: 'allow' | 'deny', comment?, approvedArgs?, rememberForSession? }`
   * - Question: `{ answers: { '<question text>': 'value' | ['v1', 'v2'] } }`, or `{ cancelled: true }` to skip
   *
   * Returns the continuation in the Responses shape: `completed`/`incomplete`
   * when the turn finished, or `requires_action` again when other actions of
   * the same pause are still open (or the continuation paused anew). With
   * `{ background: true }` the continuation is queued instead and the
   * {@link AgentRun} comes back right away (`202`); follow it with
   * `agents.runs.wait()`.
   *
   * Rejects with `CognipeerAPIError`: 403 `action_forbidden` (not an allowed
   * approver), 404 `action_not_found`, 409 `action_not_pending` (already
   * answered/cancelled) or `agent_run_conflict` (a run is active), 410
   * `action_expired`, 400 `invalid_resolution`. See `AgentActionErrorCodes`.
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
  ): Promise<AgentResponse>;
  async resolve(
    conversationId: string,
    actionId: string,
    body: ResolveActionBody,
    options?: ResolveActionOptions,
  ): Promise<AgentResponse | AgentRun>;
  async resolve(
    conversationId: string,
    actionId: string,
    body: ResolveActionBody,
    options: ResolveActionOptions = {},
  ): Promise<AgentResponse | AgentRun> {
    return this.http.request<AgentResponse | AgentRun>(
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
 * one to a turn with an `input_file` / `input_image` part (`{ file_id }`).
 *
 * Requires a Console with agent runtime phase 1 (session files); the request
 * and response shapes below follow that contract.
 */
export class AgentSessionFilesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Upload a file. The bytes are sent as the raw request body
   * (`Content-Type: <mimeType>`, `?name=<name>`), not base64.
   *
   * Rejects when the file exceeds the agent's `maxFileSizeMb` / `maxFiles`, or
   * its type is not allowed (see the agent's `attachments` setting).
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
    const mimeType = options.mimeType
      ?? (typeof named.type === 'string' && named.type ? named.type : undefined)
      ?? 'application/octet-stream';

    const response = await this.http.requestRaw<unknown>('POST', sessionPath(conversationId, '/files'), file, {
      contentType: mimeType,
      query: { name },
      signal: options.signal,
    });
    return unwrapOne<SessionFile>(response, 'file');
  }

  /** The conversation's files. */
  async list(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<SessionFile[]> {
    const response = await this.http.request<unknown>('GET', sessionPath(conversationId, '/files'), {
      signal: options.signal,
    });
    return unwrapList<SessionFile>(response, 'files');
  }

  /** Delete a file (object, converted text and record). */
  async delete(
    conversationId: string,
    fileId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ id: string; deleted: boolean }> {
    return this.http.request<{ id: string; deleted: boolean }>(
      'DELETE',
      sessionPath(conversationId, `/files/${encodeURIComponent(fileId)}`),
      { signal: options.signal },
    );
  }
}
