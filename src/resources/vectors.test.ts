import { describe, it, expect } from 'vitest';
import { VectorsResource, VectorProvidersResource, VectorIndexesResource } from './vectors';
import { createMockHttp } from '../test/mockHttp';
import type {
  CreateVectorIndexRequest,
  CreateVectorProviderRequest,
  QueryVectorsRequest,
  QueryVectorsResponse,
  UpdateVectorIndexRequest,
  UpsertVectorsRequest,
  VectorIndex,
  VectorProvider,
} from '../types';

describe('VectorsResource', () => {
  it('upserts vectors via POST .../providers/{providerKey}/indexes/{indexId}/upsert', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new VectorsResource(http);

    const data: UpsertVectorsRequest = { vectors: [{ id: 'v1', values: [0.1, 0.2] }] };
    const result = await resource.upsert('pinecone-main', 'index_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1/upsert',
      { body: data },
    );
  });

  it('queries vectors via POST .../providers/{providerKey}/indexes/{indexId}/query', async () => {
    const http = createMockHttp();
    const response: QueryVectorsResponse = { result: { matches: [{ id: 'v1', score: 0.9 }] } };
    http.request.mockResolvedValue(response);
    const resource = new VectorsResource(http);

    const query: QueryVectorsRequest = { query: { vector: [0.1, 0.2], topK: 5 } };
    const result = await resource.query('pinecone-main', 'index_1', query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1/query',
      { body: query },
    );
  });

  it('deletes vectors via DELETE .../providers/{providerKey}/indexes/{indexId}/vectors', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new VectorsResource(http);

    const result = await resource.delete('pinecone-main', 'index_1', ['v1', 'v2']);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1/vectors',
      { body: { ids: ['v1', 'v2'] } },
    );
  });
});

describe('VectorProvidersResource', () => {
  it('lists vector providers with query filters via GET /api/client/v1/vector/providers', async () => {
    const http = createMockHttp();
    const providers: VectorProvider[] = [
      {
        _id: 'p1',
        key: 'pinecone-main',
        driver: 'pinecone',
        label: 'Pinecone Main',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    const response = { providers };
    http.request.mockResolvedValue(response);
    const resource = new VectorProvidersResource(http);

    const query = { status: 'active' as const };
    const result = await resource.list(query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/vector/providers', { query });
  });

  it('passes the query through as-is (including undefined) when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ providers: [] });
    const resource = new VectorProvidersResource(http);

    await resource.list();

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/vector/providers', {
      query: undefined,
    });
  });

  it('creates a vector provider via POST /api/client/v1/vector/providers', async () => {
    const http = createMockHttp();
    const provider: VectorProvider = {
      _id: 'p1',
      key: 'pinecone-main',
      driver: 'pinecone',
      label: 'Pinecone Main',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const response = { provider };
    http.request.mockResolvedValue(response);
    const resource = new VectorProvidersResource(http);

    const data: CreateVectorProviderRequest = {
      key: 'pinecone-main',
      driver: 'pinecone',
      label: 'Pinecone Main',
      credentials: { apiKey: 'secret' },
    };
    const result = await resource.create(data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/vector/providers', {
      body: data,
    });
  });
});

describe('VectorIndexesResource', () => {
  it('lists indexes for a provider via GET .../providers/{providerKey}/indexes', async () => {
    const http = createMockHttp();
    const response = { indexes: [] as VectorIndex[] };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const result = await resource.list('pinecone-main');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/vector/providers/pinecone-main/indexes',
    );
  });

  it('creates an index via POST .../providers/{providerKey}/indexes', async () => {
    const http = createMockHttp();
    const index: VectorIndex = {
      _id: 'idx1',
      key: 'docs',
      indexId: 'index_1',
      name: 'Docs index',
      dimension: 1536,
      metric: 'cosine',
      providerKey: 'pinecone-main',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const response = { index };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const data: CreateVectorIndexRequest = { name: 'Docs index', dimension: 1536, metric: 'cosine' };
    const result = await resource.create('pinecone-main', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/vector/providers/pinecone-main/indexes',
      { body: data },
    );
  });

  it('gets index details via GET .../providers/{providerKey}/indexes/{indexId}', async () => {
    const http = createMockHttp();
    const response = {
      index: {} as VectorIndex,
      provider: {} as VectorProvider,
    };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const result = await resource.get('pinecone-main', 'index_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1',
    );
  });

  it('updates an index via PATCH .../providers/{providerKey}/indexes/{indexId}', async () => {
    const http = createMockHttp();
    const response = { index: {} as VectorIndex };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const data: UpdateVectorIndexRequest = { name: 'Docs index v2' };
    const result = await resource.update('pinecone-main', 'index_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1',
      { body: data },
    );
  });

  it('deletes an index via DELETE .../providers/{providerKey}/indexes/{indexId}', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const result = await resource.delete('pinecone-main', 'index_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1',
    );
  });

  it('upserts vectors into an index via POST .../indexes/{indexId}/upsert', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const data: UpsertVectorsRequest = { vectors: [{ id: 'v1', values: [0.1, 0.2] }] };
    const result = await resource.upsert('pinecone-main', 'index_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1/upsert',
      { body: data },
    );
  });

  it('queries vectors from an index via POST .../indexes/{indexId}/query', async () => {
    const http = createMockHttp();
    const response: QueryVectorsResponse = { result: { matches: [] } };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const query: QueryVectorsRequest = { query: { vector: [0.1, 0.2] } };
    const result = await resource.query('pinecone-main', 'index_1', query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1/query',
      { body: query },
    );
  });

  it('deletes vectors from an index via DELETE .../indexes/{indexId}/vectors', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new VectorIndexesResource(http);

    const result = await resource.deleteVectors('pinecone-main', 'index_1', ['v1', 'v2']);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/vector/providers/pinecone-main/indexes/index_1/vectors',
      { body: { ids: ['v1', 'v2'] } },
    );
  });
});
