import { describe, it, expect } from 'vitest';
import { AgentsResource, AgentResponsesResource } from './agents';
import { createMockHttp } from '../test/mockHttp';
import type {
  Agent,
  AgentChatRequest,
  AgentCreateRequest,
  AgentPublishRequest,
  AgentResponse,
  AgentResponseCreateRequest,
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
