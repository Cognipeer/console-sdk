import { describe, it, expect } from 'vitest';
import { ToolsResource } from './tools';
import { createMockHttp } from '../test/mockHttp';
import type { AgentToolDefinition, ToolCreateRequest, ToolDefinition, ToolUpdateRequest } from '../types';

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    key: 'weather-api',
    name: 'Weather API',
    type: 'openapi',
    status: 'active',
    actions: [],
    ...overrides,
  };
}

describe('ToolsResource', () => {
  it('lists tools with status and type filters baked into the query string', async () => {
    const http = createMockHttp();
    const tools = [makeTool()];
    http.request.mockResolvedValue({ tools });
    const resource = new ToolsResource(http);

    const result = await resource.list({ status: 'active', type: 'openapi' });

    expect(result).toBe(tools);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/tools?status=active&type=openapi',
    );
  });

  it('lists tools with no query string when no options are given', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ tools: [] });
    const resource = new ToolsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/tools');
  });

  it('gets a tool by key via GET /api/client/v1/tools/{toolKey}', async () => {
    const http = createMockHttp();
    const tool = makeTool();
    http.request.mockResolvedValue({ tool });
    const resource = new ToolsResource(http);

    const result = await resource.get('weather-api');

    expect(result).toBe(tool);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/tools/weather-api');
  });

  it('creates a tool via POST /api/client/v1/tools', async () => {
    const http = createMockHttp();
    const tool = makeTool();
    http.request.mockResolvedValue({ tool });
    const resource = new ToolsResource(http);

    const params: ToolCreateRequest = {
      name: 'Weather API',
      type: 'openapi',
      openApiSpec: 'https://example.com/openapi.json',
    };
    const result = await resource.create(params);

    expect(result).toBe(tool);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/tools', { body: params });
  });

  it('updates a tool via PATCH /api/client/v1/tools/{toolKey}', async () => {
    const http = createMockHttp();
    const tool = makeTool({ name: 'Weather API v2' });
    http.request.mockResolvedValue({ tool });
    const resource = new ToolsResource(http);

    const params: ToolUpdateRequest = { name: 'Weather API v2' };
    const result = await resource.update('weather-api', params);

    expect(result).toBe(tool);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/tools/weather-api', {
      body: params,
    });
  });

  it('encodes the tool key when updating', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ tool: makeTool() });
    const resource = new ToolsResource(http);

    await resource.update('tool/with space', { name: 'x' });

    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      `/api/client/v1/tools/${encodeURIComponent('tool/with space')}`,
      { body: { name: 'x' } },
    );
  });

  it('re-syncs tool actions via POST /api/client/v1/tools/{toolKey}/sync', async () => {
    const http = createMockHttp();
    const tool = makeTool();
    http.request.mockResolvedValue({ tool });
    const resource = new ToolsResource(http);

    const result = await resource.syncActions('weather-api');

    expect(result).toBe(tool);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/tools/weather-api/sync');
  });

  it('deletes a tool via DELETE /api/client/v1/tools/{toolKey}', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new ToolsResource(http);

    const result = await resource.delete('weather-api');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/tools/weather-api');
  });

  it('lists actions for a tool via the underlying get() call', async () => {
    const http = createMockHttp();
    const tool = makeTool({
      actions: [{ key: 'get-forecast', name: 'Get forecast' }],
    });
    http.request.mockResolvedValue({ tool });
    const resource = new ToolsResource(http);

    const result = await resource.listActions('weather-api');

    expect(result).toBe(tool.actions);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/tools/weather-api');
  });

  it('returns an empty array from listActions when the tool has no actions', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ tool: makeTool({ actions: undefined }) });
    const resource = new ToolsResource(http);

    const result = await resource.listActions('weather-api');

    expect(result).toEqual([]);
  });

  it('executes a tool action via POST /api/client/v1/tools/{toolKey}/actions/{actionKey}/execute', async () => {
    const http = createMockHttp();
    const response = {
      result: { forecast: 'sunny' },
      latencyMs: 120,
      toolKey: 'weather-api',
      actionKey: 'get-forecast',
    };
    http.request.mockResolvedValue(response);
    const resource = new ToolsResource(http);

    const result = await resource.execute('weather-api', 'get-forecast', { city: 'Paris' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tools/weather-api/actions/get-forecast/execute',
      { body: { arguments: { city: 'Paris' } } },
    );
  });

  it('defaults execute arguments to an empty object when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({
      result: null,
      latencyMs: 10,
      toolKey: 'weather-api',
      actionKey: 'get-forecast',
    });
    const resource = new ToolsResource(http);

    await resource.execute('weather-api', 'get-forecast');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/tools/weather-api/actions/get-forecast/execute',
      { body: { arguments: {} } },
    );
  });

  it('converts tool actions into agent-sdk adapters via toAgentTools()', async () => {
    const http = createMockHttp();
    const tool = makeTool({
      actions: [
        { key: 'get-forecast', name: 'Get forecast', description: 'Fetches forecast', inputSchema: { type: 'object' } },
      ],
    });
    http.request.mockResolvedValueOnce({ tool });
    const resource = new ToolsResource(http);

    const adapters = await resource.toAgentTools('weather-api');

    expect(http.request).toHaveBeenNthCalledWith(1, 'GET', '/api/client/v1/tools/weather-api');
    expect(adapters).toHaveLength(1);
    expect(adapters[0].name).toBe('Get forecast');
    expect(adapters[0].description).toBe('Fetches forecast');
    expect(adapters[0].schema).toEqual({ type: 'object' });

    const executeResponse = {
      result: { forecast: 'sunny' },
      latencyMs: 50,
      toolKey: 'weather-api',
      actionKey: 'get-forecast',
    };
    http.request.mockResolvedValueOnce(executeResponse);

    const invokeResult = await adapters[0].invoke({ city: 'Paris' });

    expect(invokeResult).toBe(executeResponse.result);
    expect(http.request).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/api/client/v1/tools/weather-api/actions/get-forecast/execute',
      { body: { arguments: { city: 'Paris' } } },
    );
  });

  it('falls back to the action name as description when toAgentTools has none', async () => {
    const http = createMockHttp();
    const tool = makeTool({
      actions: [{ key: 'get-forecast', name: 'Get forecast' }],
    });
    http.request.mockResolvedValueOnce({ tool });
    const resource = new ToolsResource(http);

    const adapters = await resource.toAgentTools('weather-api');

    expect(adapters[0].description).toBe('Get forecast');
  });

  it('lists legacy agent tools via GET /api/client/v1/agents/{agentKey}/tools', async () => {
    const http = createMockHttp();
    const tools: AgentToolDefinition[] = [{ key: 'get-forecast', name: 'Get forecast' }];
    http.request.mockResolvedValue({ tools });
    const resource = new ToolsResource(http);

    const result = await resource.listAgentTools('support-bot');

    expect(result).toBe(tools);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/agents/support-bot/tools');
  });

  it('returns an empty array from listAgentTools when the envelope has no tools', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new ToolsResource(http);

    const result = await resource.listAgentTools('support-bot');

    expect(result).toEqual([]);
  });

  it('executes a legacy agent tool via POST /api/client/v1/agents/{agentKey}/tools/{toolKey}/execute', async () => {
    const http = createMockHttp();
    const response = { result: { forecast: 'sunny' } };
    http.request.mockResolvedValue(response);
    const resource = new ToolsResource(http);

    const result = await resource.executeAgentTool('support-bot', 'weather-api', { city: 'Paris' });

    expect(result).toBe(response.result);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/agents/support-bot/tools/weather-api/execute',
      { body: { arguments: { city: 'Paris' } } },
    );
  });

  it('defaults legacy executeAgentTool arguments to an empty object when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ result: null });
    const resource = new ToolsResource(http);

    await resource.executeAgentTool('support-bot', 'weather-api');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/agents/support-bot/tools/weather-api/execute',
      { body: { arguments: {} } },
    );
  });
});
