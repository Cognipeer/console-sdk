import { describe, it, expect } from 'vitest';
import { TracingResource } from './tracing';
import { createMockHttp } from '../test/mockHttp';
import { CognipeerAPIError } from '../types';
import type {
  OtlpExportTraceServiceRequest,
  TracingEvent,
  TracingSessionRequest,
  TracingStreamEndRequest,
  TracingStreamStartRequest,
  TracingThreadDetail,
  TracingThreadListResponse,
} from '../types';

describe('TracingResource', () => {
  it('ingests a full session via POST /api/client/v1/tracing/sessions', async () => {
    const http = createMockHttp();
    const response = { success: true, sessionId: 'sess_1', eventsStored: 2 };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const data: TracingSessionRequest = { sessionId: 'sess_1', agent: { name: 'support-bot' } };
    const result = await resource.ingest(data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/tracing/sessions', {
      body: data,
    });
  });

  it('starts a streaming session with the given data via POST .../stream/{sessionId}/start', async () => {
    const http = createMockHttp();
    const response = { success: true, sessionId: 'sess_1', status: 'running' };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const data: TracingStreamStartRequest = { agent: { name: 'support-bot' } };
    const result = await resource.startStream('sess_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tracing/sessions/stream/sess_1/start',
      { body: data },
    );
  });

  it('defaults startStream data to an empty object when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ success: true, sessionId: 'sess_1', status: 'running' });
    const resource = new TracingResource(http);

    await resource.startStream('sess_1');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tracing/sessions/stream/sess_1/start',
      { body: {} },
    );
  });

  it('encodes the session id when starting a stream', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ success: true, sessionId: 'sess/1', status: 'running' });
    const resource = new TracingResource(http);

    await resource.startStream('sess/with space');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      `/api/client/v1/tracing/sessions/stream/${encodeURIComponent('sess/with space')}/start`,
      { body: {} },
    );
  });

  it('appends an event wrapped in an object via POST .../stream/{sessionId}/events', async () => {
    const http = createMockHttp();
    const response = { success: true, sessionId: 'sess_1', eventId: 'evt_1', totalEvents: 1 };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const event: TracingEvent = { type: 'llm_end', inputTokens: 120, outputTokens: 80 };
    const result = await resource.appendEvent('sess_1', event);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tracing/sessions/stream/sess_1/events',
      { body: { event } },
    );
  });

  it('ends a streaming session with the given data via POST .../stream/{sessionId}/end', async () => {
    const http = createMockHttp();
    const response = { success: true, sessionId: 'sess_1', status: 'success', totalEvents: 3 };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const data: TracingStreamEndRequest = { status: 'success' };
    const result = await resource.endStream('sess_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tracing/sessions/stream/sess_1/end',
      { body: data },
    );
  });

  it('defaults endStream data to an empty object when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ success: true, sessionId: 'sess_1', status: 'success', totalEvents: 0 });
    const resource = new TracingResource(http);

    await resource.endStream('sess_1');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tracing/sessions/stream/sess_1/end',
      { body: {} },
    );
  });

  it('ingests OTLP spans via POST /api/client/v1/traces', async () => {
    const http = createMockHttp();
    const response = { success: true, spansProcessed: 1, sessionsIngested: 1, eventsStored: 1 };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const payload: OtlpExportTraceServiceRequest = { resourceSpans: [{ resource: {} }] };
    const result = await resource.ingestOtlp(payload);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/traces', { body: payload });
  });

  it('lists tracing threads with query filters via GET /api/client/v1/tracing/threads', async () => {
    const http = createMockHttp();
    const response: TracingThreadListResponse = { threads: [], total: 0 };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const query = { agent: 'support-bot', limit: 20 };
    const result = await resource.listThreads(query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/tracing/threads', { query });
  });

  it('passes an undefined query through to listThreads when omitted', async () => {
    const http = createMockHttp();
    const response: TracingThreadListResponse = { threads: [], total: 0 };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    await resource.listThreads();

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/tracing/threads', {
      query: undefined,
    });
  });

  it('gets a thread detail via GET /api/client/v1/tracing/threads/{threadId}', async () => {
    const http = createMockHttp();
    const response: TracingThreadDetail = {
      threadId: 'thread_1',
      status: 'completed',
      agents: ['support-bot'],
      sessionsCount: 1,
      totalDurationMs: 1000,
      totalEvents: 5,
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalCachedInputTokens: 0,
      modelsUsed: ['gpt-4o-mini'],
      toolsUsed: [],
      sessions: [],
    };
    http.request.mockResolvedValue(response);
    const resource = new TracingResource(http);

    const result = await resource.getThread('thread_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/tracing/threads/thread_1');
  });

  it('encodes the thread id when getting a thread', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({} as TracingThreadDetail);
    const resource = new TracingResource(http);

    await resource.getThread('thread/with space');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/tracing/threads/${encodeURIComponent('thread/with space')}`,
    );
  });

  it('resolves to null when the thread does not exist (404)', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(new CognipeerAPIError('Not Found', 404));
    const resource = new TracingResource(http);

    const result = await resource.getThread('missing-thread');

    expect(result).toBeNull();
  });

  it('rethrows non-404 errors from getThread', async () => {
    const http = createMockHttp();
    const error = new CognipeerAPIError('Internal Server Error', 500);
    http.request.mockRejectedValue(error);
    const resource = new TracingResource(http);

    await expect(resource.getThread('thread_1')).rejects.toBe(error);
  });

  it('rethrows non-API errors from getThread', async () => {
    const http = createMockHttp();
    const error = new Error('network down');
    http.request.mockRejectedValue(error);
    const resource = new TracingResource(http);

    await expect(resource.getThread('thread_1')).rejects.toBe(error);
  });
});
