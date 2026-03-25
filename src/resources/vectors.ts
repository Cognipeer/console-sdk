import { HttpClient } from '../http';
import {
  VectorProvider,
  CreateVectorProviderRequest,
  VectorIndex,
  CreateVectorIndexRequest,
  UpdateVectorIndexRequest,
  UpsertVectorsRequest,
  QueryVectorsRequest,
  QueryVectorsResponse,
} from '../types';

/**
 * Vector API resource
 */
export class VectorsResource {
  private http: HttpClient;
  public providers: VectorProvidersResource;
  public indexes: VectorIndexesResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.providers = new VectorProvidersResource(http);
    this.indexes = new VectorIndexesResource(http);
  }

  /**
   * Upsert vectors into an index (convenience method)
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param data - Vectors to upsert
   */
  async upsert(
    providerKey: string,
    indexId: string,
    data: UpsertVectorsRequest
  ): Promise<{ success: boolean }> {
    return this.http.request('POST', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}/upsert`, {
      body: data,
    });
  }

  /**
   * Query vectors from an index (convenience method)
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param query - Query parameters
   */
  async query(
    providerKey: string,
    indexId: string,
    query: QueryVectorsRequest
  ): Promise<QueryVectorsResponse> {
    return this.http.request('POST', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}/query`, {
      body: query,
    });
  }

  /**
   * Delete vectors from an index (convenience method)
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param ids - Vector IDs to delete
   */
  async delete(
    providerKey: string,
    indexId: string,
    ids: string[]
  ): Promise<{ success: boolean }> {
    return this.http.request('DELETE', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}/vectors`, {
      body: { ids },
    });
  }
}

/**
 * Vector providers resource
 */
export class VectorProvidersResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List vector providers
   * @param query - Optional filters
   */
  async list(query?: {
    status?: 'active' | 'inactive' | 'error';
    driver?: string;
  }): Promise<{ providers: VectorProvider[] }> {
    return this.http.request('GET', '/api/client/v1/vector/providers', { query });
  }

  /**
   * Create a new vector provider
   * @param data - Provider configuration
   */
  async create(data: CreateVectorProviderRequest): Promise<{ provider: VectorProvider }> {
    return this.http.request('POST', '/api/client/v1/vector/providers', { body: data });
  }
}

/**
 * Vector indexes resource
 */
export class VectorIndexesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List indexes for a provider
   * @param providerKey - Provider identifier
   */
  async list(providerKey: string): Promise<{ indexes: VectorIndex[] }> {
    return this.http.request('GET', `/api/client/v1/vector/providers/${providerKey}/indexes`);
  }

  /**
   * Create a new index
   * @param providerKey - Provider identifier
   * @param data - Index configuration
   */
  async create(
    providerKey: string,
    data: CreateVectorIndexRequest
  ): Promise<{ index: VectorIndex; reused?: boolean }> {
    return this.http.request('POST', `/api/client/v1/vector/providers/${providerKey}/indexes`, {
      body: data,
    });
  }

  /**
   * Get index details
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   */
  async get(
    providerKey: string,
    indexId: string
  ): Promise<{ index: VectorIndex; provider: VectorProvider }> {
    return this.http.request('GET', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}`);
  }

  /**
   * Update an index
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param data - Update data
   */
  async update(
    providerKey: string,
    indexId: string,
    data: UpdateVectorIndexRequest
  ): Promise<{ index: VectorIndex }> {
    return this.http.request('PATCH', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}`, {
      body: data,
    });
  }

  /**
   * Delete an index
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   */
  async delete(providerKey: string, indexId: string): Promise<{ success: boolean }> {
    return this.http.request('DELETE', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}`);
  }

  /**
   * Upsert vectors into an index
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param data - Vectors to upsert
   */
  async upsert(
    providerKey: string,
    indexId: string,
    data: UpsertVectorsRequest
  ): Promise<{ success: boolean }> {
    return this.http.request('POST', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}/upsert`, {
      body: data,
    });
  }

  /**
   * Query vectors from an index
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param query - Query parameters
   */
  async query(
    providerKey: string,
    indexId: string,
    query: QueryVectorsRequest
  ): Promise<QueryVectorsResponse> {
    return this.http.request('POST', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}/query`, {
      body: query,
    });
  }

  /**
   * Delete vectors from an index
   * @param providerKey - Provider identifier
   * @param indexId - Index identifier
   * @param ids - Vector IDs to delete
   */
  async deleteVectors(
    providerKey: string,
    indexId: string,
    ids: string[]
  ): Promise<{ success: boolean }> {
    return this.http.request('DELETE', `/api/client/v1/vector/providers/${providerKey}/indexes/${indexId}/vectors`, {
      body: { ids },
    });
  }
}
