import { HttpClient } from '../http';
import {
  Reranker,
  RerankerCreateRequest,
  RerankerRunRequest,
  RerankerRunResponse,
  RerankerUpdateRequest,
} from '../types';

/**
 * Reranker API resource — Cohere-compatible reranking surface.
 *
 * @example
 * ```typescript
 * const rerankers = await client.rerankers.list();
 *
 * const result = await client.rerankers.run('default-reranker', {
 *   query: 'best espresso machine for beginners',
 *   documents: ['Doc A', 'Doc B', 'Doc C'],
 *   top_n: 2,
 * });
 *
 * for (const r of result.results) {
 *   console.log(r.relevance_score, r.document.text);
 * }
 * ```
 */
export class RerankerResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List available rerankers. */
  async list(): Promise<Reranker[]> {
    const res = await this.http.request<{ rerankers: Reranker[] }>(
      'GET',
      '/api/client/v1/rerankers',
    );
    return res.rerankers ?? [];
  }

  /** Get a reranker by key. */
  async get(key: string): Promise<Reranker> {
    const res = await this.http.request<{ reranker: Reranker }>(
      'GET',
      `/api/client/v1/rerank/${encodeURIComponent(key)}`,
    );
    return res.reranker;
  }

  /** Run a reranker against a list of documents. */
  async run(key: string, params: RerankerRunRequest): Promise<RerankerRunResponse> {
    return this.http.request<RerankerRunResponse>(
      'POST',
      `/api/client/v1/rerank/${encodeURIComponent(key)}`,
      { body: params },
    );
  }

  /**
   * Create a reranker definition.
   * @param params Reranker creation parameters (name, strategy, config required)
   */
  async create(params: RerankerCreateRequest): Promise<Reranker> {
    const res = await this.http.request<{ reranker: Reranker }>(
      'POST',
      '/api/client/v1/rerank',
      { body: params },
    );
    return res.reranker;
  }

  /**
   * Update a reranker definition.
   * @param key Reranker key
   * @param params Fields to update
   */
  async update(key: string, params: RerankerUpdateRequest): Promise<Reranker> {
    const res = await this.http.request<{ reranker: Reranker }>(
      'PATCH',
      `/api/client/v1/rerank/${encodeURIComponent(key)}`,
      { body: params },
    );
    return res.reranker;
  }

  /** Delete a reranker definition. */
  async delete(key: string): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(
      'DELETE',
      `/api/client/v1/rerank/${encodeURIComponent(key)}`,
    );
  }
}
