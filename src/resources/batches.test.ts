import { describe, it, expect } from 'vitest';
import { BatchesResource } from './batches';
import { createMockHttp } from '../test/mockHttp';
import type { Batch, BatchItem, BatchOutputLine, CreateBatchRequest } from '../types';

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'batch_1',
    object: 'batch',
    endpoint: '/v1/chat/completions',
    status: 'in_progress',
    completion_window: '24h',
    input_file: null,
    output_file: null,
    error_message: null,
    request_counts: { total: 2, completed: 0, failed: 0, cancelled: 0 },
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    metadata: {},
    created_at: 1700000000,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

describe('BatchesResource', () => {
  it('creates a batch via POST /api/client/v1/batches', async () => {
    const http = createMockHttp();
    const response = makeBatch();
    http.request.mockResolvedValue(response);
    const resource = new BatchesResource(http);

    const data: CreateBatchRequest = {
      endpoint: '/v1/chat/completions',
      requests: [
        { custom_id: 'q1', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }] } },
      ],
    };
    const result = await resource.create(data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/batches', { body: data });
  });

  it('lists batches with query filters via GET /api/client/v1/batches', async () => {
    const http = createMockHttp();
    const batches: Batch[] = [makeBatch()];
    http.request.mockResolvedValue({ data: batches });
    const resource = new BatchesResource(http);

    const query = { status: 'in_progress' as const, limit: 10 };
    const result = await resource.list(query);

    expect(result).toBe(batches);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/batches', { query });
  });

  it('passes an undefined query through to list when omitted, and defaults to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BatchesResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/batches', { query: undefined });
  });

  it('retrieves a batch via GET /api/client/v1/batches/{batchId}', async () => {
    const http = createMockHttp();
    const response = makeBatch();
    http.request.mockResolvedValue(response);
    const resource = new BatchesResource(http);

    const result = await resource.retrieve('batch_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/batches/batch_1');
  });

  it('encodes the batch id when retrieving', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(makeBatch());
    const resource = new BatchesResource(http);

    await resource.retrieve('batch/with space');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/batches/${encodeURIComponent('batch/with space')}`,
    );
  });

  it('cancels a batch via POST /api/client/v1/batches/{batchId}/cancel', async () => {
    const http = createMockHttp();
    const response = makeBatch({ status: 'cancelling' });
    http.request.mockResolvedValue(response);
    const resource = new BatchesResource(http);

    const result = await resource.cancel('batch_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/batches/batch_1/cancel');
  });

  it('lists batch items with query filters via GET /api/client/v1/batches/{batchId}/items', async () => {
    const http = createMockHttp();
    const items: BatchItem[] = [
      {
        id: 'item_1',
        object: 'batch.item',
        index: 0,
        custom_id: 'q1',
        status: 'succeeded',
        response_status_code: 200,
        response_body: { ok: true },
        error_message: null,
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        started_at: 1700000000,
        ended_at: 1700000001,
      },
    ];
    http.request.mockResolvedValue({ data: items });
    const resource = new BatchesResource(http);

    const query = { status: 'succeeded' as const, limit: 5 };
    const result = await resource.items('batch_1', query);

    expect(result).toBe(items);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/batches/batch_1/items',
      { query },
    );
  });

  it('passes an undefined query through to items when omitted, and defaults to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BatchesResource(http);

    const result = await resource.items('batch_1');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/batches/batch_1/items',
      { query: undefined },
    );
  });

  it('fetches the raw output JSONL document via GET /api/client/v1/batches/{batchId}/results using requestBinary', async () => {
    const http = createMockHttp();
    const raw = '{"id":"batch_req_1"}\n{"id":"batch_req_2"}\n';
    http.requestBinary.mockResolvedValue({
      data: new TextEncoder().encode(raw),
      contentType: 'application/jsonl',
      requestId: 'req_1',
    });
    const resource = new BatchesResource(http);

    const result = await resource.resultsRaw('batch_1');

    expect(result).toBe(raw);
    expect(http.requestBinary).toHaveBeenCalledWith('GET', '/api/client/v1/batches/batch_1/results');
  });

  it('encodes the batch id when fetching raw results', async () => {
    const http = createMockHttp();
    http.requestBinary.mockResolvedValue({
      data: new TextEncoder().encode(''),
      contentType: 'application/jsonl',
      requestId: 'req_1',
    });
    const resource = new BatchesResource(http);

    await resource.resultsRaw('batch/with space');

    expect(http.requestBinary).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/batches/${encodeURIComponent('batch/with space')}/results`,
    );
  });

  it('parses finished lines as JSON objects via results()', async () => {
    const http = createMockHttp();
    const line1: BatchOutputLine = {
      id: 'batch_req_1',
      custom_id: 'q1',
      response: { status_code: 200, body: { ok: true } },
      error: null,
    };
    const line2: BatchOutputLine = {
      id: 'batch_req_2',
      custom_id: 'q2',
      response: { status_code: 200, body: { ok: true } },
      error: null,
    };
    const raw = `${JSON.stringify(line1)}\n${JSON.stringify(line2)}\n`;
    http.requestBinary.mockResolvedValue({
      data: new TextEncoder().encode(raw),
      contentType: 'application/jsonl',
      requestId: 'req_1',
    });
    const resource = new BatchesResource(http);

    const result = await resource.results('batch_1');

    expect(result).toEqual([line1, line2]);
    expect(http.requestBinary).toHaveBeenCalledWith('GET', '/api/client/v1/batches/batch_1/results');
  });

  it('ignores blank lines when parsing results()', async () => {
    const http = createMockHttp();
    const line1: BatchOutputLine = {
      id: 'batch_req_1',
      custom_id: 'q1',
      response: { status_code: 200, body: null },
      error: null,
    };
    const raw = `${JSON.stringify(line1)}\n\n`;
    http.requestBinary.mockResolvedValue({
      data: new TextEncoder().encode(raw),
      contentType: 'application/jsonl',
      requestId: 'req_1',
    });
    const resource = new BatchesResource(http);

    const result = await resource.results('batch_1');

    expect(result).toEqual([line1]);
  });
});
