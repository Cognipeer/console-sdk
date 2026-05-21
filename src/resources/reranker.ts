import { HttpClient } from '../http';
import { Reranker, RerankerRunRequest, RerankerRunResponse } from '../types';

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
}
