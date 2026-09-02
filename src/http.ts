import { CognipeerAPIError, CognipeerError } from './types';

/**
 * HTTP client for making requests to the CG API
 */
export class HttpClient {
  private baseURL: string;
  private apiKey: string;
  private timeout: number;
  private maxRetries: number;
  private fetchImpl: typeof fetch;

  constructor(
    baseURL: string,
    apiKey: string,
    timeout: number,
    maxRetries: number,
    fetchImpl?: typeof fetch
  ) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.fetchImpl = fetchImpl || globalThis.fetch;

    if (!this.fetchImpl) {
      throw new CognipeerError('Fetch is not available. Please provide a fetch implementation.');
    }
  }

  /**
   * Make a request to the API
   */
  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
      /**
       * Non-2xx statuses whose body is a normal result rather than an error.
       *
       * Exists for the guardrail hook route: a guardrail can opt into the
       * extended verdict status codes, and then a BLOCK answers 446 with a full
       * verdict body. Without this the SDK would reject a successful,
       * well-formed evaluation as a transport failure — the caller would learn
       * that something went wrong but not that its content was blocked, which
       * is the one thing it asked.
       */
      acceptStatuses?: number[];
    } = {}
  ): Promise<T> {
    const url = this.buildURL(path, options.query);
    const headers = this.buildHeaders(options.headers);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: options.signal || controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok && !options.acceptStatuses?.includes(response.status)) {
          await this.handleErrorResponse(response);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (
          error instanceof CognipeerAPIError ||
          (error as Error).name === 'AbortError' ||
          attempt === this.maxRetries
        ) {
          throw error;
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw lastError || new CognipeerError('Request failed after retries');
  }

  /**
   * Make a streaming request
   */
  async *stream<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    } = {}
  ): AsyncGenerator<T, void, undefined> {
    const url = this.buildURL(path, options.query);
    const headers = this.buildHeaders(options.headers);

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new CognipeerError('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              yield JSON.parse(data) as T;
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE data:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Resolve a relative API path into an absolute URL using the configured base URL.
   */
  resolveURL(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    return this.buildURL(path, query);
  }

  /**
   * Make a request that returns binary data (Uint8Array). Used by routes
   * that respond with non-JSON bodies (e.g. audio/speech synthesis).
   */
  async requestBinary(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    } = {},
  ): Promise<{ data: Uint8Array; contentType: string; requestId?: string }> {
    const url = this.buildURL(path, options.query);
    const headers = this.buildHeaders(options.headers);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal || controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const buffer = await response.arrayBuffer();
      return {
        data: new Uint8Array(buffer),
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        requestId: response.headers.get('x-request-id') || undefined,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Multipart/form-data request. Used by routes that accept file uploads
   * (e.g. audio/transcriptions, audio/translations, OCR).
   */
  async requestMultipart<T>(
    method: string,
    path: string,
    form: FormData,
    options: {
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const url = this.buildURL(path, options.query);
    const headers = { ...this.buildHeaders(options.headers) };
    // Let the runtime set the multipart boundary
    delete headers['Content-Type'];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: form as unknown as ArrayBuffer,
        signal: options.signal || controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildURL(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.baseURL);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': '@cognipeer/console-sdk/1.1.0',
      ...customHeaders,
    };
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorType: string | undefined;
    let responseData: unknown;

    try {
      responseData = await response.json();
      if (typeof responseData === 'object' && responseData !== null) {
        const errorObj = responseData as { error?: string | { message?: string; type?: string } };
        if (typeof errorObj.error === 'string') {
          errorMessage = errorObj.error;
        } else if (errorObj.error && typeof errorObj.error === 'object') {
          errorMessage = errorObj.error.message || errorMessage;
          errorType = errorObj.error.type;
        }
      }
    } catch {
      // If JSON parsing fails, use default error message
    }

    throw new CognipeerAPIError(errorMessage, response.status, errorType, responseData);
  }

  /**
   * Sleep helper for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
