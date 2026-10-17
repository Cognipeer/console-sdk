import { HttpClient } from '../http';
import { ListModelsQuery, ModelList } from '../types';

/**
 * Models API: what the project can call. The list holds the project's models AND its
 * active agents (`id: 'agent:<key>'`, `cognipeer.kind === 'agent'`; only for tokens that
 * may read agents); either id works as `model` in `chat.completions` and `agents.responses`.
 *
 * @example
 * ```typescript
 * const { data } = await client.models.list();
 * const agents = data.filter(isAgentModelEntry);
 * ```
 */
export class ModelsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List the project's models and agents. */
  async list(query: ListModelsQuery = {}, options: { signal?: AbortSignal } = {}): Promise<ModelList> {
    return this.http.request<ModelList>('GET', '/api/client/v1/models', {
      query: {
        category: query.category,
        providerKey: query.providerKey,
        providerDriver: query.providerDriver,
        includeProviders: query.includeProviders ? 'true' : undefined,
      },
      signal: options.signal,
    });
  }
}
