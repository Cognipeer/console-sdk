import { HttpClient } from '../http';
import type { 
  ListPromptsQuery, 
  Prompt, 
  PromptRenderResponse,
  GetPromptOptions,
  RenderPromptOptions,
  PromptVersionsResponse,
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
   * Get a prompt by key
   * @param key - Prompt key
   * @param options - Optional parameters including version number
   */
  async get(key: string, options?: GetPromptOptions): Promise<{ prompt: Prompt }> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (options?.version !== undefined) {
      query.version = options.version;
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
}
