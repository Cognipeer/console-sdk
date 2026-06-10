import { HttpClient } from '../http';
import {
  Batch,
  BatchItem,
  BatchOutputLine,
  CreateBatchRequest,
  ListBatchItemsQuery,
  ListBatchesQuery,
} from '../types';

/**
 * Batch API resource — OpenAI-compatible asynchronous bulk inference.
 *
 * Submit a set of chat-completion or embedding requests together (inline or
 * as a JSONL file in a Document Store bucket); the console executes them in
 * the background and exposes per-line results.
 *
 * @example
 * ```typescript
 * const batch = await client.batches.create({
 *   endpoint: '/v1/chat/completions',
 *   requests: [
 *     { custom_id: 'q1', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }] } },
 *     { custom_id: 'q2', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello' }] } },
 *   ],
 * });
 *
 * // Poll until done
 * let status = await client.batches.retrieve(batch.id);
 * while (status.status === 'in_progress') {
 *   await new Promise((r) => setTimeout(r, 2000));
 *   status = await client.batches.retrieve(batch.id);
 * }
 *
 * // Read the results (parsed JSONL lines)
 * const lines = await client.batches.results(batch.id);
 * ```
 */
export class BatchesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Create and start a batch. */
  async create(data: CreateBatchRequest): Promise<Batch> {
    return this.http.request<Batch>('POST', '/api/client/v1/batches', { body: data });
  }

  /** List batches visible to the current token. */
  async list(query?: ListBatchesQuery): Promise<Batch[]> {
    const res = await this.http.request<{ data: Batch[] }>(
      'GET',
      '/api/client/v1/batches',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.data ?? [];
  }

  /** Fetch a batch (status + request counts + usage). */
  async retrieve(batchId: string): Promise<Batch> {
    return this.http.request<Batch>(
      'GET',
      `/api/client/v1/batches/${encodeURIComponent(batchId)}`,
    );
  }

  /**
   * Request cancellation. Pending lines are skipped; lines already running
   * finish normally. The batch settles to `cancelled` once the queue drains.
   */
  async cancel(batchId: string): Promise<Batch> {
    return this.http.request<Batch>(
      'POST',
      `/api/client/v1/batches/${encodeURIComponent(batchId)}/cancel`,
    );
  }

  /** List the individual request lines and their per-line status. */
  async items(batchId: string, query?: ListBatchItemsQuery): Promise<BatchItem[]> {
    const res = await this.http.request<{ data: BatchItem[] }>(
      'GET',
      `/api/client/v1/batches/${encodeURIComponent(batchId)}/items`,
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.data ?? [];
  }

  /**
   * Fetch finished lines as parsed OpenAI-format output objects.
   * Use {@link resultsRaw} for the raw JSONL document.
   */
  async results(batchId: string): Promise<BatchOutputLine[]> {
    const raw = await this.resultsRaw(batchId);
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as BatchOutputLine);
  }

  /** Fetch the raw output JSONL document (OpenAI batch output format). */
  async resultsRaw(batchId: string): Promise<string> {
    const res = await this.http.requestBinary(
      'GET',
      `/api/client/v1/batches/${encodeURIComponent(batchId)}/results`,
    );
    return new TextDecoder().decode(res.data);
  }
}
