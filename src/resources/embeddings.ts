import { HttpClient } from '../http';
import { EmbeddingRequest, EmbeddingResponse } from '../types';

/**
 * Embeddings API resource
 */
export class EmbeddingsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create embeddings for the given input
   * @param params - Embedding parameters
   * @returns Embedding response
   */
  async create(params: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.http.request<EmbeddingResponse>('POST', '/api/client/v1/embeddings', {
      body: params,
    });
  }
}
