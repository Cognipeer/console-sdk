import { describe, it, expect, vi } from 'vitest';
import { BrowserSessionsResource, BrowserMcpResource, BrowsersResource } from './browser';
import { createMockHttp } from '../test/mockHttp';
import { HttpClient } from '../http';
import { CognipeerError } from '../types';

describe('BrowserSessionsResource', () => {
  it('creates a session', async () => {
    const http = createMockHttp();
    const session = { sessionKey: 'sess_1' };
    http.request.mockResolvedValue({ session });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.create({ browserId: 'b1', name: 'demo' });

    expect(result).toBe(session);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/sessions', {
      body: { browserId: 'b1', name: 'demo' },
    });
  });

  it('lists sessions without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BrowserSessionsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions');
  });

  it('lists sessions with status/browserId filters as a query string', async () => {
    const http = createMockHttp();
    const sessions = [{ sessionKey: 'sess_1' }];
    http.request.mockResolvedValue({ sessions });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.list({ status: 'active', browserId: 'b1' });

    expect(result).toBe(sessions);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/sessions?status=active&browserId=b1',
    );
  });

  it('gets a session by id', async () => {
    const http = createMockHttp();
    const session = { sessionKey: 'sess_1' };
    http.request.mockResolvedValue({ session });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.get('sess_1');

    expect(result).toBe(session);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions/sess_1');
  });

  it('lists session events with pagination', async () => {
    const http = createMockHttp();
    const events = [{ type: 'goto' }];
    http.request.mockResolvedValue({ events });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.listEvents('sess_1', { limit: 10, skip: 5 });

    expect(result).toBe(events);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/sessions/sess_1/events?limit=10&skip=5',
    );
  });

  it('sends an action to a session', async () => {
    const http = createMockHttp();
    const actionResult = { ok: true };
    http.request.mockResolvedValue({ result: actionResult });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.action('sess_1', { type: 'goto', url: 'https://example.com' } as never);

    expect(result).toBe(actionResult);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/actions',
      { body: { type: 'goto', url: 'https://example.com' } },
    );
  });

  it('extracts structured data from a session', async () => {
    const http = createMockHttp();
    const extractResult = { data: {} };
    http.request.mockResolvedValue({ result: extractResult });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.extract('sess_1', { schema: {} } as never);

    expect(result).toBe(extractResult);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/extract',
      { body: { schema: {} } },
    );
  });

  it('gets an aria snapshot', async () => {
    const http = createMockHttp();
    const snapshot = { tree: {} };
    http.request.mockResolvedValue(snapshot);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.snapshot('sess_1');

    expect(result).toBe(snapshot);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions/sess_1/snapshot');
  });

  it('persists a screenshot', async () => {
    const http = createMockHttp();
    const artifact = { url: 'https://files.example.com/shot.png' };
    http.request.mockResolvedValue(artifact);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.screenshot('sess_1', { fullPage: true } as never);

    expect(result).toBe(artifact);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/screenshot',
      { body: { fullPage: true } },
    );
  });

  it('creates a PDF artifact', async () => {
    const http = createMockHttp();
    const artifact = { url: 'https://files.example.com/doc.pdf' };
    http.request.mockResolvedValue(artifact);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.pdf('sess_1');

    expect(result).toBe(artifact);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/sessions/sess_1/pdf', {
      body: {},
    });
  });

  it('closes a session', async () => {
    const http = createMockHttp();
    const response = { closed: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.close('sess_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/browser/sessions/sess_1');
  });

  it('deletes a session by id', async () => {
    const http = createMockHttp();
    const response = { deleted: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.delete('sess_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/browser/sessions/by-id/sess_1',
    );
  });

  describe('screenshotLive', () => {
    it('fetches raw screenshot bytes directly, bypassing the JSON request path', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
      const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
      const resource = new BrowserSessionsResource(http);

      const result = await resource.screenshotLive('sess_1', { fullPage: true });

      expect(result).toEqual(bytes);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://api.test/api/client/v1/browser/sessions/sess_1/screenshot/live?fullPage=true',
      );
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer sk-test');
    });

    it('throws when the live screenshot endpoint returns a non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
      const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
      const resource = new BrowserSessionsResource(http);

      await expect(resource.screenshotLive('sess_1')).rejects.toThrow('screenshotLive failed (500)');
    });
  });
});

describe('BrowserMcpResource', () => {
  it('builds SSE and message URLs via resolveURL', () => {
    const http = createMockHttp();
    const resource = new BrowserMcpResource(http);

    resource.getSseUrl('browser1');
    resource.getMessageUrl('browser1', 'sess_1');

    expect(http.resolveURL).toHaveBeenCalledWith('/api/client/v1/browser/browser1/mcp/sse');
    expect(http.resolveURL).toHaveBeenCalledWith(
      '/api/client/v1/browser/browser1/mcp/message',
      { sessionId: 'sess_1' },
    );
  });

  it('bundles connection info', () => {
    const http = createMockHttp();
    http.resolveURL.mockImplementation((path: string) => `https://mock.test${path}`);
    const resource = new BrowserMcpResource(http);

    const info = resource.getConnectionInfo('browser1');

    expect(info.browserKey).toBe('browser1');
    expect(info.sseUrl).toBe('https://mock.test/api/client/v1/browser/browser1/mcp/sse');
    expect(info.messageUrlTemplate).toBe(
      'https://mock.test/api/client/v1/browser/browser1/mcp/message?sessionId=<sessionId>',
    );
  });

  it('initializes the MCP connection via JSON-RPC', async () => {
    const http = createMockHttp();
    const initResult = { protocolVersion: '2024-11-05' };
    http.request.mockResolvedValue({ id: 1, jsonrpc: '2.0', result: initResult });
    const resource = new BrowserMcpResource(http);

    const result = await resource.initialize('browser1');

    expect(result).toBe(initResult);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/browser1/mcp/message',
      { body: { id: 1, jsonrpc: '2.0', method: 'initialize', params: {} } },
    );
  });

  it('throws a CognipeerError when initialize gets a JSON-RPC error', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 1, jsonrpc: '2.0', error: { code: -1, message: 'boom' } });
    const resource = new BrowserMcpResource(http);

    await expect(resource.initialize('browser1')).rejects.toThrow(CognipeerError);
    await expect(resource.initialize('browser1')).rejects.toThrow('boom');
  });

  it('lists MCP tools via JSON-RPC, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 2, jsonrpc: '2.0', result: {} });
    const resource = new BrowserMcpResource(http);

    const result = await resource.listTools('browser1');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/browser1/mcp/message',
      { body: { id: 2, jsonrpc: '2.0', method: 'tools/list' } },
    );
  });
});

describe('BrowsersResource', () => {
  it('creates a browser', async () => {
    const http = createMockHttp();
    const browser = { id: 'b1', name: 'demo-browser' };
    http.request.mockResolvedValue({ browser });
    const resource = new BrowsersResource(http);

    const result = await resource.create({ name: 'demo-browser' });

    expect(result).toBe(browser);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/browsers', {
      body: { name: 'demo-browser' },
    });
  });

  it('lists browsers without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BrowsersResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/browsers');
  });

  it('lists browsers with a status filter', async () => {
    const http = createMockHttp();
    const browsers = [{ id: 'b1' }];
    http.request.mockResolvedValue({ browsers });
    const resource = new BrowsersResource(http);

    const result = await resource.list({ status: 'active' });

    expect(result).toBe(browsers);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/browsers?status=active');
  });

  it('gets a browser by id', async () => {
    const http = createMockHttp();
    const browser = { id: 'b1' };
    http.request.mockResolvedValue({ browser });
    const resource = new BrowsersResource(http);

    const result = await resource.get('b1');

    expect(result).toBe(browser);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/browsers/b1');
  });

  it('updates a browser', async () => {
    const http = createMockHttp();
    const browser = { id: 'b1', name: 'renamed' };
    http.request.mockResolvedValue({ browser });
    const resource = new BrowsersResource(http);

    const result = await resource.update('b1', { name: 'renamed' });

    expect(result).toBe(browser);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/browser/browsers/b1', {
      body: { name: 'renamed' },
    });
  });

  it('deletes a browser', async () => {
    const http = createMockHttp();
    const response = { deleted: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowsersResource(http);

    const result = await resource.delete('b1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/browser/browsers/b1');
  });
});
