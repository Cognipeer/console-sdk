import { HttpClient } from '../http';
import type { ListPromptsQuery, Prompt, PromptRenderResponse } from '../types';

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
   */
  async get(key: string): Promise<{ prompt: Prompt }> {
    return this.http.request('GET', `/api/client/v1/prompts/${key}`);
  }

  /**
   * Render a prompt with data
   * @param key - Prompt key
   * @param data - Template data
   */
  async render(
    key: string,
    data?: Record<string, unknown>
  ): Promise<PromptRenderResponse> {
    return this.http.request('POST', `/api/client/v1/prompts/${key}/render`, {
      body: { data },
    });
  }
}
