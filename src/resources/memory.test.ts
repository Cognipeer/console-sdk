import { describe, it, expect } from 'vitest';
import { MemoryResource, MemoryStoresResource } from './memory';
import { createMockHttp } from '../test/mockHttp';

describe('MemoryResource', () => {
  it('exposes a nested MemoryStoresResource', () => {
    const http = createMockHttp();
    const resource = new MemoryResource(http);

    expect(resource.stores).toBeInstanceOf(MemoryStoresResource);
  });

  it('adds a memory and unwraps the memory field', async () => {
    const http = createMockHttp();
    const memory = { id: 'm1', content: 'The user prefers dark mode.' };
    http.request.mockResolvedValue({ memory });
    const resource = new MemoryResource(http);

    const result = await resource.add('store1', { content: 'The user prefers dark mode.' });

    expect(result).toBe(memory);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/memory/stores/store1/memories',
      { body: { content: 'The user prefers dark mode.' } },
    );
  });

  it('adds memories in batch', async () => {
    const http = createMockHttp();
    const response = { added: 2, failed: 0 };
    http.request.mockResolvedValue(response);
    const resource = new MemoryResource(http);
    const memories = [{ content: 'a' }, { content: 'b' }];

    const result = await resource.addBatch('store1', memories);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/memory/stores/store1/memories/batch',
      { body: { memories } },
    );
  });

  it('gets a memory item', async () => {
    const http = createMockHttp();
    const memory = { id: 'm1' };
    http.request.mockResolvedValue(memory);
    const resource = new MemoryResource(http);

    const result = await resource.get('store1', 'm1');

    expect(result).toBe(memory);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/memory/stores/store1/memories/m1',
    );
  });

  it('updates a memory item', async () => {
    const http = createMockHttp();
    const memory = { id: 'm1', content: 'updated' };
    http.request.mockResolvedValue(memory);
    const resource = new MemoryResource(http);

    const result = await resource.update('store1', 'm1', { content: 'updated' });

    expect(result).toBe(memory);
    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      '/api/client/v1/memory/stores/store1/memories/m1',
      { body: { content: 'updated' } },
    );
  });

  it('deletes a memory item', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new MemoryResource(http);

    const result = await resource.delete('store1', 'm1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/memory/stores/store1/memories/m1',
    );
  });

  it('lists memory items without options', async () => {
    const http = createMockHttp();
    const response = { items: [], total: 0 };
    http.request.mockResolvedValue(response);
    const resource = new MemoryResource(http);

    const result = await resource.list('store1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/memory/stores/store1/memories',
    );
  });

  it('lists memory items with filters serialized as a query string', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ items: [], total: 0 });
    const resource = new MemoryResource(http);

    await resource.list('store1', { scope: 'user', scopeId: 'u1', tags: ['a', 'b'], limit: 20 });

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/memory/stores/store1/memories?scope=user&scopeId=u1&tags=a%2Cb&limit=20',
    );
  });

  it('bulk deletes memory items using the query option', async () => {
    const http = createMockHttp();
    const response = { deleted: 3 };
    http.request.mockResolvedValue(response);
    const resource = new MemoryResource(http);

    const result = await resource.deleteBulk('store1', { scope: 'user', scopeId: 'u1', tags: ['a'] });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/memory/stores/store1/memories',
      { query: { scope: 'user', scopeId: 'u1', tags: 'a' } },
    );
  });

  it('searches memories', async () => {
    const http = createMockHttp();
    const response = { matches: [] };
    http.request.mockResolvedValue(response);
    const resource = new MemoryResource(http);

    const result = await resource.search('store1', { query: 'theme preference' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/memory/stores/store1/search',
      { body: { query: 'theme preference' } },
    );
  });

  it('recalls context for chat', async () => {
    const http = createMockHttp();
    const response = { context: 'summary' };
    http.request.mockResolvedValue(response);
    const resource = new MemoryResource(http);

    const result = await resource.recall('store1', { query: 'user preferences', maxTokens: 1000 });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/memory/stores/store1/recall',
      { body: { query: 'user preferences', maxTokens: 1000 } },
    );
  });
});

describe('MemoryStoresResource', () => {
  it('lists stores without filters', async () => {
    const http = createMockHttp();
    const response = { stores: [] };
    http.request.mockResolvedValue(response);
    const resource = new MemoryStoresResource(http);

    const result = await resource.list();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/memory/stores');
  });

  it('lists stores with filters as a query string', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ stores: [] });
    const resource = new MemoryStoresResource(http);

    await resource.list({ status: 'active', search: 'kb' });

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/memory/stores?status=active&search=kb',
    );
  });

  it('creates a store and unwraps the store field', async () => {
    const http = createMockHttp();
    const store = { key: 'store1', name: 'Customer KB' };
    http.request.mockResolvedValue({ store });
    const resource = new MemoryStoresResource(http);

    const result = await resource.create({
      name: 'Customer KB',
      vectorProviderKey: 'my-pinecone',
      embeddingModelKey: 'text-embedding-3-small',
    });

    expect(result).toBe(store);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/memory/stores', {
      body: {
        name: 'Customer KB',
        vectorProviderKey: 'my-pinecone',
        embeddingModelKey: 'text-embedding-3-small',
      },
    });
  });

  it('gets a store by key', async () => {
    const http = createMockHttp();
    const store = { key: 'store1' };
    http.request.mockResolvedValue({ store });
    const resource = new MemoryStoresResource(http);

    const result = await resource.get('store1');

    expect(result).toBe(store);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/memory/stores/store1');
  });

  it('updates a store', async () => {
    const http = createMockHttp();
    const store = { key: 'store1', name: 'Renamed' };
    http.request.mockResolvedValue({ store });
    const resource = new MemoryStoresResource(http);

    const result = await resource.update('store1', { name: 'Renamed' });

    expect(result).toBe(store);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/memory/stores/store1', {
      body: { name: 'Renamed' },
    });
  });

  it('deletes a store', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new MemoryStoresResource(http);

    const result = await resource.delete('store1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/memory/stores/store1');
  });
});
