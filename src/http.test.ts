import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpClient } from './http';
import { CognipeerAPIError, CognipeerError } from './types';

function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

function textStreamResponse(chunks: string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status });
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

describe('HttpClient', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('strips a trailing slash from the base URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const http = new HttpClient('https://api.test/', 'key', 5000, 0, fetchMock);

      await http.request('GET', '/v1/things');

      expect(fetchMock).toHaveBeenCalledWith('https://api.test/v1/things', expect.anything());
    });

    it('falls back to globalThis.fetch when no implementation is provided', async () => {
      const originalFetch = globalThis.fetch;
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = fetchMock;

      try {
        const http = new HttpClient('https://api.test', 'key', 5000, 0);
        const result = await http.request('GET', '/ping');
        expect(result).toEqual({ ok: true });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws a CognipeerError when fetch is unavailable', () => {
      const originalFetch = globalThis.fetch;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = undefined;

      try {
        expect(() => new HttpClient('https://api.test', 'key', 5000, 0)).toThrow(CognipeerError);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('request()', () => {
    it('sends the expected method, headers, and JSON body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: '1' }));
      const http = new HttpClient('https://api.test', 'sk-test-key', 5000, 0, fetchMock);

      const result = await http.request('POST', '/v1/things', { body: { name: 'x' } });

      expect(result).toEqual({ id: '1' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.test/v1/things');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'x' }));
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test-key',
      });
      expect(init.headers['User-Agent']).toContain('@cognipeer/console-sdk');
    });

    it('merges custom headers over the defaults', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await http.request('GET', '/v1/things', { headers: { 'X-Custom': '1', 'Content-Type': 'text/plain' } });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers['X-Custom']).toBe('1');
      expect(init.headers['Content-Type']).toBe('text/plain');
    });

    it('builds query strings and omits undefined values', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await http.request('GET', '/v1/things', {
        query: { limit: 10, active: true, cursor: undefined },
      });

      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url as string);
      expect(parsed.searchParams.get('limit')).toBe('10');
      expect(parsed.searchParams.get('active')).toBe('true');
      expect(parsed.searchParams.has('cursor')).toBe(false);
    });

    it('handles a path without a leading slash', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await http.request('GET', 'v1/things');

      expect(fetchMock).toHaveBeenCalledWith('https://api.test/v1/things', expect.anything());
    });

    it('does not send a body for requests without one', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await http.request('GET', '/v1/things');

      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toBeUndefined();
    });

    it('throws CognipeerAPIError with the message/type from a JSON object error body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { message: 'Invalid request', type: 'invalid_request_error' } },
          { status: 400, statusText: 'Bad Request' }
        )
      );
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await expect(http.request('GET', '/v1/things')).rejects.toMatchObject({
        message: 'Invalid request',
        statusCode: 400,
        errorType: 'invalid_request_error',
      });
    });

    it('throws CognipeerAPIError with a string error body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ error: 'nope' }, { status: 403 })
      );
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await expect(http.request('GET', '/v1/things')).rejects.toMatchObject({
        message: 'nope',
        statusCode: 403,
      });
    });

    it('falls back to a generic message when the error body is not JSON', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response('not json', { status: 500, statusText: 'Internal Server Error' })
      );
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await expect(http.request('GET', '/v1/things')).rejects.toMatchObject({
        message: 'HTTP 500: Internal Server Error',
        statusCode: 500,
      });
    });

    it('does not retry when the response is a CognipeerAPIError', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad' }, { status: 400 }));
      const http = new HttpClient('https://api.test', 'key', 5000, 3, fetchMock);

      await expect(http.request('GET', '/v1/things')).rejects.toBeInstanceOf(CognipeerAPIError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry on an AbortError', async () => {
      const fetchMock = vi.fn().mockRejectedValue(abortError());
      const http = new HttpClient('https://api.test', 'key', 5000, 3, fetchMock);

      await expect(http.request('GET', '/v1/things')).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries transient failures with exponential backoff and eventually succeeds', async () => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const http = new HttpClient('https://api.test', 'key', 5000, 1, fetchMock);

      const promise = http.request('GET', '/v1/things');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws the last error once retries are exhausted', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockRejectedValue(new Error('down for good'));
      const http = new HttpClient('https://api.test', 'key', 5000, 2, fetchMock);

      const promise = http.request('GET', '/v1/things');
      // Let assertion run after all timers/microtasks settle.
      const expectation = expect(promise).rejects.toThrow('down for good');
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await expectation;

      expect(fetchMock).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    });

    it('aborts the request once the timeout elapses', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(abortError()));
          })
      );
      const http = new HttpClient('https://api.test', 'key', 1000, 0, fetchMock);

      const promise = http.request('GET', '/v1/slow');
      const expectation = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(1000);
      await expectation;
    });
  });

  describe('stream()', () => {
    it('yields parsed SSE data chunks and stops at [DONE]', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        textStreamResponse(['data: {"n":1}\n\n', 'data: {"n":2}\n\n', 'data: [DONE]\n\n'])
      );
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      const received: unknown[] = [];
      for await (const chunk of http.stream('POST', '/v1/stream', { body: { x: 1 } })) {
        received.push(chunk);
      }

      expect(received).toEqual([{ n: 1 }, { n: 2 }]);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
    });

    it('skips lines that are not valid JSON without throwing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        textStreamResponse(['data: not-json\n\n', 'data: {"n":1}\n\n', 'data: [DONE]\n\n'])
      );
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      const received: unknown[] = [];
      for await (const chunk of http.stream('POST', '/v1/stream')) {
        received.push(chunk);
      }

      expect(received).toEqual([{ n: 1 }]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('throws on a non-ok response before streaming', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, { status: 401 }));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      const iterator = http.stream('POST', '/v1/stream');
      await expect(iterator.next()).rejects.toBeInstanceOf(CognipeerAPIError);
    });

    it('throws a CognipeerError when the response has no body', async () => {
      const noBodyResponse = new Response(null, { status: 200 });
      const fetchMock = vi.fn().mockResolvedValue(noBodyResponse);
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      const iterator = http.stream('POST', '/v1/stream');
      await expect(iterator.next()).rejects.toBeInstanceOf(CognipeerError);
    });
  });

  describe('requestBinary()', () => {
    it('returns the raw bytes, content type, and request id', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const response = new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'x-request-id': 'req_123' },
      });
      const fetchMock = vi.fn().mockResolvedValue(response);
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      const result = await http.requestBinary('POST', '/v1/audio/speech', { body: { text: 'hi' } });

      expect(new Uint8Array(result.data)).toEqual(bytes);
      expect(result.contentType).toBe('audio/mpeg');
      expect(result.requestId).toBe('req_123');
    });

    it('defaults the content type when the header is missing', async () => {
      const response = new Response(new Uint8Array([9]), { status: 200 });
      const fetchMock = vi.fn().mockResolvedValue(response);
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      const result = await http.requestBinary('GET', '/v1/download');

      expect(result.contentType).toBe('application/octet-stream');
      expect(result.requestId).toBeUndefined();
    });

    it('throws on a non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, { status: 404 }));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await expect(http.requestBinary('GET', '/v1/download')).rejects.toBeInstanceOf(CognipeerAPIError);
    });
  });

  describe('requestMultipart()', () => {
    it('sends the FormData body and lets the runtime set the content-type boundary', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);
      const form = new FormData();
      form.append('file', new Blob(['hello']), 'hello.txt');

      const result = await http.requestMultipart('POST', '/v1/audio/transcriptions', form);

      expect(result).toEqual({ ok: true });
      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toBe(form);
      expect(init.headers['Content-Type']).toBeUndefined();
      expect(init.headers.Authorization).toBe('Bearer key');
    });

    it('throws on a non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad file' }, { status: 422 }));
      const http = new HttpClient('https://api.test', 'key', 5000, 0, fetchMock);

      await expect(http.requestMultipart('POST', '/v1/audio/transcriptions', new FormData())).rejects.toBeInstanceOf(
        CognipeerAPIError
      );
    });
  });

  describe('resolveURL()', () => {
    it('builds an absolute URL with query parameters', () => {
      const http = new HttpClient('https://api.test', 'key', 5000, 0, vi.fn());

      const url = http.resolveURL('/v1/things', { limit: 5 });

      expect(url).toBe('https://api.test/v1/things?limit=5');
    });
  });
});
