import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentsResource, AgentResponsesResource, AgentRunsResource } from './agents';
import { AgentRoutinesResource } from './agentRoutines';
import {
  AgentActionErrorCodes,
  AgentRunWaitTimeoutError,
  CognipeerAPIError,
  isAgentActionErrorCode,
  isAgentResponseFinal,
  isResponseStreamEvent,
} from '../types';
import { createMockHttp } from '../test/mockHttp';
import type {
  Agent,
  AgentCreateRequest,
  AgentPublishRequest,
  AgentResponse,
  AgentResponseCreateRequest,
  AgentResponseStreamEvent,
  AgentRun,
  AgentRunCreateRequest,
  AgentUpdateRequest,
  AgentVersion,
} from '../types';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    key: 'support-bot',
    name: 'Support Bot',
    config: { modelKey: 'gpt-4o' },
    status: 'active',
    ...overrides,
  };
}

describe('AgentsResource', () => {
  it('lists agents with a status filter via GET /api/client/v1/agents?status=...', async () => {
    const http = createMockHttp();
    const agents = [makeAgent()];
    http.request.mockResolvedValue({ agents });
    const resource = new AgentsResource(http);

    const result = await resource.list({ status: 'active' });

    expect(result).toBe(agents);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents?status=active');
  });

  it('lists agents with no query string when no filters are given', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ agents: [] });
    const resource = new AgentsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents');
  });

  it('defaults to an empty array when the agents envelope is empty', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new AgentsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
  });

  it('gets an agent by key via GET /api/client/v1/agents/{agentKey}', async () => {
    const http = createMockHttp();
    const agent = makeAgent();
    http.request.mockResolvedValue({ agent });
    const resource = new AgentsResource(http);

    const result = await resource.get('support-bot');

    expect(result).toBe(agent);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents/support-bot');
  });

  it('keeps the attachments block of the single-agent lookup', async () => {
    const http = createMockHttp();
    const attachments = {
      enabled: true,
      max_files: 10,
      max_file_size_mb: 20,
      allowed_mime_types: ['image/*', 'application/pdf'],
      accepts_images: true,
      outputs: { enabled: true, max_files_per_turn: 5, max_file_size_mb: 10, types: ['pdf', 'csv'] },
    };
    http.request.mockResolvedValue({ agent: makeAgent({ attachments }) });

    const agent = await new AgentsResource(http).get('support-bot');

    expect(agent.attachments).toEqual(attachments);
    expect(agent.attachments?.enabled && agent.attachments.accepts_images).toBe(true);
  });

  it('encodes the agent key in get()', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ agent: makeAgent() });
    const resource = new AgentsResource(http);

    await resource.get('agent/with slash');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/agents/${encodeURIComponent('agent/with slash')}`,
    );
  });

  it('creates an agent via POST /api/client/v1/agents', async () => {
    const http = createMockHttp();
    const agent = makeAgent();
    http.request.mockResolvedValue({ agent });
    const resource = new AgentsResource(http);

    const data: AgentCreateRequest = {
      name: 'Support Bot',
      config: { modelKey: 'gpt-4o' },
    };
    const result = await resource.create(data);

    expect(result).toBe(agent);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/agents', { body: data });
  });

  it('updates an agent via PATCH /api/client/v1/agents/{agentKey}', async () => {
    const http = createMockHttp();
    const agent = makeAgent({ name: 'Renamed Bot' });
    http.request.mockResolvedValue({ agent });
    const resource = new AgentsResource(http);

    const data: AgentUpdateRequest = { name: 'Renamed Bot' };
    const result = await resource.update('support-bot', data);

    expect(result).toBe(agent);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/agents/support-bot', {
      body: data,
    });
  });

  it('encodes the agent key in update()', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ agent: makeAgent() });
    const resource = new AgentsResource(http);

    await resource.update('agent/with slash', { name: 'x' });

    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      `/api/client/v1/agents/${encodeURIComponent('agent/with slash')}`,
      { body: { name: 'x' } },
    );
  });

  it('deletes an agent via DELETE /api/client/v1/agents/{agentKey}', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new AgentsResource(http);

    const result = await resource.delete('support-bot');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/agents/support-bot');
  });

  it('encodes the agent key in delete()', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ success: true });
    const resource = new AgentsResource(http);

    await resource.delete('agent/with slash');

    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      `/api/client/v1/agents/${encodeURIComponent('agent/with slash')}`,
    );
  });

  it('publishes an agent version via POST /api/client/v1/agents/{agentKey}/publish', async () => {
    const http = createMockHttp();
    const version: AgentVersion = { version: 2, changelog: 'Improved prompt' };
    http.request.mockResolvedValue({ version });
    const resource = new AgentsResource(http);

    const params: AgentPublishRequest = { changelog: 'Improved prompt' };
    const result = await resource.publish('support-bot', params);

    expect(result).toBe(version);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/agents/support-bot/publish',
      { body: params },
    );
  });

  it('defaults publish params to an empty object when omitted', async () => {
    const http = createMockHttp();
    const version: AgentVersion = { version: 1 };
    http.request.mockResolvedValue({ version });
    const resource = new AgentsResource(http);

    await resource.publish('support-bot');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/agents/support-bot/publish',
      { body: {} },
    );
  });

  it('no longer has the legacy chat() method', () => {
    expect((new AgentsResource(createMockHttp()) as unknown as Record<string, unknown>).chat).toBeUndefined();
  });

  it('exposes runs, routines and sessions', () => {
    const resource = new AgentsResource(createMockHttp());
    expect(resource.runs).toBeInstanceOf(AgentRunsResource);
    expect(resource.routines).toBeInstanceOf(AgentRoutinesResource);
    expect(resource.sessions).toBeDefined();
  });
});

describe('AgentResponsesResource', () => {
  it('creates a response via POST /api/client/v1/responses', async () => {
    const http = createMockHttp();
    const apiResponse: AgentResponse = {
      id: 'resp_1',
      object: 'response',
      model: 'support-bot',
      output: [
        {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello!' }],
        },
      ],
      status: 'completed',
      usage: { input_tokens: 5, input_tokens_details: { cached_tokens: 0 }, output_tokens: 2, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 7 },
      created_at: 1700000003,
      previous_response_id: null,
      version: null,
    };
    http.request.mockResolvedValue(apiResponse);
    const resource = new AgentResponsesResource(http);

    const params: AgentResponseCreateRequest = { model: 'support-bot', input: 'Hello!' };
    const result = await resource.create(params);

    expect(result).toBe(apiResponse);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', { body: params });
  });

  it('passes previous_response_id through when continuing a conversation', async () => {
    const http = createMockHttp();
    const apiResponse: AgentResponse = {
      id: 'resp_2',
      object: 'response',
      model: 'support-bot',
      output: [],
      status: 'completed',
      usage: { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 },
      created_at: 1700000004,
      previous_response_id: 'resp_1',
      version: null,
    };
    http.request.mockResolvedValue(apiResponse);
    const resource = new AgentResponsesResource(http);

    const params: AgentResponseCreateRequest = {
      model: 'support-bot',
      input: 'Tell me more',
      previous_response_id: 'resp_1',
    };
    const result = await resource.create(params);

    expect(result).toBe(apiResponse);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', { body: params });
  });
});

describe('AgentResponsesResource (session_id / conversation)', () => {
  const completed: AgentResponse = {
    id: 'resp_conv_1',
    object: 'response',
    model: 'support-bot',
    output: [],
    status: 'completed',
    usage: { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 },
    created_at: 1700000005,
    previous_response_id: null,
    version: null,
  };

  it('sends session_id as is, with a file the session already holds', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(completed);
    const params: AgentResponseCreateRequest = {
      model: 'support-bot',
      session_id: 'conv_1',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'What is the total?' },
            { type: 'input_file', file_id: 'file_1' },
          ],
        },
      ],
    };

    const result = await new AgentResponsesResource(http).create(params);

    expect(result).toBe(completed);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', { body: params });
    expect(http.request.mock.calls[0][2].body).not.toHaveProperty('previous_response_id');
  });

  it('accepts the OpenAI-style conversation alias as a string or { id }', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(completed);
    const resource = new AgentResponsesResource(http);

    await resource.create({ model: 'support-bot', input: 'hi', conversation: 'conv_1' });
    await resource.create({ model: 'support-bot', input: 'hi', conversation: { id: 'conv_1' } });

    expect(http.request.mock.calls.map((call) => call[2].body.conversation)).toEqual(['conv_1', { id: 'conv_1' }]);
  });

  it('lets the Console judge a session_id that disagrees with previous_response_id (400 session_conflict)', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('names different sessions', 400, 'invalid_request_error', {}, undefined, 'session_conflict'),
    );

    const error = await new AgentResponsesResource(http)
      .create({ model: 'support-bot', input: 'hi', session_id: 'conv_1', previous_response_id: 'resp_conv_2' })
      .catch((e: unknown) => e);

    expect(isAgentActionErrorCode(error, AgentActionErrorCodes.SessionConflict)).toBe(true);
  });

  it('a session started with sessions.create() continues with the same id on responses.create()', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce({ id: 'conv_7', object: 'agent.session', agent: 'support-bot' })
      .mockResolvedValueOnce(completed);
    const agents = new AgentsResource(http);

    const session = await agents.sessions.create({ agent: 'support-bot' });
    await agents.responses.create({ model: 'support-bot', session_id: session.id, input: 'hello' });

    expect(http.request.mock.calls[1][2].body).toEqual({ model: 'support-bot', session_id: 'conv_7', input: 'hello' });
  });
});

function makeResponse(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    id: 'resp_run_abc',
    object: 'response',
    model: 'support-bot',
    output: [],
    status: 'completed',
    usage: { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 },
    created_at: 1700000010,
    previous_response_id: null,
    version: 3,
    ...overrides,
  };
}

async function* fromArray<T>(items: T[]): AsyncGenerator<T, void, undefined> {
  yield* items;
}

describe('AgentResponsesResource (v4: published default, 202, structured output)', () => {
  it('sends the new agent fields as they are and does not invent a version', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeResponse());
    const params: AgentResponseCreateRequest = {
      model: 'support-bot',
      input: 'Extract it',
      text: { format: { type: 'json_schema', name: 'invoice', schema: { type: 'object' }, strict: true } },
      metadata: { ticket: 'OPS-12' },
      service_tier: 'flex',
      inputs: { customer: 'acme' },
      reasoning: { effort: 'xhigh' },
    };

    await new AgentResponsesResource(http).create(params);

    const sent = http.request.mock.calls[0][2].body;
    expect(sent).toEqual(params);
    expect(sent).not.toHaveProperty('version');
  });

  it('accepts version: "draft" and a pinned number', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeResponse());
    const resource = new AgentResponsesResource(http);

    await resource.create({ model: 'support-bot', input: 'x', version: 'draft' });
    await resource.create({ model: 'support-bot', input: 'x', version: 2 });

    expect(http.request.mock.calls.map((call) => call[2].body.version)).toEqual(['draft', 2]);
  });

  it('returns the response of a 202 (queued / in_progress) instead of throwing', async () => {
    const http = createMockHttp();
    const accepted = makeResponse({
      status: 'in_progress',
      output: [],
      background: true,
      cognipeer: { run_id: 'run_abc', session_id: 'conv_1' },
    });
    http.request.mockResolvedValue(accepted);

    const res = await new AgentResponsesResource(http).create({ model: 'support-bot', input: 'Long', background: true });

    expect(res).toBe(accepted);
    expect(res.status).toBe('in_progress');
    expect(res.cognipeer?.run_id).toBe('run_abc');
    expect(isAgentResponseFinal(res.status)).toBe(false);
    expect(isAgentResponseFinal('cancelled')).toBe(true);
  });

  it('reads a queued response (no usage yet) and a reasoning item before the answer', async () => {
    const http = createMockHttp();
    const queued = makeResponse({ status: 'queued', usage: null, background: true });
    const answered = makeResponse({
      output: [
        { id: 'rs_1', type: 'reasoning', summary: [{ type: 'summary_text', text: 'Thinking' }] },
        { id: 'msg_1', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done' }] },
      ],
      output_text: 'Done',
    });
    http.request.mockResolvedValueOnce(queued).mockResolvedValueOnce(answered);
    const resource = new AgentResponsesResource(http);

    const early = await resource.retrieve('resp_run_abc');
    const late = await resource.retrieve('resp_run_abc');

    expect(early.background).toBe(true);
    expect(early.usage).toBeNull();
    expect(late.output.map((item) => item.type)).toEqual(['reasoning', 'message']);
  });

  it('carries output_parsed / output_error / output_files on the response type', async () => {
    const http = createMockHttp();
    const res = makeResponse({
      output_text: '{"total":42}',
      output_parsed: { total: 42 },
      output_files: [{ id: 'f1', name: 'a.csv', mime_type: 'text/csv', size: 3, download_url: '/x' }],
    });
    http.request.mockResolvedValue(res);

    const out = await new AgentResponsesResource(http).create({ model: 'support-bot', input: 'x' });

    expect(out.output_parsed).toEqual({ total: 42 });
    expect(out.output_files?.[0].name).toBe('a.csv');
  });

  it('sends the idempotencyKey as the Idempotency-Key header', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeResponse());
    const controller = new AbortController();

    await new AgentResponsesResource(http).create(
      { model: 'support-bot', input: 'x', background: true, callback_url: 'https://example.com/hook', callback_secret: 'a-very-long-secret-value' },
      { idempotencyKey: 'job-42', signal: controller.signal },
    );

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', {
      body: {
        model: 'support-bot',
        input: 'x',
        background: true,
        callback_url: 'https://example.com/hook',
        callback_secret: 'a-very-long-secret-value',
      },
      headers: { 'Idempotency-Key': 'job-42' },
      signal: controller.signal,
    });
  });

  it('stream: true returns an iterator of typed response.* events (POST /responses via http.stream)', async () => {
    const http = createMockHttp();
    const events: AgentResponseStreamEvent[] = [
      { type: 'response.created', sequence_number: 0, response: makeResponse({ status: 'in_progress' }) },
      { type: 'response.output_text.delta', sequence_number: 1, item_id: 'msg_1', output_index: 0, content_index: 0, delta: 'Hel' },
      { type: 'response.output_text.delta', sequence_number: 2, item_id: 'msg_1', output_index: 0, content_index: 0, delta: 'lo' },
      { type: 'response.completed', sequence_number: 3, response: makeResponse({ output_text: 'Hello' }) },
    ];
    http.stream.mockReturnValue(fromArray(events));
    const resource = new AgentResponsesResource(http);

    const stream = await resource.create({ model: 'support-bot', input: 'Hi', stream: true });
    let text = '';
    let final: AgentResponse | undefined;
    for await (const event of stream) {
      if (isResponseStreamEvent(event, 'response.output_text.delta')) text += event.delta;
      if (isResponseStreamEvent(event, 'response.completed')) final = event.response;
    }

    expect(text).toBe('Hello');
    expect(final?.output_text).toBe('Hello');
    expect(http.request).not.toHaveBeenCalled();
    expect(http.stream).toHaveBeenCalledWith('POST', '/api/client/v1/responses', {
      body: { model: 'support-bot', input: 'Hi', stream: true },
      headers: undefined,
      signal: undefined,
    });
  });

  it('retrieve() reads GET /api/client/v1/responses/{id}', async () => {
    const http = createMockHttp();
    const res = makeResponse({ status: 'queued' });
    http.request.mockResolvedValue(res);

    const out = await new AgentResponsesResource(http).retrieve('resp_run_a/b');

    expect(out).toBe(res);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/responses/resp_run_a%2Fb', {});
  });

  it('cancel() posts to /api/client/v1/responses/{id}/cancel and returns the response', async () => {
    const http = createMockHttp();
    const res = makeResponse({ status: 'cancelled' });
    http.request.mockResolvedValue(res);

    const out = await new AgentResponsesResource(http).cancel('resp_run_abc');

    expect(out.status).toBe('cancelled');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses/resp_run_abc/cancel', { body: {} });
  });
});

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run_abc',
    object: 'agent.run',
    status: 'running',
    agent: 'support-bot',
    conversation_id: 'conv_1',
    result: null,
    error: null,
    created_at: 1700000000,
    started_at: 1700000001,
    completed_at: null,
    ...overrides,
  };
}

describe('AgentRunsResource', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is exposed as client.agents.runs', () => {
    const resource = new AgentsResource(createMockHttp());
    expect(resource.runs).toBeInstanceOf(AgentRunsResource);
  });

  it('gets a run via GET /api/client/v1/agents/runs/{runId}, passing the run_ id through', async () => {
    const http = createMockHttp();
    const run = makeRun();
    http.request.mockResolvedValue(run);
    const resource = new AgentRunsResource(http);

    const result = await resource.get('run_abc');

    expect(result).toBe(run);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents/runs/run_abc', {});
  });

  it('encodes the run id', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeRun());
    const resource = new AgentRunsResource(http);

    await resource.get('run_a/b');

    expect(http.request).toHaveBeenCalledWith('GET', `/api/client/v1/agents/runs/${encodeURIComponent('run_a/b')}`, {});
  });

  it('cancels a run via POST /api/client/v1/agents/runs/{runId}/cancel', async () => {
    const http = createMockHttp();
    const run = makeRun({ status: 'running' });
    http.request.mockResolvedValue(run);
    const resource = new AgentRunsResource(http);

    const result = await resource.cancel('run_abc');

    expect(result).toBe(run);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/agents/runs/run_abc/cancel', { body: {} });
  });

  it('surfaces agent_run_already_terminal from cancel()', async () => {
    const http = createMockHttp();
    http.request.mockRejectedValue(
      new CognipeerAPIError('already succeeded', 409, 'agent_run_already_terminal', undefined, undefined, 'agent_run_already_terminal'),
    );
    const resource = new AgentRunsResource(http);

    await expect(resource.cancel('run_abc')).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'agent_run_already_terminal',
    });
  });

  it('wait() polls until the run is terminal and returns it', async () => {
    vi.useFakeTimers();
    const http = createMockHttp();
    const done = makeRun({ status: 'succeeded', completed_at: 1700000009 });
    http.request
      .mockResolvedValueOnce(makeRun({ status: 'queued' }))
      .mockResolvedValueOnce(makeRun({ status: 'running' }))
      .mockResolvedValueOnce(done);
    const resource = new AgentRunsResource(http);

    const promise = resource.wait('run_abc', { pollIntervalMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    expect(http.request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toBe(done);
    expect(http.request).toHaveBeenCalledTimes(3);
  });

  it.each(['failed', 'canceled'] as const)('wait() resolves (does not throw) on %s', async (status) => {
    const http = createMockHttp();
    const run = makeRun({ status, error: { type: 'agent_error', message: 'boom' } });
    http.request.mockResolvedValue(run);
    const resource = new AgentRunsResource(http);

    await expect(resource.wait('run_abc')).resolves.toBe(run);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('wait() returns a run that reached requires_action instead of polling forever', async () => {
    const http = createMockHttp();
    const paused = makeRun({
      status: 'requires_action',
      stop_reason: 'requires_action',
      result: {
        id: 'resp_run_abc',
        object: 'response',
        model: 'support-bot',
        output: [],
        status: 'requires_action',
        stop_reason: 'requires_action',
        required_action: {
          type: 'agent_actions',
          actions: [
            {
              id: 'act_1',
              kind: 'tool_approval',
              tool_name: 'sandbox_exec',
              status: 'pending',
              requested_at: '2026-10-10T10:00:00.000Z',
            },
          ],
        },
        usage: { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 },
        created_at: 1700000005,
        previous_response_id: null,
        version: null,
      },
    });
    http.request.mockResolvedValueOnce(makeRun({ status: 'running' })).mockResolvedValueOnce(paused);
    const resource = new AgentRunsResource(http);

    const result = await resource.wait('run_abc', { pollIntervalMs: 0 });

    expect(result).toBe(paused);
    expect(result.result?.required_action?.actions[0].id).toBe('act_1');
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('wait() throws AgentRunWaitTimeoutError carrying the last run once timeoutMs elapses', async () => {
    vi.useFakeTimers();
    const http = createMockHttp();
    http.request.mockResolvedValue(makeRun({ status: 'running' }));
    const resource = new AgentRunsResource(http);

    const promise = resource.wait('run_abc', { pollIntervalMs: 1000, timeoutMs: 2500 });
    const expectation = expect(promise).rejects.toBeInstanceOf(AgentRunWaitTimeoutError);
    await vi.advanceTimersByTimeAsync(3000);
    await expectation;
    await promise.catch((error: AgentRunWaitTimeoutError) => {
      expect(error.runId).toBe('run_abc');
      expect(error.timeoutMs).toBe(2500);
      expect(error.lastRun.status).toBe('running');
    });
    // polls at t=0, 1000, 2000, then the capped 500ms sleep to t=2500
    expect(http.request).toHaveBeenCalledTimes(4);
  });

  it('wait() stops polling when the signal aborts', async () => {
    vi.useFakeTimers();
    const http = createMockHttp();
    http.request.mockResolvedValue(makeRun({ status: 'running' }));
    const resource = new AgentRunsResource(http);
    const controller = new AbortController();

    const promise = resource.wait('run_abc', { pollIntervalMs: 1000, signal: controller.signal });
    const expectation = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expectation;
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents/runs/run_abc', {
      query: { wait: 20 },
      signal: controller.signal,
    });
  });

  it('wait() rejects immediately for an already-aborted signal without polling', async () => {
    const http = createMockHttp();
    const resource = new AgentRunsResource(http);
    const controller = new AbortController();
    controller.abort(new Error('stop'));

    await expect(resource.wait('run_abc', { signal: controller.signal })).rejects.toThrow('stop');
    expect(http.request).not.toHaveBeenCalled();
  });
});

describe('AgentRunsResource (v4)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('create() posts to /agents/{key}/runs with a generated Idempotency-Key and returns the run', async () => {
    const http = createMockHttp();
    const queued = makeRun({ status: 'queued' });
    http.request.mockResolvedValue(queued);
    const body: AgentRunCreateRequest = {
      input: 'Weekly numbers',
      inputs: { team: 'ops' },
      class: 'deferred',
      version: 'draft',
      delay_seconds: 3600,
      metadata: { ticket: 'OPS-12' },
      callback: { url: 'https://example.com/hook', secret: 'a-very-long-secret-value' },
      response_format: { type: 'json_schema', json_schema: { name: 'x', schema: { type: 'object' } } },
    };

    const run = await new AgentRunsResource(http).create('report/bot', body);

    expect(run).toBe(queued);
    const [method, path, request] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/api/client/v1/agents/report%2Fbot/runs');
    expect(request.body).toEqual(body);
    expect(request.headers['Idempotency-Key']).toMatch(/\S{8,}/);
    expect(request.headers).not.toHaveProperty('Prefer');
  });

  it('create() uses the given idempotency key and builds the Prefer header', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeRun());
    const resource = new AgentRunsResource(http);

    await resource.create('bot', { input: 'x' }, { idempotencyKey: 'job-1', prefer: { wait: 30 } });
    await resource.create('bot', { input: 'x' }, { prefer: { respondAsync: true } });
    await resource.create('bot', { input: 'x' }, { prefer: 'wait=5, respond-async' });

    expect(http.request.mock.calls[0][2].headers).toEqual({ 'Idempotency-Key': 'job-1', Prefer: 'wait=30' });
    expect(http.request.mock.calls[1][2].headers.Prefer).toBe('respond-async');
    expect(http.request.mock.calls[2][2].headers.Prefer).toBe('wait=5, respond-async');
    // two calls without a key never share one
    expect(http.request.mock.calls[1][2].headers['Idempotency-Key']).not.toBe(
      http.request.mock.calls[2][2].headers['Idempotency-Key'],
    );
  });

  it('create() with wait passes it in the body; a 202 run (running) is returned, not thrown', async () => {
    const http = createMockHttp();
    const running = makeRun({ status: 'running', detached_at: 1700000030 });
    http.request.mockResolvedValue(running);

    const run = await new AgentRunsResource(http).create('bot', { input: 'x', wait: 30 });

    expect(run.status).toBe('running');
    expect(http.request.mock.calls[0][2].body.wait).toBe(30);
  });

  it('create() with stream: true yields response.* events and still sends an Idempotency-Key', async () => {
    const http = createMockHttp();
    http.stream.mockReturnValue(
      fromArray([{ type: 'response.completed', sequence_number: 1, response: makeResponse() }] as AgentResponseStreamEvent[]),
    );

    const stream = await new AgentRunsResource(http).create('bot', { input: 'x', stream: true, on_disconnect: 'cancel' });
    const seen: string[] = [];
    for await (const event of stream) seen.push(event.type);

    expect(seen).toEqual(['response.completed']);
    expect(http.stream).toHaveBeenCalledWith('POST', '/api/client/v1/agents/bot/runs', {
      body: { input: 'x', stream: true, on_disconnect: 'cancel' },
      headers: { 'Idempotency-Key': expect.stringMatching(/\S{8,}/) },
      signal: undefined,
    });
  });

  it('list() sends filters (status csv, metadata[k], dates) and pages with the last_id cursor', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce({ object: 'list', data: [makeRun({ id: 'run_3' }), makeRun({ id: 'run_2' })], first_id: 'run_3', last_id: 'run_2', has_more: true })
      .mockResolvedValueOnce({ object: 'list', data: [makeRun({ id: 'run_1' })], first_id: 'run_1', last_id: 'run_1', has_more: false });
    const resource = new AgentRunsResource(http);

    const page = await resource.list({
      agent: 'bot',
      status: ['queued', 'running'],
      class: 'deferred',
      metadata: { ticket: 'OPS-12' },
      created_after: new Date(1_700_000_000_000),
      created_before: '2026-10-18T00:00:00Z',
      limit: 2,
    });

    expect(page.data.map((r) => r.id)).toEqual(['run_3', 'run_2']);
    expect(page.hasNextPage()).toBe(true);
    expect(http.request.mock.calls[0][1]).toBe('/api/client/v1/agents/runs');
    expect(http.request.mock.calls[0][2].query).toMatchObject({
      agent: 'bot',
      status: 'queued,running',
      class: 'deferred',
      'metadata[ticket]': 'OPS-12',
      created_after: 1_700_000_000,
      created_before: '2026-10-18T00:00:00Z',
      limit: 2,
      after: undefined,
    });

    const next = await page.getNextPage();
    expect(next?.data.map((r) => r.id)).toEqual(['run_1']);
    expect(http.request.mock.calls[1][2].query.after).toBe('run_2');
    expect(await next?.getNextPage()).toBeNull();
    expect(page.toJSON()).toMatchObject({ object: 'list', last_id: 'run_2', has_more: true });
  });

  it('list() is an async iterator over every run of every page', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce({ object: 'list', data: [makeRun({ id: 'run_2' })], first_id: 'run_2', last_id: 'run_2', has_more: true })
      .mockResolvedValueOnce({ object: 'list', data: [makeRun({ id: 'run_1' })], first_id: 'run_1', last_id: 'run_1', has_more: false });

    const ids: string[] = [];
    for await (const run of new AgentRunsResource(http).list({ status: 'failed' })) ids.push(run.id);

    expect(ids).toEqual(['run_2', 'run_1']);
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('get() long-polls with ?wait= when asked', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeRun());
    const resource = new AgentRunsResource(http);

    await resource.get('run_abc', { wait: 25 });
    await resource.get('run_abc', { wait: 0 });

    expect(http.request.mock.calls[0][2].query).toEqual({ wait: 25 });
    expect(http.request.mock.calls[1][2].query).toBeUndefined();
  });

  it('wait() uses one long-poll (?wait=20) instead of polling every second', async () => {
    const http = createMockHttp();
    const done = makeRun({ status: 'succeeded', output_text: 'ok' });
    http.request.mockResolvedValue(done);

    const result = await new AgentRunsResource(http).wait('run_abc');

    expect(result).toBe(done);
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request.mock.calls[0][2].query).toEqual({ wait: 20 });
  });

  it('wait() keeps long-polling while the run is going and caps waitSeconds below the client timeout', async () => {
    vi.useFakeTimers();
    const http = createMockHttp();
    http.getTimeoutMs.mockReturnValue(10_000);
    http.request
      .mockResolvedValueOnce(makeRun({ status: 'running' }))
      .mockResolvedValueOnce(makeRun({ status: 'canceled', error: { type: 'canceled', message: null } }));

    const promise = new AgentRunsResource(http).wait('run_abc', { waitSeconds: 60, pollIntervalMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    const run = await promise;

    expect(run.status).toBe('canceled');
    expect(http.request.mock.calls.map((call) => call[2].query)).toEqual([{ wait: 5 }, { wait: 5 }]);
  });

  it('wait() asks for no more than the time left before timeoutMs', async () => {
    vi.useFakeTimers();
    const http = createMockHttp();
    http.request.mockResolvedValue(makeRun({ status: 'queued' }));

    const promise = new AgentRunsResource(http).wait('run_abc', { timeoutMs: 3500, pollIntervalMs: 500 });
    const expectation = expect(promise).rejects.toBeInstanceOf(AgentRunWaitTimeoutError);
    await vi.advanceTimersByTimeAsync(4000);
    await expectation;

    expect(http.request.mock.calls[0][2].query).toEqual({ wait: 3 });
  });

  it('queue() reads GET /agents/runs/queue', async () => {
    const http = createMockHttp();
    const queue = {
      object: 'agent.run_queue',
      default: { running: 1, queued: 0, scheduled: 2, limit: 250 },
      deferred: { running: 0, queued: 4, scheduled: 0, running_limit: 2, queued_limit: 10000, oldest_queued_at: 1700000000 },
    };
    http.request.mockResolvedValue(queue);

    expect(await new AgentRunsResource(http).queue()).toBe(queue);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents/runs/queue', {});
  });

  it("events() lists a run's events with after_seq; events.list() is the same", async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ object: 'list', events: [], has_more: false, last_seq: 7 });
    const resource = new AgentRunsResource(http);

    await resource.events('run_abc', { after: 7, types: ['agent.message'], limit: 10 });
    await resource.events.list('run_abc');

    expect(http.request.mock.calls[0][1]).toBe('/api/client/v1/agents/runs/run_abc/events');
    expect(http.request.mock.calls[0][2].query).toEqual({ after_seq: 7, types: 'agent.message', limit: 10 });
    expect(http.request.mock.calls[1][1]).toBe('/api/client/v1/agents/runs/run_abc/events');
  });

  it('events.stream() follows /agents/runs/{id}/events/stream with Last-Event-ID resume', async () => {
    const http = createMockHttp();
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          enc.encode('id: 3\nevent: agent.message\ndata: {"seq":3,"type":"agent.message","data":{"text":"hi"},"created_at":"2026-10-17T10:00:00Z"}\n\n'),
        );
      },
    });
    http.requestStream.mockResolvedValue({ body, headers: new Headers(), status: 200 });
    const controller = new AbortController();
    const iterator = new AgentRunsResource(http).events.stream('run_abc', { after: 2, signal: controller.signal });

    const first = await iterator.next();
    controller.abort();
    await iterator.return(undefined);

    expect(first.value).toMatchObject({ type: 'agent.message', seq: 3 });
    expect(http.requestStream.mock.calls[0][1]).toBe('/api/client/v1/agents/runs/run_abc/events/stream');
    expect(http.requestStream.mock.calls[0][2].query).toEqual({ after_seq: 2, types: undefined });
    expect(http.requestStream.mock.calls[0][2].headers['Last-Event-ID']).toBe('2');
  });

  it('resolveAction() posts to /agents/runs/{id}/actions/{actionId}', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeResponse());

    await new AgentRunsResource(http).resolveAction('run_abc', 'act_1', { decision: 'allow' });

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/agents/runs/run_abc/actions/act_1', {
      body: { decision: 'allow' },
      signal: undefined,
    });
  });

  it('resolveAction() with background: true asks for the queued run (202)', async () => {
    const http = createMockHttp();
    const queued = makeRun({ status: 'queued' });
    http.request.mockResolvedValue(queued);

    const out = await new AgentRunsResource(http).resolveAction('run_abc', 'act_1', { decision: 'deny' }, { background: true });

    expect(out.status).toBe('queued');
    expect(http.request.mock.calls[0][2].body).toEqual({ decision: 'deny', background: true });
  });
});
