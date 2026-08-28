import { describe, it, expect } from 'vitest';
import { McpResource, McpServerHandle, McpHubsResource } from './mcp';
import { createMockHttp } from '../test/mockHttp';

describe('McpResource', () => {
  it('wires up the console handle and hubs sub-resource', () => {
    const http = createMockHttp();
    const resource = new McpResource(http);

    expect(resource.console).toBeInstanceOf(McpServerHandle);
    expect(resource.console.serverKey).toBe('console');
    expect(resource.hubs).toBeInstanceOf(McpHubsResource);
  });

  it('returns a server handle scoped to the given server key', () => {
    const http = createMockHttp();
    const resource = new McpResource(http);

    const handle = resource.server('my server');

    expect(handle).toBeInstanceOf(McpServerHandle);
    expect(handle.serverKey).toBe('my server');
    expect(handle.getSseUrl()).toContain('/api/client/v1/mcp/my%20server/sse');
  });

  it('creates a tenant MCP server', async () => {
    const http = createMockHttp();
    const server = { key: 'srv1', name: 'My Server' };
    http.request.mockResolvedValue({ server });
    const resource = new McpResource(http);

    const result = await resource.createServer({ name: 'My Server' } as never);

    expect(result).toBe(server);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/mcp', {
      body: { name: 'My Server' },
    });
  });

  it('updates a tenant MCP server', async () => {
    const http = createMockHttp();
    const server = { key: 'srv1', name: 'Renamed' };
    http.request.mockResolvedValue({ server });
    const resource = new McpResource(http);

    const result = await resource.updateServer('srv1', { name: 'Renamed' } as never);

    expect(result).toBe(server);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/mcp/srv1', {
      body: { name: 'Renamed' },
    });
  });

  it('deletes a tenant MCP server', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new McpResource(http);

    const result = await resource.deleteServer('srv1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/mcp/srv1');
  });

  it('refreshes tool discovery for a tenant server', async () => {
    const http = createMockHttp();
    const server = { key: 'srv1', tools: [] };
    http.request.mockResolvedValue({ server });
    const resource = new McpResource(http);

    const result = await resource.refreshTools('srv1');

    expect(result).toBe(server);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/mcp/srv1/refresh-tools');
  });
});

describe('McpHubsResource', () => {
  it('lists hubs', async () => {
    const http = createMockHttp();
    const response = { hubs: [] };
    http.request.mockResolvedValue(response);
    const resource = new McpHubsResource(http);

    const result = await resource.list();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/mcp/hubs');
  });

  it('gets hub info + first catalog page without a query', async () => {
    const http = createMockHttp();
    const response = { hub: { key: 'hub1' }, servers: [] };
    http.request.mockResolvedValue(response);
    const resource = new McpHubsResource(http);

    const result = await resource.get('hub1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/mcp/hubs/hub1', {
      query: undefined,
    });
  });

  it('gets hub info with a search/cursor/limit query', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ hub: { key: 'hub1' }, servers: [] });
    const resource = new McpHubsResource(http);

    await resource.get('hub1', { search: 'weather', cursor: 'abc', limit: 10 });

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/mcp/hubs/hub1', {
      query: { search: 'weather', cursor: 'abc', limit: '10' },
    });
  });

  it('lists/searches a hub catalog', async () => {
    const http = createMockHttp();
    const response = { servers: [] };
    http.request.mockResolvedValue(response);
    const resource = new McpHubsResource(http);

    const result = await resource.servers('hub1', { search: 'weather' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/mcp/hubs/hub1/servers', {
      query: { search: 'weather' },
    });
  });

  it('gets one member server detail', async () => {
    const http = createMockHttp();
    const server = { name: 'weather-api' };
    http.request.mockResolvedValue({ server });
    const resource = new McpHubsResource(http);

    const result = await resource.server('hub1', 'weather-api');

    expect(result).toBe(server);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/mcp/hubs/hub1/servers/weather-api',
    );
  });
});

describe('McpServerHandle', () => {
  it('listTools uses the REST execute endpoint for the console server', async () => {
    const http = createMockHttp();
    const tools = [{ name: 'search' }];
    http.request.mockResolvedValue({ tools });
    const handle = new McpServerHandle(http, 'console', '/api/client/v1/mcp/console');

    const result = await handle.listTools();

    expect(result).toBe(tools);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/mcp/console/execute');
  });

  it('listTools uses JSON-RPC tools/list for tenant servers', async () => {
    const http = createMockHttp();
    const tools = [{ name: 'search' }];
    http.request.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: { tools } });
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    const result = await handle.listTools();

    expect(result).toBe(tools);
    const [method, path, options] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/api/client/v1/mcp/srv1/message');
    expect(options.body).toMatchObject({ jsonrpc: '2.0', method: 'tools/list' });
    expect(typeof options.body.id).toBe('number');
  });

  it('execute posts to the REST execute endpoint', async () => {
    const http = createMockHttp();
    const response = { content: [], isError: false };
    http.request.mockResolvedValue(response);
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    const result = await handle.execute({ tool: 'search', arguments: { q: 'hi' } } as never);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/mcp/srv1/execute', {
      body: { tool: 'search', arguments: { q: 'hi' } },
    });
  });

  it('initialize sends a JSON-RPC initialize call', async () => {
    const http = createMockHttp();
    const initResult = { protocolVersion: '2024-11-05', capabilities: {} };
    http.request.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: initResult });
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    const result = await handle.initialize();

    expect(result).toBe(initResult);
    const [, , options] = http.request.mock.calls[0];
    expect(options.body.method).toBe('initialize');
    expect(options.body.params).toMatchObject({ protocolVersion: '2024-11-05' });
  });

  it('callTool sends a JSON-RPC tools/call with the given name and arguments', async () => {
    const http = createMockHttp();
    const toolResult = { content: [{ type: 'text', text: 'ok' }], isError: false };
    http.request.mockResolvedValue({ jsonrpc: '2.0', id: 2, result: toolResult });
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    const result = await handle.callTool('search', { q: 'hi' });

    expect(result).toBe(toolResult);
    const [, , options] = http.request.mock.calls[0];
    expect(options.body.method).toBe('tools/call');
    expect(options.body.params).toEqual({ name: 'search', arguments: { q: 'hi' } });
  });

  it('callJsonRpc throws when the server returns a JSON-RPC error', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    });
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    await expect(handle.callJsonRpc('unknown/method')).rejects.toThrow(
      'MCP RPC error -32601: Method not found',
    );
  });

  it('callJsonRpc passes the sessionId as a query parameter when provided', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: {} });
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    await handle.callJsonRpc('ping', undefined, { sessionId: 'sess_1' });

    const [, , options] = http.request.mock.calls[0];
    expect(options.query).toEqual({ sessionId: 'sess_1' });
  });

  it('builds the SSE and message URLs via resolveURL', () => {
    const http = createMockHttp();
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    handle.getSseUrl();
    handle.getMessageUrl('sess_1');

    expect(http.resolveURL).toHaveBeenCalledWith('/api/client/v1/mcp/srv1/sse');
    expect(http.resolveURL).toHaveBeenCalledWith('/api/client/v1/mcp/srv1/message', {
      sessionId: 'sess_1',
    });
  });

  it('bundles connection info for an MCP client', () => {
    const http = createMockHttp();
    http.resolveURL.mockImplementation((path: string) => `https://mock.test${path}`);
    const handle = new McpServerHandle(http, 'srv1', '/api/client/v1/mcp/srv1');

    const info = handle.getConnectionInfo('sk-test');

    expect(info.serverKey).toBe('srv1');
    expect(info.sseUrl).toBe('https://mock.test/api/client/v1/mcp/srv1/sse');
    expect(info.messageUrlTemplate).toBe(
      'https://mock.test/api/client/v1/mcp/srv1/message?sessionId={sessionId}',
    );
    expect(info.authHeader).toContain('sk-test');
  });
});
