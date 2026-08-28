import { describe, expect, it } from 'vitest';
import { ConsoleClient } from '../src';

describe('ConsoleClient', () => {
  it('requires an API key', () => {
    expect(() => new ConsoleClient({ apiKey: '' })).toThrow('API key is required');
  });

  it('normalizes legacy base URLs and initializes API resources', () => {
    const client = new ConsoleClient({
      apiKey: 'test-key',
      baseURL: 'https://example.test/api/client/v1/',
    });

    expect(client.getBaseURL()).toBe('https://example.test');
    expect(client.chat.completions).toBeDefined();
    expect(client.tracing).toBeDefined();
    expect(client.realtime).toBeDefined();
  });

  it('sends the API key and client API path for chat completions', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const client = new ConsoleClient({
      apiKey: 'test-key',
      baseURL: 'https://example.test',
      fetch: fetchImpl,
    });

    await client.chat.completions.create({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(requestUrl).toBe('https://example.test/api/client/v1/chat/completions');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
  });
});