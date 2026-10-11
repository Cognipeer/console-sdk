import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentsResource, AgentResponsesResource, AgentRunsResource } from './agents';
import {
  AgentActionErrorCodes,
  AgentRunWaitTimeoutError,
  CognipeerAPIError,
  isAgentActionErrorCode,
} from '../types';
import { createMockHttp } from '../test/mockHttp';
import type {
  Agent,
  AgentChatRequest,
  AgentCreateRequest,
  AgentPublishRequest,
  AgentResponse,
  AgentResponseCreateRequest,
  AgentRun,
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

  it('chats with an agent (legacy format) without a conversationId', async () => {
    const http = createMockHttp();
    const apiResponse: AgentResponse = {
      id: 'resp_abc123',
      object: 'response',
      model: 'support-bot',
      output: [
        {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello there' }],
        },
      ],
      status: 'completed',
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      created_at: 1700000000,
      previous_response_id: null,
      version: null,
    };
    http.request.mockResolvedValue(apiResponse);
    const resource = new AgentsResource(http);

    const params: AgentChatRequest = { message: 'Hi!' };
    const result = await resource.chat('support-bot', params);

    expect(result).toEqual({
      content: 'Hello there',
      conversationId: 'abc123',
      agentKey: 'support-bot',
    });
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', {
      body: { model: 'support-bot', input: 'Hi!' },
    });
  });

  it('chats with an agent including previous_response_id when conversationId is given', async () => {
    const http = createMockHttp();
    const apiResponse: AgentResponse = {
      id: 'resp_def456',
      object: 'response',
      model: 'support-bot',
      output: [
        {
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Sure, tell me more.' }],
        },
      ],
      status: 'completed',
      usage: { input_tokens: 10, output_tokens: 6, total_tokens: 16 },
      created_at: 1700000001,
      previous_response_id: 'resp_conv_1',
      version: null,
    };
    http.request.mockResolvedValue(apiResponse);
    const resource = new AgentsResource(http);

    const params: AgentChatRequest = { message: 'Tell me more', conversationId: 'conv_1' };
    const result = await resource.chat('support-bot', params);

    expect(result).toEqual({
      content: 'Sure, tell me more.',
      conversationId: 'def456',
      agentKey: 'support-bot',
    });
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', {
      body: { model: 'support-bot', input: 'Tell me more', previous_response_id: 'resp_conv_1' },
    });
  });

  it('tells a paused agent from an empty answer in the legacy chat shape', async () => {
    const http = createMockHttp();
    const action = { id: 'act_1', status: 'pending' as const, kind: 'tool_approval' as const, tool_name: 'echo_note', args: { note: 'x' } };
    http.request.mockResolvedValue({
      id: 'resp_paused1',
      object: 'response',
      model: 'ops-agent',
      output: [],
      status: 'requires_action',
      stop_reason: 'requires_action',
      required_action: { type: 'agent_actions', actions: [action] },
      usage: { input_tokens: 5, output_tokens: 0, total_tokens: 5 },
      created_at: 1700000003,
      previous_response_id: null,
      version: null,
    } satisfies AgentResponse);
    const resource = new AgentsResource(http);

    const result = await resource.chat('ops-agent', { message: 'Clean up' });

    expect(result).toEqual({
      content: '',
      conversationId: 'paused1',
      agentKey: 'ops-agent',
      status: 'requires_action',
      pendingActions: [action],
    });
  });

  it('marks an incomplete turn without inventing pending actions', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({
      id: 'resp_inc1',
      object: 'response',
      model: 'support-bot',
      output: [],
      status: 'incomplete',
      incomplete_details: { reason: 'max_cost' },
      usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 },
      created_at: 1700000004,
      previous_response_id: null,
      version: null,
    } satisfies AgentResponse);
    const resource = new AgentsResource(http);

    expect(await resource.chat('support-bot', { message: 'Hi' })).toEqual({
      content: '',
      conversationId: 'inc1',
      agentKey: 'support-bot',
      status: 'incomplete',
    });
  });

  it('returns the response id unchanged as conversationId when it lacks the resp_ prefix', async () => {
    const http = createMockHttp();
    const apiResponse: AgentResponse = {
      id: 'plain-id-789',
      object: 'response',
      model: 'support-bot',
      output: [],
      status: 'completed',
      usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 },
      created_at: 1700000002,
      previous_response_id: null,
      version: null,
    };
    http.request.mockResolvedValue(apiResponse);
    const resource = new AgentsResource(http);

    const result = await resource.chat('support-bot', { message: 'Hi' });

    expect(result).toEqual({
      content: '',
      conversationId: 'plain-id-789',
      agentKey: 'support-bot',
    });
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
      usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
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
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
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
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
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

describe('AgentResponsesResource (background mode)', () => {
  it('sends background/callback fields in the body and returns the queued run', async () => {
    const http = createMockHttp();
    const queued: AgentRun = { id: 'run_abc', object: 'agent.run', status: 'queued', created_at: 1700000010 };
    http.request.mockResolvedValue(queued);
    const resource = new AgentResponsesResource(http);

    const params = {
      model: 'support-bot',
      input: 'Long task',
      background: true as const,
      callback_url: 'https://example.com/hook',
      callback_secret: 'a-very-long-secret-value',
    };
    const run = await resource.create(params);

    expect(run).toBe(queued);
    expect(run.status).toBe('queued');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', { body: params });
  });

  it('sends idempotencyKey as the Idempotency-Key header', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'run_abc', object: 'agent.run', status: 'queued', created_at: 1 });
    const resource = new AgentResponsesResource(http);
    const controller = new AbortController();

    await resource.create(
      { model: 'support-bot', input: 'x', background: true },
      { idempotencyKey: 'job-42', signal: controller.signal },
    );

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/responses', {
      body: { model: 'support-bot', input: 'x', background: true },
      headers: { 'Idempotency-Key': 'job-42' },
      signal: controller.signal,
    });
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
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
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
