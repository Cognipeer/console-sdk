import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AgentSessionActionsResource,
  AgentSessionEventsResource,
  AgentSessionFilesResource,
  AgentSessionPage,
  AgentSessionsResource,
} from './agentSessions';
import { AgentsResource } from './agents';
import {
  AgentActionErrorCodes,
  CognipeerAPIError,
  isAgentActionErrorCode,
  isSessionEvent,
} from '../types';
import type {
  AgentActionsPendingResponse,
  AgentResponse,
  AgentRun,
  AgentSession,
  AgentSessionList,
  AgentSessionSummary,
  PendingAction,
  SessionEventList,
  SessionFile,
  SessionStreamEvent,
} from '../types';
import { createMockHttp } from '../test/mockHttp';
import { HttpClient } from '../http';

const SESSION_PATH = '/api/client/v1/agents/sessions/conv_1';

const approval: PendingAction = {
  id: 'act_1',
  kind: 'tool_approval',
  tool_name: 'sandbox_exec',
  args: { cmd: 'ls' },
  status: 'pending',
  requested_at: '2026-10-10T10:00:00.000Z',
};

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'conv_1',
    object: 'agent.session',
    agent: 'ops-agent',
    title: 'Clean up staging',
    created_at: '2026-10-10T09:00:00.000Z',
    updated_at: '2026-10-10T10:00:00.000Z',
    metadata: {},
    runtime_status: 'requires_action',
    stop_reason: 'requires_action',
    pending_actions: [approval],
    last_event_seq: 12,
    budget: null,
    spent_usd: 0,
    ...overrides,
  };
}

describe('AgentSessionsResource', () => {
  it('is exposed as client.agents.sessions with events / actions / files sub-resources', () => {
    const agents = new AgentsResource(createMockHttp());

    expect(agents.sessions).toBeInstanceOf(AgentSessionsResource);
    expect(agents.sessions.events).toBeInstanceOf(AgentSessionEventsResource);
    expect(agents.sessions.actions).toBeInstanceOf(AgentSessionActionsResource);
    expect(agents.sessions.files).toBeInstanceOf(AgentSessionFilesResource);
  });

  it('gets the runtime state via GET /api/client/v1/agents/sessions/{id}', async () => {
    const http = createMockHttp();
    const session = makeSession();
    http.request.mockResolvedValue(session);

    const result = await new AgentSessionsResource(http).get('conv_1');

    expect(result).toBe(session);
    expect(http.request).toHaveBeenCalledWith('GET', SESSION_PATH, {});
  });

  it('encodes the conversation id', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeSession());

    await new AgentSessionsResource(http).get('conv/1 x');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/agents/sessions/${encodeURIComponent('conv/1 x')}`,
      {},
    );
  });

  it('updates the budget via PATCH with budget and resume', async () => {
    const http = createMockHttp();
    const run: AgentRun = {
      id: 'run_9',
      object: 'agent.run',
      status: 'queued',
      stop_reason: null,
      agent: 'ops-agent',
      conversation_id: 'conv_1',
      result: null,
      error: null,
      created_at: 1,
      started_at: null,
      completed_at: null,
      cancel_requested_at: null,
      max_duration_ms: 600000,
      callback: null,
    };
    http.request.mockResolvedValue(run);
    const controller = new AbortController();

    const result = await new AgentSessionsResource(http).update(
      'conv_1',
      { budget: { max_cost_usd: 5, on_reach: 'pause' }, resume: true },
      { signal: controller.signal },
    );

    expect(result).toBe(run);
    expect(http.request).toHaveBeenCalledWith('PATCH', SESSION_PATH, {
      body: { budget: { max_cost_usd: 5, on_reach: 'pause' }, resume: true },
      signal: controller.signal,
    });
  });

  it('sends budget: null to remove the budget', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeSession({ runtime_status: 'idle' }));

    const result = await new AgentSessionsResource(http).update('conv_1', { budget: null, resume: false });

    expect(result.object).toBe('agent.session');
    expect(http.request).toHaveBeenCalledWith('PATCH', SESSION_PATH, { body: { budget: null, resume: false } });
  });
});

describe('AgentSessionsResource.create', () => {
  it('starts a session via POST /api/client/v1/agents/sessions', async () => {
    const http = createMockHttp();
    const created = makeSession({
      runtime_status: 'idle',
      stop_reason: null,
      pending_actions: [],
      last_event_seq: 0,
      metadata: { ticket: 'T-1042' },
      budget: { max_cost_usd: 2, on_reach: 'pause' },
    });
    http.request.mockResolvedValue(created);
    const controller = new AbortController();

    const result = await new AgentSessionsResource(http).create(
      {
        agent: 'ops-agent',
        title: 'Clean up staging',
        metadata: { ticket: 'T-1042' },
        budget: { max_cost_usd: 2 },
        runtime_context: { headers: { 'x-tenant': 'acme' } },
      },
      { signal: controller.signal },
    );

    expect(result).toBe(created);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/agents/sessions', {
      body: {
        agent: 'ops-agent',
        title: 'Clean up staging',
        metadata: { ticket: 'T-1042' },
        budget: { max_cost_usd: 2 },
        runtime_context: { headers: { 'x-tenant': 'acme' } },
      },
      signal: controller.signal,
    });
  });

  it('sends budget: null (no budget, overriding the agent default) as is', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeSession({ runtime_status: 'idle' }));

    await new AgentSessionsResource(http).create({ agent: 'ops-agent', budget: null });

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/agents/sessions', {
      body: { agent: 'ops-agent', budget: null },
    });
  });

  it('surfaces the create error codes', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('Agent not found', 404, 'not_found_error', {}, undefined, 'agent_not_found'),
    );

    const error = await new AgentSessionsResource(http).create({ agent: 'ghost' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CognipeerAPIError);
    expect((error as CognipeerAPIError).errorCode).toBe('agent_not_found');
    expect((error as CognipeerAPIError).statusCode).toBe(404);
  });
});

function makeSummary(id: string, overrides: Partial<AgentSessionSummary> = {}): AgentSessionSummary {
  return {
    id,
    object: 'agent.session',
    agent: 'support-bot',
    title: null,
    created_at: '2026-10-10T09:00:00.000Z',
    updated_at: '2026-10-10T09:00:00.000Z',
    metadata: {},
    message_count: 0,
    runtime_status: 'idle',
    stop_reason: null,
    last_event_seq: 0,
    budget: null,
    spent_usd: 0,
    ...overrides,
  };
}

function makeList(ids: string[], nextCursor: string | null): AgentSessionList {
  return {
    object: 'list',
    data: ids.map((id) => makeSummary(id)),
    has_more: nextCursor !== null,
    next_cursor: nextCursor,
  };
}

describe('AgentSessionsResource.list', () => {
  const PATH = '/api/client/v1/agents/sessions';

  it('awaits to one page: filters go in the query, the Console list fields are kept', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeList(['s2', 's1'], 'cur_1'));
    const controller = new AbortController();

    const page = await new AgentSessionsResource(http).list(
      { agent: 'support-bot', status: 'requires_action', limit: 2, after: 'cur_0' },
      { signal: controller.signal },
    );

    expect(page).toBeInstanceOf(AgentSessionPage);
    expect(page.object).toBe('list');
    expect(page.data.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe('cur_1');
    expect(page.hasNextPage()).toBe(true);
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('GET', PATH, {
      query: { agent: 'support-bot', status: 'requires_action', limit: 2, after: 'cur_0' },
      signal: controller.signal,
    });
  });

  it('sends no filters by default (the HTTP client drops unset query values)', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeList([], null));

    const page = await new AgentSessionsResource(http).list();

    expect(page.data).toEqual([]);
    expect(page.hasNextPage()).toBe(false);
    const [, , options] = http.request.mock.calls[0];
    expect(Object.values(options.query).every((value) => value === undefined)).toBe(true);
  });

  it('is not a thenable page: awaiting it yields the page, and the page serialises as the Console list', async () => {
    const http = createMockHttp();
    const body = makeList(['s1'], null);
    http.request.mockResolvedValue(body);

    const page = await new AgentSessionsResource(http).list();

    expect((page as unknown as { then?: unknown }).then).toBeUndefined();
    expect(JSON.parse(JSON.stringify(page))).toEqual(body);
  });

  it('getNextPage() fetches the next page with the same filters and the cursor; null on the last page', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce(makeList(['s3', 's2'], 'cur_2'))
      .mockResolvedValueOnce(makeList(['s1'], null));
    const controller = new AbortController();

    const first = await new AgentSessionsResource(http).list(
      { agent: 'support-bot', limit: 2 },
      { signal: controller.signal },
    );
    const second = await first.getNextPage();

    expect(second?.data.map((s) => s.id)).toEqual(['s1']);
    expect(http.request).toHaveBeenLastCalledWith('GET', PATH, {
      query: { agent: 'support-bot', status: undefined, limit: 2, after: 'cur_2' },
      signal: controller.signal,
    });
    expect(second?.hasNextPage()).toBe(false);
    expect(await second?.getNextPage()).toBeNull();
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('does not chase a page the Console says is the last (has_more without a cursor stops too)', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ object: 'list', data: [makeSummary('s1')], has_more: true, next_cursor: null });

    const page = await new AgentSessionsResource(http).list();

    expect(page.hasNextPage()).toBe(false);
    expect(await page.getNextPage()).toBeNull();
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('iterates every session across pages, fetching lazily', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce(makeList(['s5', 's4'], 'cur_a'))
      .mockResolvedValueOnce(makeList(['s3', 's2'], 'cur_b'))
      .mockResolvedValueOnce(makeList(['s1'], null));

    const seen: string[] = [];
    for await (const session of new AgentSessionsResource(http).list({ limit: 2 })) {
      seen.push(session.id);
      if (seen.length === 2) expect(http.request).toHaveBeenCalledTimes(1);
    }

    expect(seen).toEqual(['s5', 's4', 's3', 's2', 's1']);
    expect(http.request.mock.calls.map((call) => call[2].query.after)).toEqual([undefined, 'cur_a', 'cur_b']);
  });

  it('stops fetching when the loop breaks', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce(makeList(['s3', 's2'], 'cur_a'))
      .mockResolvedValueOnce(makeList(['s1'], null));

    for await (const session of new AgentSessionsResource(http).list({ limit: 2 })) {
      if (session.id === 's2') break;
    }

    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('a page is itself iterable from that page on', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce(makeList(['s3'], 'cur_a'))
      .mockResolvedValueOnce(makeList(['s2', 's1'], null));

    const page = await new AgentSessionsResource(http).list({ limit: 1 });
    const ids: string[] = [];
    for await (const session of page) ids.push(session.id);

    expect(ids).toEqual(['s3', 's2', 's1']);
  });

  it('iterates from the `after` cursor it was given', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeList(['s1'], null));

    const ids: string[] = [];
    for await (const session of new AgentSessionsResource(http).list({ after: 'cur_9' })) ids.push(session.id);

    expect(ids).toEqual(['s1']);
    expect(http.request.mock.calls[0][2].query.after).toBe('cur_9');
  });

  it('rejects the awaited call and the iteration with the Console error', async () => {
    const http = createMockHttp();
    const failure = new CognipeerAPIError('after is not a cursor', 400, 'invalid_request_error', {}, undefined, 'invalid_cursor');
    http.request.mockRejectedValue(failure);
    const resource = new AgentSessionsResource(http);

    await expect(resource.list({ after: 'junk' })).rejects.toBe(failure);
    await expect(
      (async () => {
        for await (const session of resource.list({ after: 'junk' })) void session;
      })(),
    ).rejects.toBe(failure);
  });

  it('a failure while paging surfaces mid-iteration', async () => {
    const http = createMockHttp();
    const failure = new CognipeerAPIError('boom', 500);
    http.request.mockResolvedValueOnce(makeList(['s2'], 'cur_a')).mockRejectedValueOnce(failure);

    const seen: string[] = [];
    await expect(
      (async () => {
        for await (const session of new AgentSessionsResource(http).list()) seen.push(session.id);
      })(),
    ).rejects.toBe(failure);
    expect(seen).toEqual(['s2']);
  });
});

describe('AgentSessionsResource.delete', () => {
  it('deletes via DELETE /api/client/v1/agents/sessions/{id}', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'conv_1', object: 'agent.session', deleted: true });
    const controller = new AbortController();

    const result = await new AgentSessionsResource(http).delete('conv_1', { signal: controller.signal });

    expect(result).toEqual({ id: 'conv_1', object: 'agent.session', deleted: true });
    expect(http.request).toHaveBeenCalledWith('DELETE', SESSION_PATH, { signal: controller.signal });
  });

  it('encodes the id and surfaces a 409 while a run is active', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('An active run exists', 409, 'agent_run_conflict', {}, undefined, 'agent_run_conflict'),
    );

    const error = await new AgentSessionsResource(http).delete('conv/1 x').catch((e: unknown) => e);

    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      `/api/client/v1/agents/sessions/${encodeURIComponent('conv/1 x')}`,
      {},
    );
    expect((error as CognipeerAPIError).errorCode).toBe('agent_run_conflict');
  });
});

describe('AgentSessionEventsResource.list', () => {
  it('lists events with after / types / limit query params', async () => {
    const http = createMockHttp();
    const page: SessionEventList = {
      object: 'list',
      events: [
        {
          seq: 5,
          type: 'agent.message',
          data: { content: 'hi' },
          created_at: '2026-10-10T10:00:00.000Z',
        },
      ],
      has_more: false,
      last_seq: 5,
    };
    http.request.mockResolvedValue(page);

    const result = await new AgentSessionEventsResource(http).list('conv_1', {
      after: 4,
      types: ['agent.message', 'session.status_idle'],
      limit: 50,
    });

    expect(result).toBe(page);
    expect(http.request).toHaveBeenCalledWith('GET', `${SESSION_PATH}/events`, {
      query: { after: 4, types: 'agent.message,session.status_idle', limit: 50 },
    });
  });

  it('omits unset query params', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ object: 'list', events: [], has_more: false, last_seq: 0 });

    await new AgentSessionEventsResource(http).list('conv_1');

    expect(http.request).toHaveBeenCalledWith('GET', `${SESSION_PATH}/events`, {
      query: { after: undefined, types: undefined, limit: undefined },
    });
  });
});

// ── events.stream ─────────────────────────────────────────────────

interface FrameSpec {
  /** Persisted frame: seq set, sent with `id:`. */
  seq?: number;
  type: string;
  data?: Record<string, unknown>;
}

function sseFrame({ seq, type, data = {} }: FrameSpec): string {
  const frame = {
    ...(seq !== undefined ? { seq } : {}),
    type,
    data,
    created_at: '2026-10-10T10:00:00.000Z',
    ...(seq === 1 ? { run_id: 'run_a' } : {}),
  };
  return `${seq !== undefined ? `id: ${seq}\n` : ''}event: ${type}\ndata: ${JSON.stringify(frame)}\n\n`;
}

interface StreamBodyOptions {
  /** Keep the connection open after the chunks (no clean end). */
  hang?: boolean;
  signal?: AbortSignal;
  onCancel?: () => void;
}

function streamResponse(chunks: string[], options: StreamBodyOptions = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (!options.hang) controller.close();
      options.signal?.addEventListener(
        'abort',
        () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          try {
            controller.error(error);
          } catch {
            // already closed
          }
        },
        { once: true },
      );
    },
    cancel() {
      options.onCancel?.();
    },
  });
  return { body, headers: new Headers({ 'content-type': 'text/event-stream' }), status: 200 };
}

async function collect(
  iterator: AsyncGenerator<SessionStreamEvent, void, undefined>,
  count: number,
): Promise<SessionStreamEvent[]> {
  const events: SessionStreamEvent[] = [];
  for await (const event of iterator) {
    events.push(event);
    if (events.length >= count) break;
  }
  return events;
}

describe('AgentSessionEventsResource.stream', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to /events/stream with SSE headers and yields normalized events', async () => {
    const http = createMockHttp();
    http.requestStream.mockImplementation(async () =>
      streamResponse([
        ': ping\n\n',
        sseFrame({ seq: 1, type: 'user.message', data: { content: 'hello' } }),
        sseFrame({ type: 'agent.message.delta', data: { text: 'Hi' } }),
        sseFrame({ seq: 2, type: 'agent.message', data: { content: 'Hi there' } }),
      ]),
    );
    const resource = new AgentSessionEventsResource(http);

    const events = await collect(resource.stream('conv_1', { maxReconnects: 0 }), 3);

    expect(http.requestStream).toHaveBeenCalledTimes(1);
    const [method, path, options] = http.requestStream.mock.calls[0];
    expect(method).toBe('GET');
    expect(path).toBe(`${SESSION_PATH}/events/stream`);
    expect(options.headers).toEqual({ Accept: 'text/event-stream' });
    expect(options.query).toEqual({ after: undefined, types: undefined });

    // A client-API frame has the same shape as an `events.list` entry.
    expect(events[0]).toEqual({
      seq: 1,
      type: 'user.message',
      data: { content: 'hello' },
      run_id: 'run_a',
      created_at: '2026-10-10T10:00:00.000Z',
    });
    expect(events[1]).toEqual({
      type: 'agent.message.delta',
      data: { text: 'Hi' },
      created_at: '2026-10-10T10:00:00.000Z',
    });
    expect(events[1].seq).toBeUndefined();
    expect(events[2].seq).toBe(2);
  });

  it('narrows events with isSessionEvent', async () => {
    const http = createMockHttp();
    http.requestStream.mockImplementation(async () =>
      streamResponse([
        sseFrame({ seq: 1, type: 'action.required', data: { action_id: 'act_1', kind: 'tool_approval', tool_name: 'x' } }),
        sseFrame({ seq: 2, type: 'future.thing', data: { a: 1 } }),
      ]),
    );

    const events = await collect(new AgentSessionEventsResource(http).stream('conv_1', { maxReconnects: 0 }), 2);

    const [required, unknown] = events;
    expect(isSessionEvent(required, 'action.required')).toBe(true);
    if (isSessionEvent(required, 'action.required')) expect(required.data.action_id).toBe('act_1');
    expect(isSessionEvent(unknown, 'action.required')).toBe(false);
    expect(unknown.type).toBe('future.thing');
  });

  it('starts after `after` and sends types, with Last-Event-ID', async () => {
    const http = createMockHttp();
    http.requestStream.mockImplementation(async () => streamResponse([sseFrame({ seq: 6, type: 'session.work_done' })]));

    await collect(
      new AgentSessionEventsResource(http).stream('conv_1', { after: 5, types: ['session.work_done', 'action.required'] }),
      1,
    );

    const [, , options] = http.requestStream.mock.calls[0];
    expect(options.query).toEqual({ after: 5, types: 'session.work_done,action.required' });
    expect(options.headers).toEqual({ Accept: 'text/event-stream', 'Last-Event-ID': '5' });
  });

  it('reconnects with Last-Event-ID of the last seq and drops replayed events', async () => {
    const http = createMockHttp();
    http.requestStream
      .mockImplementationOnce(async () =>
        streamResponse([sseFrame({ seq: 1, type: 'user.message' }), sseFrame({ seq: 2, type: 'agent.tool_use' })]),
      )
      .mockImplementationOnce(async () =>
        streamResponse([sseFrame({ seq: 2, type: 'agent.tool_use' }), sseFrame({ seq: 3, type: 'agent.tool_result' })]),
      );
    const resource = new AgentSessionEventsResource(http);

    const events = await collect(resource.stream('conv_1', { reconnectDelayMs: 0 }), 3);

    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(http.requestStream).toHaveBeenCalledTimes(2);
    const [, , reconnect] = http.requestStream.mock.calls[1];
    expect(reconnect.headers['Last-Event-ID']).toBe('2');
    expect(reconnect.query.after).toBe(2);
  });

  it('retries a retryable HTTP failure and keeps going', async () => {
    const http = createMockHttp();
    http.requestStream
      .mockRejectedValueOnce(new CognipeerAPIError('unavailable', 503))
      .mockImplementationOnce(async () => streamResponse([sseFrame({ seq: 1, type: 'user.message' })]));

    const events = await collect(new AgentSessionEventsResource(http).stream('conv_1', { reconnectDelayMs: 0 }), 1);

    expect(events).toHaveLength(1);
    expect(http.requestStream).toHaveBeenCalledTimes(2);
  });

  it('fails at once on a non-retryable status', async () => {
    const http = createMockHttp();
    http.requestStream.mockRejectedValue(new CognipeerAPIError('not found', 404));

    await expect(collect(new AgentSessionEventsResource(http).stream('conv_1'), 1)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(http.requestStream).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxReconnects silent attempts and throws the last failure', async () => {
    const http = createMockHttp();
    http.requestStream.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      collect(new AgentSessionEventsResource(http).stream('conv_1', { maxReconnects: 2, reconnectDelayMs: 0 }), 1),
    ).rejects.toThrow('fetch failed');
    // the first attempt plus two reconnects
    expect(http.requestStream).toHaveBeenCalledTimes(3);
  });

  it('does not count connections that delivered data against maxReconnects', async () => {
    const http = createMockHttp();
    for (let seq = 1; seq <= 4; seq++) {
      http.requestStream.mockImplementationOnce(async () => streamResponse([sseFrame({ seq, type: 'agent.tool_use' })]));
    }

    const events = await collect(
      new AgentSessionEventsResource(http).stream('conv_1', { maxReconnects: 1, reconnectDelayMs: 0 }),
      4,
    );

    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(http.requestStream).toHaveBeenCalledTimes(4);
  });

  it('reconnects after an `event: error` frame from the server', async () => {
    const http = createMockHttp();
    http.requestStream
      .mockImplementationOnce(async () =>
        streamResponse([sseFrame({ seq: 1, type: 'user.message' }), 'event: error\ndata: {"error":"event stream failed"}\n\n']),
      )
      .mockImplementationOnce(async () => streamResponse([sseFrame({ seq: 2, type: 'agent.message' })]));

    const events = await collect(new AgentSessionEventsResource(http).stream('conv_1', { reconnectDelayMs: 0 }), 2);

    expect(events.map((e) => e.seq)).toEqual([1, 2]);
    expect(http.requestStream).toHaveBeenCalledTimes(2);
  });

  it('reconnects when the connection goes silent for idleTimeoutMs', async () => {
    const http = createMockHttp();
    const cancelled = vi.fn();
    http.requestStream
      .mockImplementationOnce(async () => streamResponse([], { hang: true, onCancel: cancelled }))
      .mockImplementationOnce(async () => streamResponse([sseFrame({ seq: 1, type: 'user.message' })]));

    const events = await collect(
      new AgentSessionEventsResource(http).stream('conv_1', { idleTimeoutMs: 20, reconnectDelayMs: 0 }),
      1,
    );

    expect(events).toHaveLength(1);
    expect(http.requestStream).toHaveBeenCalledTimes(2);
    expect(cancelled).toHaveBeenCalled();
  });

  it('throws the signal reason when aborted mid-stream, without reconnecting', async () => {
    const http = createMockHttp();
    http.requestStream.mockImplementation(async (_m: string, _p: string, options: { signal: AbortSignal }) =>
      streamResponse([sseFrame({ seq: 1, type: 'user.message' })], { hang: true, signal: options.signal }),
    );
    const controller = new AbortController();
    const reason = new Error('stop following');

    const run = (async () => {
      const seen: number[] = [];
      for await (const event of new AgentSessionEventsResource(http).stream('conv_1', {
        signal: controller.signal,
        reconnectDelayMs: 0,
      })) {
        seen.push(event.seq as number);
        controller.abort(reason);
      }
      return seen;
    })();

    await expect(run).rejects.toBe(reason);
    expect(http.requestStream).toHaveBeenCalledTimes(1);
  });

  it('throws immediately for an already-aborted signal', async () => {
    const http = createMockHttp();
    const controller = new AbortController();
    controller.abort(new Error('nope'));

    await expect(
      collect(new AgentSessionEventsResource(http).stream('conv_1', { signal: controller.signal }), 1),
    ).rejects.toThrow('nope');
    expect(http.requestStream).not.toHaveBeenCalled();
  });

  it('aborts a sleeping reconnect when the signal fires', async () => {
    const http = createMockHttp();
    http.requestStream.mockRejectedValue(new CognipeerAPIError('unavailable', 503));
    const controller = new AbortController();
    const run = collect(
      new AgentSessionEventsResource(http).stream('conv_1', { signal: controller.signal, reconnectDelayMs: 60_000, maxReconnectDelayMs: 60_000 }),
      1,
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort(new Error('enough'));

    await expect(run).rejects.toThrow('enough');
    expect(http.requestStream).toHaveBeenCalledTimes(1);
  });

  it('cancels the connection when the consumer stops early', async () => {
    const http = createMockHttp();
    const cancelled = vi.fn();
    http.requestStream.mockImplementation(async () =>
      streamResponse([sseFrame({ seq: 1, type: 'user.message' })], { hang: true, onCancel: cancelled }),
    );

    await collect(new AgentSessionEventsResource(http).stream('conv_1'), 1);

    expect(cancelled).toHaveBeenCalled();
    expect(http.requestStream).toHaveBeenCalledTimes(1);
  });

  it('skips a malformed frame without leaking its content', async () => {
    const http = createMockHttp();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    http.requestStream.mockImplementation(async () =>
      streamResponse(['data: {not json secret-conversation-text\n\n', sseFrame({ seq: 1, type: 'user.message' })]),
    );

    const events = await collect(new AgentSessionEventsResource(http).stream('conv_1', { maxReconnects: 0 }), 1);

    expect(events).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain('secret-conversation-text');
  });

  it('takes the seq from the SSE id when the frame body has none', async () => {
    const http = createMockHttp();
    http.requestStream
      .mockImplementationOnce(async () =>
        streamResponse([`id: 9\nevent: session.work_done\ndata: ${JSON.stringify({ type: 'session.work_done', data: {} })}\n\n`]),
      )
      .mockImplementationOnce(async () => streamResponse([sseFrame({ seq: 10, type: 'user.message' })]));

    const events = await collect(new AgentSessionEventsResource(http).stream('conv_1', { reconnectDelayMs: 0 }), 2);

    expect(events.map((e) => e.seq)).toEqual([9, 10]);
    expect(http.requestStream.mock.calls[1][2].headers['Last-Event-ID']).toBe('9');
  });
});

// ── actions ───────────────────────────────────────────────────────

describe('AgentSessionActionsResource', () => {
  it('lists the pending actions from the session record', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeSession());

    const actions = await new AgentSessionActionsResource(http).list('conv_1');

    expect(actions).toEqual([approval]);
    expect(http.request).toHaveBeenCalledWith('GET', SESSION_PATH, {});
  });

  it('returns an empty list when the session reports none', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeSession({ pending_actions: undefined as unknown as PendingAction[] }));

    expect(await new AgentSessionActionsResource(http).list('conv_1')).toEqual([]);
  });

  it('resolves a tool approval via POST .../actions/{actionId}', async () => {
    const http = createMockHttp();
    const response = { id: 'resp_conv_1', object: 'response', status: 'completed' } as AgentResponse;
    http.request.mockResolvedValue(response);

    const result = await new AgentSessionActionsResource(http).resolve('conv_1', 'act_1', {
      decision: 'allow',
      comment: 'ok',
      approved_args: { cmd: 'ls -la' },
      remember_for_session: true,
    });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${SESSION_PATH}/actions/act_1`, {
      body: { decision: 'allow', comment: 'ok', approved_args: { cmd: 'ls -la' }, remember_for_session: true },
    });
  });

  it('returns the minimal requires_action body while other actions of the pause are open', async () => {
    const http = createMockHttp();
    const pending: AgentActionsPendingResponse = {
      id: 'resp_conv_1',
      object: 'response',
      model: 'ops-agent',
      output: [],
      status: 'requires_action',
      stop_reason: 'requires_action',
      required_action: { type: 'agent_actions', actions: [approval] },
    };
    http.request.mockResolvedValue(pending);

    const result = await new AgentSessionActionsResource(http).resolve('conv_1', 'act_2', { decision: 'deny' });

    expect(result.status).toBe('requires_action');
    if (result.status === 'requires_action') expect(result.required_action?.actions[0].id).toBe('act_1');
    expect('usage' in result).toBe(false);
  });

  it('resolves a question with answers, and a skip with cancelled', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ status: 'completed' });
    const resource = new AgentSessionActionsResource(http);

    await resource.resolve('conv_1', 'act_2', { answers: { 'Which env?': ['staging', 'dev'] } });
    await resource.resolve('conv_1', 'act_3', { cancelled: true });

    expect(http.request).toHaveBeenNthCalledWith(1, 'POST', `${SESSION_PATH}/actions/act_2`, {
      body: { answers: { 'Which env?': ['staging', 'dev'] } },
    });
    expect(http.request).toHaveBeenNthCalledWith(2, 'POST', `${SESSION_PATH}/actions/act_3`, {
      body: { cancelled: true },
    });
  });

  it('background: true adds background to the body and returns the queued run', async () => {
    const http = createMockHttp();
    const run: AgentRun = { id: 'run_7', object: 'agent.run', status: 'queued', created_at: 1 };
    http.request.mockResolvedValue(run);
    const controller = new AbortController();

    const result = await new AgentSessionActionsResource(http).resolve(
      'conv_1',
      'act_1',
      { decision: 'deny', comment: 'no' },
      { background: true, signal: controller.signal },
    );

    expect(result.object).toBe('agent.run');
    expect(result.id).toBe('run_7');
    expect(http.request).toHaveBeenCalledWith('POST', `${SESSION_PATH}/actions/act_1`, {
      body: { decision: 'deny', comment: 'no', background: true },
      signal: controller.signal,
    });
  });

  it('returns a requires_action response when other actions are still open', async () => {
    const http = createMockHttp();
    const response = {
      id: 'resp_conv_1',
      object: 'response',
      model: 'ops-agent',
      output: [],
      status: 'requires_action',
      stop_reason: 'requires_action',
      required_action: { type: 'agent_actions', actions: [approval] },
    } as unknown as AgentResponse;
    http.request.mockResolvedValue(response);

    const result = await new AgentSessionActionsResource(http).resolve('conv_1', 'act_0', { decision: 'allow' });

    expect(result.status).toBe('requires_action');
    expect(result.required_action?.actions[0].id).toBe('act_1');
  });

  it('encodes ids', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});

    await new AgentSessionActionsResource(http).resolve('conv/1', 'act/1', { decision: 'allow' });

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      `/api/client/v1/agents/sessions/${encodeURIComponent('conv/1')}/actions/${encodeURIComponent('act/1')}`,
      { body: { decision: 'allow' } },
    );
  });

  it('surfaces action error codes', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('This request is no longer open', 409, 'invalid_request_error', undefined, undefined, 'action_not_pending'),
    );

    const error = await new AgentSessionActionsResource(http)
      .resolve('conv_1', 'act_1', { decision: 'allow' })
      .catch((e: unknown) => e);

    expect(isAgentActionErrorCode(error, AgentActionErrorCodes.NotPending)).toBe(true);
    expect(isAgentActionErrorCode(error, AgentActionErrorCodes.Expired)).toBe(false);
  });

  it('tells a cancelled request (409 action_cancelled) from an answered one (409 action_not_pending)', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('This request was cancelled', 409, 'invalid_request_error', { error: { action_status: 'cancelled' } }, undefined, 'action_cancelled'),
    );

    const error = await new AgentSessionActionsResource(http)
      .resolve('conv_1', 'act_1', { decision: 'allow' })
      .catch((e: unknown) => e);

    expect(isAgentActionErrorCode(error, AgentActionErrorCodes.ActionCancelled)).toBe(true);
    expect(isAgentActionErrorCode(error, AgentActionErrorCodes.NotPending)).toBe(false);
  });

  it('surfaces the engine being unable to decide (503 authorization_unavailable)', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('Authorization is temporarily unavailable', 503, 'server_error', undefined, undefined, 'authorization_unavailable'),
    );

    const error = await new AgentSessionActionsResource(http)
      .resolve('conv_1', 'act_1', { decision: 'allow' })
      .catch((e: unknown) => e);

    expect(isAgentActionErrorCode(error, AgentActionErrorCodes.AuthorizationUnavailable)).toBe(true);
  });
});

// ── files ─────────────────────────────────────────────────────────

describe('AgentSessionFilesResource', () => {
  const stored: SessionFile = {
    id: 'file_1',
    object: 'agent.session.file',
    session_id: 'conv_1',
    name: 'report.pdf',
    mime_type: 'application/pdf',
    size: 5,
    conversion_status: 'succeeded',
    bucket_key: 'session-docs',
    path: 'agent-sessions/ops-agent/conv_1/report.pdf',
    content_url: '/api/client/v1/agents/sessions/conv_1/files/file_1/content',
    created_at: '2026-10-10T10:00:00.000Z',
  };

  it('uploads raw bytes with the mime type as Content-Type and the name as a query param', async () => {
    const http = createMockHttp();
    http.requestRaw.mockResolvedValue(stored);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const controller = new AbortController();

    const result = await new AgentSessionFilesResource(http).upload('conv_1', bytes, {
      name: 'report.pdf',
      mimeType: 'application/pdf',
      signal: controller.signal,
    });

    expect(result).toBe(stored);
    expect(http.requestRaw).toHaveBeenCalledWith('POST', `${SESSION_PATH}/files`, bytes, {
      contentType: 'application/pdf',
      query: { name: 'report.pdf' },
      signal: controller.signal,
    });
  });

  it('takes name and type from a File', async () => {
    const http = createMockHttp();
    http.requestRaw.mockResolvedValue(stored);
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    const result = await new AgentSessionFilesResource(http).upload('conv_1', file);

    expect(result).toBe(stored);
    const [, , body, options] = http.requestRaw.mock.calls[0];
    expect(body).toBe(file);
    expect(options.contentType).toBe('text/plain');
    expect(options.query).toEqual({ name: 'notes.txt' });
  });

  it('defaults the content type to application/octet-stream', async () => {
    const http = createMockHttp();
    http.requestRaw.mockResolvedValue(stored);

    await new AgentSessionFilesResource(http).upload('conv_1', new Uint8Array([1]), { name: 'blob.bin' });

    expect(http.requestRaw.mock.calls[0][3].contentType).toBe('application/octet-stream');
  });

  it('requires a name for raw bytes', async () => {
    const http = createMockHttp();

    await expect(new AgentSessionFilesResource(http).upload('conv_1', new Uint8Array([1]))).rejects.toThrow(
      'needs a file name',
    );
    expect(http.requestRaw).not.toHaveBeenCalled();
  });

  it('sends a JSON mime type as application/octet-stream (the route reads JSON as a base64 envelope)', async () => {
    const http = createMockHttp();
    http.requestRaw.mockResolvedValue(stored);
    const resource = new AgentSessionFilesResource(http);

    await resource.upload('conv_1', new Uint8Array([123, 125]), { name: 'data.json', mimeType: 'application/json' });
    await resource.upload('conv_1', new Uint8Array([123, 125]), { name: 'x.json', mimeType: 'application/vnd.api+json; charset=utf-8' });
    await resource.upload('conv_1', new Uint8Array([1]), { name: 'a.txt', mimeType: 'text/plain' });

    expect(http.requestRaw.mock.calls.map((call) => call[3].contentType)).toEqual([
      'application/octet-stream',
      'application/octet-stream',
      'text/plain',
    ]);
  });

  it('lists files from the { object: "list", data } envelope', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ object: 'list', data: [stored] });

    expect(await new AgentSessionFilesResource(http).list('conv_1')).toEqual([stored]);
    expect(http.request).toHaveBeenCalledWith('GET', `${SESSION_PATH}/files`, {});
  });

  it('keeps where a listed file is stored (bucket_key, path)', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ object: 'list', data: [stored] });

    const [file] = await new AgentSessionFilesResource(http).list('conv_1');

    expect(file.bucket_key).toBe('session-docs');
    expect(file.path).toBe('agent-sessions/ops-agent/conv_1/report.pdf');
  });

  it('deletes a file via DELETE .../files/{fileId}', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'file_1', object: 'agent.session.file', deleted: true });

    const result = await new AgentSessionFilesResource(http).delete('conv_1', 'file_1');

    expect(result).toEqual({ id: 'file_1', object: 'agent.session.file', deleted: true });
    expect(http.request).toHaveBeenCalledWith('DELETE', `${SESSION_PATH}/files/file_1`, {});
  });

  it('surfaces the storage and attachment error codes of an upload', async () => {
    const http = createMockHttp();
    const resource = new AgentSessionFilesResource(http);
    const codes = [
      ['storage_unavailable', 409, AgentActionErrorCodes.StorageUnavailable],
      ['storage_not_configured', 409, AgentActionErrorCodes.StorageNotConfigured],
      ['attachments_disabled', 403, AgentActionErrorCodes.AttachmentsDisabled],
    ] as const;

    for (const [code, status, constant] of codes) {
      http.requestRaw.mockRejectedValueOnce(new CognipeerAPIError('refused', status, 'invalid_request_error', {}, undefined, code));
      const error = await resource.upload('conv_1', new Uint8Array([1]), { name: 'a.txt' }).catch((e: unknown) => e);
      expect(constant).toBe(code);
      expect(isAgentActionErrorCode(error, constant)).toBe(true);
    }
  });

  describe('content', () => {
    it('downloads the original via GET .../files/{fileId}/content and reads the name from Content-Disposition', async () => {
      const http = createMockHttp();
      const bytes = new Uint8Array([37, 80, 68, 70]);
      http.requestBinary.mockResolvedValue({
        data: bytes,
        contentType: 'application/pdf',
        headers: new Headers({ 'content-disposition': 'attachment; filename="report.pdf"' }),
      });
      const controller = new AbortController();

      const result = await new AgentSessionFilesResource(http).content('conv_1', 'file_1', { signal: controller.signal });

      expect(result).toEqual({ data: bytes, contentType: 'application/pdf', fileName: 'report.pdf' });
      expect(http.requestBinary).toHaveBeenCalledWith('GET', `${SESSION_PATH}/files/file_1/content`, {
        query: { variant: undefined },
        signal: controller.signal,
      });
    });

    it('asks for the markdown variant, encodes ids, and leaves fileName out when there is no header', async () => {
      const http = createMockHttp();
      http.requestBinary.mockResolvedValue({
        data: new Uint8Array([35]),
        contentType: 'text/markdown; charset=utf-8',
        headers: new Headers(),
      });

      const result = await new AgentSessionFilesResource(http).content('conv/1', 'file 1', { variant: 'markdown' });

      expect(result).toEqual({ data: new Uint8Array([35]), contentType: 'text/markdown; charset=utf-8' });
      expect(http.requestBinary).toHaveBeenCalledWith(
        'GET',
        `/api/client/v1/agents/sessions/${encodeURIComponent('conv/1')}/files/${encodeURIComponent('file 1')}/content`,
        { query: { variant: 'markdown' }, signal: undefined },
      );
    });

    it('tolerates a transport that returns no headers', async () => {
      const http = createMockHttp();
      http.requestBinary.mockResolvedValue({ data: new Uint8Array([1]), contentType: 'image/png' });

      expect(await new AgentSessionFilesResource(http).content('conv_1', 'file_1')).toEqual({
        data: new Uint8Array([1]),
        contentType: 'image/png',
      });
    });

    it('rejects with the Console error when the file is not on this session', async () => {
      const http = createMockHttp();
      http.requestBinary.mockRejectedValue(
        new CognipeerAPIError('File not found', 404, 'not_found_error', {}, undefined, 'file_not_found'),
      );

      const error = await new AgentSessionFilesResource(http).content('conv_1', 'gone').catch((e: unknown) => e);

      expect((error as CognipeerAPIError).errorCode).toBe('file_not_found');
    });

    it('a markdown variant of a file without a text version is 409 markdown_unavailable', async () => {
      const http = createMockHttp();
      http.requestBinary.mockRejectedValue(
        new CognipeerAPIError('This file has no text version.', 409, 'invalid_request_error', {}, undefined, 'markdown_unavailable'),
      );

      const error = await new AgentSessionFilesResource(http)
        .content('conv_1', 'pic_1', { variant: 'markdown' })
        .catch((e: unknown) => e);

      expect(isAgentActionErrorCode(error, AgentActionErrorCodes.MarkdownUnavailable)).toBe(true);
      expect((error as CognipeerAPIError).statusCode).toBe(409);
    });
  });

  describe('contentStream', () => {
    it('hands back the body as a stream with type, name and size', async () => {
      const http = createMockHttp();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
      http.requestStream.mockResolvedValue({
        body,
        status: 200,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': '3',
          'content-disposition': "inline; filename*=UTF-8''r%C3%A9sum%C3%A9.png",
        }),
      });
      const controller = new AbortController();

      const result = await new AgentSessionFilesResource(http).contentStream('conv_1', 'file_1', {
        variant: 'original',
        signal: controller.signal,
      });

      expect(result.body).toBe(body);
      expect(result).toMatchObject({ contentType: 'image/png', fileName: 'résumé.png', size: 3 });
      expect(http.requestStream).toHaveBeenCalledWith('GET', `${SESSION_PATH}/files/file_1/content`, {
        query: { variant: 'original' },
        signal: controller.signal,
      });
    });

    it('defaults the type and omits name and size the Console did not send', async () => {
      const http = createMockHttp();
      const body = new ReadableStream<Uint8Array>();
      http.requestStream.mockResolvedValue({ body, status: 200, headers: new Headers() });

      const result = await new AgentSessionFilesResource(http).contentStream('conv_1', 'file_1');

      expect(result).toEqual({ body, contentType: 'application/octet-stream' });
    });
  });
});

describe('events.stream over the real HttpClient', () => {
  it('sends auth + resume headers, then follows the SSE body', async () => {
    const encoder = new TextEncoder();
    const body = (frames: string[]) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (const frame of frames) controller.enqueue(encoder.encode(frame));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(body([sseFrame({ seq: 4, type: 'user.message', data: { content: 'hi' } })]))
      .mockResolvedValueOnce(body([sseFrame({ seq: 5, type: 'session.status_idle', data: { stop_reason: 'end_turn' } })]));
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);

    const events = await collect(
      new AgentSessionEventsResource(http).stream('conv_1', { after: 3, types: ['user.message', 'session.status_idle'], reconnectDelayMs: 0 }),
      2,
    );

    expect(events.map((e) => e.seq)).toEqual([4, 5]);
    const [firstUrl, firstInit] = fetchMock.mock.calls[0];
    expect(firstUrl).toBe('https://api.test/api/client/v1/agents/sessions/conv_1/events/stream?after=3&types=user.message%2Csession.status_idle');
    expect(firstInit.method).toBe('GET');
    expect(firstInit.headers.Authorization).toBe('Bearer sk-test');
    expect(firstInit.headers.Accept).toBe('text/event-stream');
    expect(firstInit.headers['Last-Event-ID']).toBe('3');
    const [secondUrl, secondInit] = fetchMock.mock.calls[1];
    expect(secondUrl).toContain('after=4');
    expect(secondInit.headers['Last-Event-ID']).toBe('4');
  });
});

describe('sessions over the real HttpClient', () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('create() POSTs the JSON body with auth, and list() pages through next_cursor in the query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(makeSession({ id: 'conv_9', runtime_status: 'idle' }), 201))
      .mockResolvedValueOnce(json(makeList(['s2'], 'cur 1/=')))
      .mockResolvedValueOnce(json(makeList(['s1'], null)));
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
    const sessions = new AgentSessionsResource(http);

    const created = await sessions.create({ agent: 'support-bot', metadata: { ticket: 'T-1' } });
    const ids: string[] = [];
    for await (const session of sessions.list({ agent: 'support-bot', status: 'idle', limit: 1 })) ids.push(session.id);

    expect(created.id).toBe('conv_9');
    expect(ids).toEqual(['s2', 's1']);
    const [createUrl, createInit] = fetchMock.mock.calls[0];
    expect(createUrl).toBe('https://api.test/api/client/v1/agents/sessions');
    expect(createInit.method).toBe('POST');
    expect(createInit.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(createInit.body)).toEqual({ agent: 'support-bot', metadata: { ticket: 'T-1' } });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/client/v1/agents/sessions?agent=support-bot&status=idle&limit=1');
    expect(fetchMock.mock.calls[2][0]).toBe(
      `https://api.test/api/client/v1/agents/sessions?agent=support-bot&status=idle&limit=1&after=${encodeURIComponent('cur 1/=').replace(/%20/g, '+')}`,
    );
  });

  it('delete() sends DELETE; a 409 arrives as a CognipeerAPIError with the code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'conv_1', object: 'agent.session', deleted: true }))
      .mockResolvedValueOnce(
        json({ error: { type: 'agent_run_conflict', code: 'agent_run_conflict', message: 'An active run exists' } }, 409),
      );
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
    const sessions = new AgentSessionsResource(http);

    expect(await sessions.delete('conv_1')).toEqual({ id: 'conv_1', object: 'agent.session', deleted: true });
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');

    const error = await sessions.delete('conv_2').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CognipeerAPIError);
    expect((error as CognipeerAPIError).statusCode).toBe(409);
    expect((error as CognipeerAPIError).errorCode).toBe('agent_run_conflict');
  });

  it('files.content() returns the bytes and the name; contentStream() the stream', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const reply = () =>
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-disposition': 'inline; filename="chart.png"', 'content-length': '4' },
      });
    const fetchMock = vi.fn().mockImplementation(async () => reply());
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
    const files = new AgentSessionFilesResource(http);

    const whole = await files.content('conv_1', 'file_1', { variant: 'markdown' });
    const streamed = await files.contentStream('conv_1', 'file_1');
    const read = new Uint8Array(await new Response(streamed.body).arrayBuffer());

    expect(whole).toMatchObject({ contentType: 'image/png', fileName: 'chart.png' });
    expect(Array.from(whole.data)).toEqual([1, 2, 3, 4]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/client/v1/agents/sessions/conv_1/files/file_1/content?variant=markdown');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/client/v1/agents/sessions/conv_1/files/file_1/content');
    expect(streamed).toMatchObject({ contentType: 'image/png', fileName: 'chart.png', size: 4 });
    expect(Array.from(read)).toEqual([1, 2, 3, 4]);
  });
});
