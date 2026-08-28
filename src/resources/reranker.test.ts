import { describe, it, expect, vi } from 'vitest';
import { RerankerResource } from './reranker';
import { createMockHttp } from '../test/mockHttp';
import {
  Reranker,
  RerankerCreateRequest,
  RerankerRunRequest,
  RerankerRunResponse,
  RerankerUpdateRequest,
} from '../types';

describe('RerankerResource', () => {
  const reranker: Reranker = {
    key: 'default-reranker',
    name: 'Default Reranker',
    strategy: 'dedicated-model',
    status: 'active',
  };

  it('lists rerankers via GET /api/client/v1/rerankers', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ rerankers: [reranker] });
    const resource = new RerankerResource(http);

    const result = await resource.list();

    expect(result).toEqual([reranker]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/rerankers');
  });

  it('falls back to an empty array when the response has no rerankers field', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({});
    const resource = new RerankerResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
  });

  it('gets a reranker via GET /api/client/v1/rerank/:key with the key encoded', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ reranker });
    const resource = new RerankerResource(http);

    const result = await resource.get('default reranker');

    expect(result).toBe(reranker);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/rerank/default%20reranker',
    );
  });

  it('runs a reranker via POST /api/client/v1/rerank/:key with the key encoded', async () => {
    const http = createMockHttp();
    const response: RerankerRunResponse = {
      id: 'rr_1',
      results: [
        { index: 0, relevance_score: 0.98, document: { text: 'Doc A' } },
        { index: 1, relevance_score: 0.5, document: { text: 'Doc B' } },
      ],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new RerankerResource(http);
    const params: RerankerRunRequest = {
      query: 'best espresso machine for beginners',
      documents: ['Doc A', 'Doc B'],
      top_n: 2,
    };

    const result = await resource.run('default-reranker', params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/rerank/default-reranker',
      { body: params },
    );
  });

  it('creates a reranker via POST /api/client/v1/rerank and unwraps the reranker field', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ reranker });
    const resource = new RerankerResource(http);
    const params: RerankerCreateRequest = {
      name: 'Default Reranker',
      strategy: 'dedicated-model',
      config: { modelKey: 'rerank-model', topN: 5 },
    };

    const result = await resource.create(params);

    expect(result).toBe(reranker);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/rerank', {
      body: params,
    });
  });

  it('updates a reranker via PATCH /api/client/v1/rerank/:key with the key encoded', async () => {
    const http = createMockHttp();
    const updated: Reranker = { ...reranker, status: 'disabled' };
    vi.mocked(http.request).mockResolvedValue({ reranker: updated });
    const resource = new RerankerResource(http);
    const params: RerankerUpdateRequest = { status: 'disabled' };

    const result = await resource.update('default reranker', params);

    expect(result).toBe(updated);
    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      '/api/client/v1/rerank/default%20reranker',
      { body: params },
    );
  });

  it('deletes a reranker via DELETE /api/client/v1/rerank/:key with the key encoded', async () => {
    const http = createMockHttp();
    const response = { success: true };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new RerankerResource(http);

    const result = await resource.delete('default/reranker');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/rerank/default%2Freranker',
    );
  });
});
