import { HttpClient } from '../http';
import {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResponse,
} from '../types';

/**
 * Web Search API resource.
 *
 * Runs web searches through the providers configured in the Console
 * (Bing, Brave Search, Serper, Tavily, SearxNG, DuckDuckGo). When no
 * provider is specified, the project's default web search provider is used.
 */
export class WebSearchResource {
  private http: HttpClient;
  public providers: WebSearchProvidersResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.providers = new WebSearchProvidersResource(http);
  }

  /**
   * Run a web search.
   * @param params - Query plus optional provider key and search options
   */
  async search(params: WebSearchRequest): Promise<WebSearchResponse> {
    return this.http.request<WebSearchResponse>('POST', '/api/client/v1/websearch/search', {
      body: params,
    });
  }

  /**
   * Run a web search on a named instance (`POST /websearch/:key/search`).
   * Equivalent to `search({ ...params, provider: key })`.
   */
  async searchWith(
    key: string,
    params: Omit<WebSearchRequest, 'provider'>,
  ): Promise<WebSearchResponse> {
    return this.http.request<WebSearchResponse>(
      'POST',
      `/api/client/v1/websearch/${encodeURIComponent(key)}/search`,
      { body: params },
    );
  }
}

/**
 * Web search instance listing (read-only; instances are managed in the
 * Console dashboard under Data → Web Search).
 */
export class WebSearchProvidersResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List web search instances visible to the token's project. */
  async list(): Promise<WebSearchProvider[]> {
    const res = await this.http.request<{ providers: WebSearchProvider[] }>(
      'GET',
      '/api/client/v1/websearch/providers',
    );
    return res.providers ?? [];
  }
}
