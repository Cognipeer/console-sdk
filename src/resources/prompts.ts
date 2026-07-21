import { HttpClient } from '../http';
import type {
  DeployPromptOptions,
  ListPromptsQuery,
  PromptCompareResponse,
  PromptCreateRequest,
  PromptDeploymentsResponse,
  Prompt,
  PromptRenderResponse,
  PromptUpdateRequest,
  GetPromptOptions,
  RenderPromptOptions,
  PromptVersionsResponse,
  SetPromptVersionRequest,
} from '../types';

/**
 * Prompts API resource
 */
export class PromptsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List prompts
   * @param query - Optional search filters
   */
  async list(query?: ListPromptsQuery): Promise<{ prompts: Prompt[] }> {
    return this.http.request('GET', '/api/client/v1/prompts', {
      query: query as Record<string, string | number | boolean | undefined>,
    });
  }

  /**
   * Create a prompt. The initial template becomes version 1.
   * @param params - Prompt creation parameters (name + template required)
   */
  async create(params: PromptCreateRequest): Promise<{ prompt: Prompt }> {
    return this.http.request('POST', '/api/client/v1/prompts', {
      body: params,
    });
  }

  /**
   * Update a prompt. Editing the template implicitly creates a new version.
   * @param key - Prompt key
   * @param params - Fields to update
   */
  async update(key: string, params: PromptUpdateRequest): Promise<{ prompt: Prompt }> {
    return this.http.request('PATCH', `/api/client/v1/prompts/${key}`, {
      body: params,
    });
  }

  /**
   * Re-point the prompt's "latest" pointer to an existing version.
   * @param key - Prompt key
   * @param params - The target version id
   */
  async setLatestVersion(
    key: string,
    params: SetPromptVersionRequest,
  ): Promise<{ prompt: Prompt }> {
    return this.http.request('POST', `/api/client/v1/prompts/${key}/versions`, {
      body: params,
    });
  }

  /**
   * Delete a prompt and all its versions.
   * @param key - Prompt key
   */
  async delete(key: string): Promise<{ success: boolean }> {
    return this.http.request('DELETE', `/api/client/v1/prompts/${key}`);
  }

  /**
   * Get a prompt by key
   * @param key - Prompt key
   * @param options - Optional parameters including version number
   */
  async get(key: string, options?: GetPromptOptions): Promise<{ prompt: Prompt }> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (options?.version !== undefined) {
      query.version = options.version;
    }
    if (options?.environment !== undefined) {
      query.environment = options.environment;
    }
    return this.http.request('GET', `/api/client/v1/prompts/${key}`, { query });
  }

  /**
   * Render a prompt with data
   * @param key - Prompt key
   * @param options - Render options including data and optional version
   */
  async render(
    key: string,
    options?: RenderPromptOptions
  ): Promise<PromptRenderResponse> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (options?.version !== undefined) {
      query.version = options.version;
    }
    if (options?.environment !== undefined) {
      query.environment = options.environment;
    }
    return this.http.request('POST', `/api/client/v1/prompts/${key}/render`, {
      query,
      body: { data: options?.data },
    });
  }

  /**
   * List all versions of a prompt
   * @param key - Prompt key
   */
  async listVersions(key: string): Promise<PromptVersionsResponse> {
    return this.http.request('GET', `/api/client/v1/prompts/${key}/versions`);
  }

  /**
   * Get deployment state and history for a prompt
   * @param key - Prompt key
   */
  async getDeployments(key: string): Promise<PromptDeploymentsResponse> {
    return this.http.request('GET', `/api/client/v1/prompts/${key}/deployments`);
  }

  /**
   * Mutate deployment flow for a prompt (promote/plan/activate/rollback)
   * @param key - Prompt key
   * @param options - Deployment flow action
   */
  async deploy(key: string, options: DeployPromptOptions): Promise<PromptDeploymentsResponse> {
    return this.http.request('POST', `/api/client/v1/prompts/${key}/deployments`, {
      body: options,
    });
  }

  /**
   * Compare two prompt versions
   * @param key - Prompt key
   * @param fromVersionId - Base version id
   * @param toVersionId - Target version id
   */
  async compare(
    key: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<PromptCompareResponse> {
    return this.http.request('GET', `/api/client/v1/prompts/${key}/compare`, {
      query: {
        fromVersionId,
        toVersionId,
      },
    });
  }
}
