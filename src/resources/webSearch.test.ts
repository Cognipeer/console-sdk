import { describe, it, expect, vi } from 'vitest';
import { WebSearchResource, WebSearchProvidersResource } from './webSearch';
import { createMockHttp } from '../test/mockHttp';
import { WebSearchProvider, WebSearchRequest, WebSearchResponse } from '../types';

describe('WebSearchResource', () => {
  const response: WebSearchResponse = {
    id: 'ws_1',
    provider: 'default',
    driver: 'brave-search',
    query: 'best espresso machine',
    results: [
      { title: 'Top picks', url: 'https://example.com', snippet: 'Great machines', position: 1 },
    ],
    latency_ms: 120,
  };

  it('exposes a WebSearchProvidersResource on .providers', () => {
    const http = createMockHttp();

    const resource = new WebSearchResource(http);

    expect(resource.providers).toBeInstanceOf(WebSearchProvidersResource);
  });

  it('runs a search via POST /api/client/v1/websearch/search', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new WebSearchResource(http);
    const params: WebSearchRequest = { query: 'best espresso machine', count: 5 };

    const result = await resource.search(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/websearch/search', {
      body: params,
    });
  });

  it('runs a search on a named instance via POST /api/client/v1/websearch/:key/search with the key encoded', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new WebSearchResource(http);
    const params = { query: 'best espresso machine', count: 5 };

    const result = await resource.searchWith('my provider', params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/websearch/my%20provider/search',
      { body: params },
    );
  });
});

describe('WebSearchProvidersResource', () => {
  it('lists web search providers via GET /api/client/v1/websearch/providers', async () => {
    const http = createMockHttp();
    const provider: WebSearchProvider = {
      key: 'brave',
      driver: 'brave-search',
      label: 'Brave Search',
      status: 'active',
      aiAnswer: true,
    };
    vi.mocked(http.request).mockResolvedValue({ providers: [provider] });
    const resource = new WebSearchProvidersResource(http);

    const result = await resource.list();

    expect(result).toEqual([provider]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/websearch/providers');
  });

  it('falls back to an empty array when the response has no providers field', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({});
    const resource = new WebSearchProvidersResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
  });
});
