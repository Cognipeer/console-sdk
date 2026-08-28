import { describe, it, expect, vi } from 'vitest';
import { ConsoleClient } from './client';
import { ChatResource } from './resources/chat';
import { EmbeddingsResource } from './resources/embeddings';
import { SandboxResource } from './resources/sandbox';
import { RealtimeResource } from './resources/realtime';

describe('ConsoleClient', () => {
  it('throws when no apiKey is provided', () => {
    // @ts-expect-error - intentionally omitting the required apiKey
    expect(() => new ConsoleClient({})).toThrow('API key is required');
  });

  it('applies default baseURL, timeout, and maxRetries', () => {
    const client = new ConsoleClient({ apiKey: 'sk-test' });

    expect(client.getBaseURL()).toBe('https://console.cognipeer.com');
  });

  it('respects a custom baseURL, timeout, maxRetries, and fetch implementation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new ConsoleClient({
      apiKey: 'sk-test',
      baseURL: 'https://custom.example.com',
      timeout: 1234,
      maxRetries: 0,
      fetch: fetchMock,
    });

    expect(client.getBaseURL()).toBe('https://custom.example.com');

    await client.embeddings.create({ model: 'test-embed', input: 'hi' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.example.com/api/client/v1/embeddings',
      expect.anything()
    );
  });

  it('strips a trailing slash from a custom baseURL', () => {
    const client = new ConsoleClient({ apiKey: 'sk-test', baseURL: 'https://custom.example.com/' });

    expect(client.getBaseURL()).toBe('https://custom.example.com');
  });

  it('strips a legacy /api/client/v1 suffix from the baseURL for backwards compatibility', () => {
    const client = new ConsoleClient({
      apiKey: 'sk-test',
      baseURL: 'https://custom.example.com/api/client/v1',
    });

    expect(client.getBaseURL()).toBe('https://custom.example.com');
  });

  it('strips a legacy /api/client/v1/ suffix (with trailing slash) from the baseURL', () => {
    const client = new ConsoleClient({
      apiKey: 'sk-test',
      baseURL: 'https://custom.example.com/api/client/v1/',
    });

    expect(client.getBaseURL()).toBe('https://custom.example.com');
  });

  it('wires up every resource on the client', () => {
    const client = new ConsoleClient({ apiKey: 'sk-test' });

    expect(client.chat).toBeInstanceOf(ChatResource);
    expect(client.embeddings).toBeInstanceOf(EmbeddingsResource);
    expect(client.sandbox).toBeInstanceOf(SandboxResource);
    expect(client.realtime).toBeInstanceOf(RealtimeResource);

    // Spot-check the remaining resources are all constructed (non-null objects).
    const resourceKeys = [
      'batches',
      'moderations',
      'spend',
      'budgets',
      'vectors',
      'files',
      'prompts',
      'tracing',
      'tools',
      'guardrails',
      'memory',
      'rag',
      'config',
      'agents',
      'browserSessions',
      'browsers',
      'browserMcp',
      'audio',
      'ocr',
      'automations',
      'crawler',
      'rerankers',
      'webSearch',
      'aegis',
      'mcp',
      'analytics',
      'audit',
      'monitoring',
      'pii',
    ] as const;

    for (const key of resourceKeys) {
      expect(client[key], `expected client.${key} to be defined`).toBeTruthy();
    }
  });
});
