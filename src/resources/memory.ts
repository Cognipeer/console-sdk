import { HttpClient } from '../http';
import {
  MemoryStore,
  CreateMemoryStoreRequest,
  UpdateMemoryStoreRequest,
  MemoryItem,
  AddMemoryRequest,
  UpdateMemoryRequest,
  MemorySearchRequest,
  MemorySearchResponse,
  MemoryRecallRequest,
  MemoryRecallResponse,
  MemoryBatchResult,
} from '../types';

/**
 * Memory API resource
 *
 * Provides access to persistent memory stores with vector-backed semantic search.
 *
 * @example
 * ```typescript
 * // Create a memory store
 * const store = await client.memory.stores.create({
 *   name: 'Customer KB',
 *   vectorProviderKey: 'my-pinecone',
 *   embeddingModelKey: 'text-embedding-3-small',
 * });
 *
 * // Add a memory
 * const item = await client.memory.add(store.key, {
 *   content: 'The user prefers dark mode.',
 *   scope: 'user',
 *   scopeId: 'user-123',
 * });
 *
 * // Semantic search
 * const results = await client.memory.search(store.key, {
 *   query: 'What theme does the user prefer?',
 * });
 *
 * // Chat-context recall
 * const recall = await client.memory.recall(store.key, {
 *   query: 'user preferences',
 *   maxTokens: 1000,
 * });
 * ```
 */
export class MemoryResource {
  private http: HttpClient;
  public stores: MemoryStoresResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.stores = new MemoryStoresResource(http);
  }

  /**
   * Add a single memory to a store
   * @param storeKey - Memory store key
   * @param data - Memory content and metadata
   */
  async add(storeKey: string, data: AddMemoryRequest): Promise<MemoryItem> {
    return this.http.request('POST', `/api/client/v1/memory/stores/${storeKey}/memories`, {
      body: data,
    });
  }

  /**
   * Add memories in batch
   * @param storeKey - Memory store key
   * @param memories - Array of memories to add (max 100)
   */
  async addBatch(storeKey: string, memories: AddMemoryRequest[]): Promise<MemoryBatchResult> {
    return this.http.request('POST', `/api/client/v1/memory/stores/${storeKey}/memories/batch`, {
      body: { memories },
    });
  }

  /**
   * Get a specific memory item
   * @param storeKey - Memory store key
   * @param memoryId - Memory item ID
   */
  async get(storeKey: string, memoryId: string): Promise<MemoryItem> {
    return this.http.request('GET', `/api/client/v1/memory/stores/${storeKey}/memories/${memoryId}`);
  }

  /**
   * Update a memory item
   * @param storeKey - Memory store key
   * @param memoryId - Memory item ID
   * @param data - Fields to update
   */
  async update(storeKey: string, memoryId: string, data: UpdateMemoryRequest): Promise<MemoryItem> {
    return this.http.request('PATCH', `/api/client/v1/memory/stores/${storeKey}/memories/${memoryId}`, {
      body: data,
    });
  }

  /**
   * Delete a memory item
   * @param storeKey - Memory store key
   * @param memoryId - Memory item ID
   */
  async delete(storeKey: string, memoryId: string): Promise<{ success: boolean }> {
    return this.http.request('DELETE', `/api/client/v1/memory/stores/${storeKey}/memories/${memoryId}`);
  }

  /**
   * List memory items in a store
   * @param storeKey - Memory store key
   * @param options - Pagination and filtering options
   */
  async list(
    storeKey: string,
    options?: {
      scope?: string;
      scopeId?: string;
      tags?: string[];
      status?: string;
      search?: string;
      limit?: number;
      skip?: number;
    },
  ): Promise<{ items: MemoryItem[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.scope) params.set('scope', options.scope);
    if (options?.scopeId) params.set('scopeId', options.scopeId);
    if (options?.tags) params.set('tags', options.tags.join(','));
    if (options?.status) params.set('status', options.status);
    if (options?.search) params.set('search', options.search);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.skip) params.set('skip', String(options.skip));
    const qs = params.toString();
    return this.http.request('GET', `/api/client/v1/memory/stores/${storeKey}/memories${qs ? `?${qs}` : ''}`);
  }

  /**
   * Bulk delete memory items
   * @param storeKey - Memory store key
   * @param filter - Optional filter for deletion scope
   */
  async deleteBulk(
    storeKey: string,
    filter?: {
      scope?: string;
      scopeId?: string;
      tags?: string[];
      before?: string;
    },
  ): Promise<{ deleted: number }> {
    return this.http.request('DELETE', `/api/client/v1/memory/stores/${storeKey}/memories`, {
      body: filter || {},
    });
  }

  /**
   * Semantic search across memories
   * @param storeKey - Memory store key
   * @param request - Search parameters
   */
  async search(storeKey: string, request: MemorySearchRequest): Promise<MemorySearchResponse> {
    return this.http.request('POST', `/api/client/v1/memory/stores/${storeKey}/search`, {
      body: request,
    });
  }

  /**
   * Context-aware recall for chat
   * @param storeKey - Memory store key
   * @param request - Recall parameters
   */
  async recall(storeKey: string, request: MemoryRecallRequest): Promise<MemoryRecallResponse> {
    return this.http.request('POST', `/api/client/v1/memory/stores/${storeKey}/recall`, {
      body: request,
    });
  }
}

/**
 * Memory stores sub-resource
 */
export class MemoryStoresResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List memory stores
   * @param options - Optional filters
   */
  async list(options?: {
    status?: string;
    search?: string;
  }): Promise<{ stores: MemoryStore[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.search) params.set('search', options.search);
    const qs = params.toString();
    return this.http.request('GET', `/api/client/v1/memory/stores${qs ? `?${qs}` : ''}`);
  }

  /**
   * Create a memory store
   * @param data - Store configuration
   */
  async create(data: CreateMemoryStoreRequest): Promise<MemoryStore> {
    return this.http.request('POST', '/api/client/v1/memory/stores', {
      body: data,
    });
  }

  /**
   * Get a memory store by key
   * @param storeKey - Store key
   */
  async get(storeKey: string): Promise<MemoryStore> {
    return this.http.request('GET', `/api/client/v1/memory/stores/${storeKey}`);
  }

  /**
   * Update a memory store
   * @param storeKey - Store key
   * @param data - Fields to update
   */
  async update(storeKey: string, data: UpdateMemoryStoreRequest): Promise<MemoryStore> {
    return this.http.request('PATCH', `/api/client/v1/memory/stores/${storeKey}`, {
      body: data,
    });
  }

  /**
   * Delete a memory store and all its data
   * @param storeKey - Store key
   */
  async delete(storeKey: string): Promise<{ success: boolean }> {
    return this.http.request('DELETE', `/api/client/v1/memory/stores/${storeKey}`);
  }
}
