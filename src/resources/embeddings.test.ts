import { describe, it, expect } from 'vitest';
import { EmbeddingsResource } from './embeddings';
import { createMockHttp } from '../test/mockHttp';

describe('EmbeddingsResource', () => {
  it('creates embeddings via POST /api/client/v1/embeddings', async () => {
    const http = createMockHttp();
    const response = { data: [{ embedding: [0.1, 0.2], index: 0 }] };
    http.request.mockResolvedValue(response);
    const resource = new EmbeddingsResource(http);

    const result = await resource.create({ model: 'text-embed-3', input: 'hello world' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/embeddings', {
      body: { model: 'text-embed-3', input: 'hello world' },
    });
  });
});
