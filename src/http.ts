import { CognipeerAPIError, CognipeerError } from './types';

/** Status codes safe to retry regardless of HTTP method: the request was
 * rejected before any side effect (rate limit, gateway/upstream failure),
 * not "the server processed it and then died" (which 500 could mean). */
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

/**
 * `Retry-After` can be either a number of seconds or an HTTP-date
 * (RFC 7231 7.1.3). Returns milliseconds from now, or undefined if the
 * header is absent or unparseable.
 */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

/**
 * Combines up to two optional AbortSignals into one that aborts when EITHER
 * source does, carrying through whichever reason fired. `AbortSignal.any`
 * would do this natively but needs Node 20.3+; this package supports
 * Node >=18, so it is composed by hand instead. Call `cleanup` once the
 * operation the signal guards is done, successfully or not, so the listeners
 * attached to a long-lived caller-supplied signal don't accumulate.
 */
function combineSignals(
  a: AbortSignal | undefined,
  b: AbortSignal | undefined,
): { signal: AbortSignal; cleanup: () => void } {
  if (!a) return { signal: b as AbortSignal, cleanup: () => {} };
  if (!b) return { signal: a, cleanup: () => {} };

  const controller = new AbortController();
  const onAbort = (source: AbortSignal) => () => controller.abort((source as { reason?: unknown }).reason);
  const onAbortA = onAbort(a);
  const onAbortB = onAbort(b);

  if (a.aborted) controller.abort((a as { reason?: unknown }).reason);
  else if (b.aborted) controller.abort((b as { reason?: unknown }).reason);
  else {
    a.addEventListener('abort', onAbortA, { once: true });
    b.addEventListener('abort', onAbortB, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      a.removeEventListener('abort', onAbortA);
      b.removeEventListener('abort', onAbortB);
    },
  };
}

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
    } = {}
  ): Promise<T> {
    const url = this.buildURL(path, options.query);
    const headers = this.buildHeaders(options.headers);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      // Composed, not `options.signal || controller.signal`: the caller's
      // own signal used to REPLACE the timeout entirely, so passing one
      // silently disabled the client's timeout instead of adding to it.
      const { signal, cleanup } = combineSignals(options.signal, controller.signal);

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal,
        });

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        // Timeout deliberately stays armed through this await, not just
        // through the fetch() above: a slow-streaming body could otherwise
        // hang past the configured timeout once headers had already arrived.
        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error as Error;

        const isRetryableStatus =
          error instanceof CognipeerAPIError && RETRYABLE_STATUS_CODES.has(error.statusCode ?? 0);

        // Don't retry on certain errors
        if (
          (error instanceof CognipeerAPIError && !isRetryableStatus) ||
          (error as Error).name === 'AbortError' ||
          attempt === this.maxRetries
        ) {
          throw error;
        }

        const retryAfterMs = error instanceof CognipeerAPIError ? error.retryAfterMs : undefined;
        await this.sleep(retryAfterMs ?? Math.pow(2, attempt) * 1000);
      } finally {
        clearTimeout(timeoutId);
        cleanup();
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

    // The client's default timeout previously applied to nothing in this
    // method at all -- only a caller-supplied signal did anything. Applied
    // here as an IDLE timeout (re-armed on every chunk, including the
    // initial connect/headers phase before the first one), not a total
    // stream-duration cap: a long-lived but actively-producing stream should
    // not be killed just for running a while, only one that stalls.
    const idleController = new AbortController();
    const { signal, cleanup } = combineSignals(options.signal, idleController.signal);
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => idleController.abort(), this.timeout);
    };
    const disarmIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    armIdleTimer();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new CognipeerError('Response body is null');
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        armIdleTimer();
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
            } catch {
              // Never log the raw payload: it is upstream content, not
              // diagnostic metadata, and may carry a caller's own data.
              console.warn(`Failed to parse SSE data (${data.length} chars) — skipping malformed chunk`);
            }
          }
        }
      }
    } finally {
      disarmIdleTimer();
      cleanup();
      if (reader) {
        // Early exit (the caller broke out of a `for await` loop) used to
        // leave the underlying connection open -- releaseLock() alone frees
        // this reader to be re-acquired, it does not tell the stream (or the
        // server) that nobody is reading anymore.
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
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
    const { signal, cleanup } = combineSignals(options.signal, controller.signal);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal,
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
      cleanup();
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
    const { signal, cleanup } = combineSignals(options.signal, controller.signal);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: form as unknown as ArrayBuffer,
        signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return data as T;
    } finally {
      clearTimeout(timeoutId);
      cleanup();
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

    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    throw new CognipeerAPIError(errorMessage, response.status, errorType, responseData, retryAfterMs);
  }

  /**
   * Sleep helper for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
