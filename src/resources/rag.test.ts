import { describe, it, expect } from 'vitest';
import { RagResource } from './rag';
import { createMockHttp } from '../test/mockHttp';

describe('RagResource', () => {
  it('ingests a text document', async () => {
    const http = createMockHttp();
    const response = { document: { _id: 'doc1' } };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.ingest('my-kb', { fileName: 'manual.txt', content: 'hello' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/rag/modules/my-kb/ingest', {
      body: { fileName: 'manual.txt', content: 'hello' },
    });
  });

  it('ingests a file document, url-encoding the module key', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ document: { _id: 'doc2' } });
    const resource = new RagResource(http);

    await resource.ingestFile('my kb', { fileName: 'report.pdf', data: 'base64==' });

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/rag/modules/my%20kb/ingest',
      { body: { fileName: 'report.pdf', data: 'base64==' } },
    );
  });

  it('queries a module', async () => {
    const http = createMockHttp();
    const response = { results: [] };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.query('my-kb', { query: 'How do I reset my password?', topK: 5 });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/rag/modules/my-kb/query', {
      body: { query: 'How do I reset my password?', topK: 5 },
    });
  });

  it('deletes a document', async () => {
    const http = createMockHttp();
    const response = { deleted: true };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.deleteDocument('my-kb', 'doc1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/rag/modules/my-kb/documents/doc1',
    );
  });

  it('re-ingests a document with no data, sending an empty body', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ document: { _id: 'doc1' } });
    const resource = new RagResource(http);

    await resource.reingestDocument('my-kb', 'doc1');

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/rag/modules/my-kb/documents/doc1',
      { body: {} },
    );
  });

  it('re-ingests a document with new content', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ document: { _id: 'doc1' } });
    const resource = new RagResource(http);

    await resource.reingestDocument('my-kb', 'doc1', { content: 'Updated text' });

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/rag/modules/my-kb/documents/doc1',
      { body: { content: 'Updated text', data: undefined } },
    );
  });

  it('re-ingests a document normalizing legacy `base64` field to `data`', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ document: { _id: 'doc1' } });
    const resource = new RagResource(http);

    await resource.reingestDocument('my-kb', 'doc1', { base64: 'legacy==' } as never);

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/rag/modules/my-kb/documents/doc1',
      { body: { base64: 'legacy==', data: 'legacy==' } },
    );
  });

  it('re-ingests a file, normalizing base64 to data', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ document: { _id: 'doc1' } });
    const resource = new RagResource(http);

    await resource.reingestFile('my-kb', 'doc1', {
      fileName: 'new.pdf',
      data: 'base64==',
      contentType: 'application/pdf',
    });

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/rag/modules/my-kb/documents/doc1',
      {
        body: {
          fileName: 'new.pdf',
          data: 'base64==',
          contentType: 'application/pdf',
          metadata: undefined,
        },
      },
    );
  });

  it('lists documents with query filters', async () => {
    const http = createMockHttp();
    const response = { documents: [] };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.listDocuments('my-kb', { status: 'ready', limit: 10 });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/rag/modules/my-kb/documents',
      { query: { status: 'ready', limit: 10 } },
    );
  });

  it('creates a module', async () => {
    const http = createMockHttp();
    const response = { module: { key: 'my-kb' } };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const data = {
      name: 'My KB',
      embeddingModelKey: 'text-embedding-3-small',
      vectorProviderKey: 'pinecone',
      vectorIndexKey: 'idx',
      chunkConfig: { strategy: 'fixed' as const, chunkSize: 500 },
    };
    const result = await resource.createModule(data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/rag/modules', { body: data });
  });

  it('updates a module', async () => {
    const http = createMockHttp();
    const response = { module: { key: 'my-kb', name: 'Renamed' } };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.updateModule('my-kb', { name: 'Renamed' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/rag/modules/my-kb', {
      body: { name: 'Renamed' },
    });
  });

  it('gets a module', async () => {
    const http = createMockHttp();
    const response = { module: { key: 'my-kb' } };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.getModule('my-kb');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/rag/modules/my-kb');
  });

  it('lists modules', async () => {
    const http = createMockHttp();
    const response = { modules: [] };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.listModules();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/rag/modules');
  });

  it('deletes a module', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new RagResource(http);

    const result = await resource.deleteModule('my-kb');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/rag/modules/my-kb');
  });
});
