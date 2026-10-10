import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AgentSessionActionsResource,
  AgentSessionEventsResource,
  AgentSessionFilesResource,
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
  AgentResponse,
  AgentRun,
  AgentSession,
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
  toolName: 'sandbox_exec',
  args: { cmd: 'ls' },
  status: 'pending',
  requestedAt: '2026-10-10T10:00:00.000Z',
};

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'conv_1',
    object: 'agent.session',
    agent: 'ops-agent',
    runtime_status: 'requires_action',
    stop_reason: 'requires_action',
    pending_actions: [approval],
    last_event_seq: 12,
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
    const run: AgentRun = { id: 'run_9', object: 'agent.run', status: 'queued', created_at: 1 };
    http.request.mockResolvedValue(run);
    const controller = new AbortController();

    const result = await new AgentSessionsResource(http).update(
      'conv_1',
      { budget: { maxCostUsd: 5, onReach: 'pause' }, resume: true },
      { signal: controller.signal },
    );

    expect(result).toBe(run);
    expect(http.request).toHaveBeenCalledWith('PATCH', SESSION_PATH, {
      body: { budget: { maxCostUsd: 5, onReach: 'pause' }, resume: true },
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
    createdAt: '2026-10-10T10:00:00.000Z',
    ...(seq === 1 ? { runId: 'run_a' } : {}),
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

    // The stream frames camelCase runId / createdAt; events are the list shape.
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
        sseFrame({ seq: 1, type: 'action.required', data: { actionId: 'act_1', kind: 'tool_approval', toolName: 'x' } }),
        sseFrame({ seq: 2, type: 'future.thing', data: { a: 1 } }),
      ]),
    );

    const events = await collect(new AgentSessionEventsResource(http).stream('conv_1', { maxReconnects: 0 }), 2);

    const [required, unknown] = events;
    expect(isSessionEvent(required, 'action.required')).toBe(true);
    if (isSessionEvent(required, 'action.required')) expect(required.data.actionId).toBe('act_1');
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
      approvedArgs: { cmd: 'ls -la' },
      rememberForSession: true,
    });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${SESSION_PATH}/actions/act_1`, {
      body: { decision: 'allow', comment: 'ok', approvedArgs: { cmd: 'ls -la' }, rememberForSession: true },
    });
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
});

// ── files ─────────────────────────────────────────────────────────

describe('AgentSessionFilesResource', () => {
  const stored: SessionFile = {
    id: 'file_1',
    object: 'agent.session.file',
    name: 'report.pdf',
    mime_type: 'application/pdf',
    size: 5,
    status: 'ready',
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
    http.requestRaw.mockResolvedValue({ file: stored });
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

  it('lists files from a bare array, { data } or { files }', async () => {
    const http = createMockHttp();
    const resource = new AgentSessionFilesResource(http);

    http.request.mockResolvedValueOnce([stored]);
    http.request.mockResolvedValueOnce({ object: 'list', data: [stored] });
    http.request.mockResolvedValueOnce({ files: [stored] });
    http.request.mockResolvedValueOnce({});

    expect(await resource.list('conv_1')).toEqual([stored]);
    expect(await resource.list('conv_1')).toEqual([stored]);
    expect(await resource.list('conv_1')).toEqual([stored]);
    expect(await resource.list('conv_1')).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', `${SESSION_PATH}/files`, {});
  });

  it('deletes a file via DELETE .../files/{fileId}', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'file_1', deleted: true });

    const result = await new AgentSessionFilesResource(http).delete('conv_1', 'file_1');

    expect(result).toEqual({ id: 'file_1', deleted: true });
    expect(http.request).toHaveBeenCalledWith('DELETE', `${SESSION_PATH}/files/file_1`, {});
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
      .mockResolvedValueOnce(body([sseFrame({ seq: 5, type: 'session.status_idle', data: { stopReason: 'end_turn' } })]));
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
