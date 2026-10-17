import { describe, it, expect, vi } from 'vitest';
import { ChatResource, ChatCompletionsResource } from './chat';
import { createMockHttp } from '../test/mockHttp';
import { ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse } from '../types';

describe('ChatResource', () => {
  it('wraps a ChatCompletionsResource on .completions', () => {
    const http = createMockHttp();

    const resource = new ChatResource(http);

    expect(resource.completions).toBeInstanceOf(ChatCompletionsResource);
  });
});

describe('ChatCompletionsResource', () => {
  const baseParams: Omit<ChatCompletionRequest, 'stream'> = {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'hello' }],
  };

  it('creates a non-streaming completion via http.request when stream is omitted', async () => {
    const http = createMockHttp();
    const response: ChatCompletionResponse = {
      id: 'chatcmpl_1',
      object: 'chat.completion',
      created: 1735689600,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'hi there' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new ChatCompletionsResource(http);

    const result = await resource.create(baseParams);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/chat/completions', {
      body: baseParams,
    });
    expect(http.stream).not.toHaveBeenCalled();
  });

  it('creates a non-streaming completion via http.request when stream is explicitly false', async () => {
    const http = createMockHttp();
    const params: ChatCompletionRequest & { stream: false } = { ...baseParams, stream: false };
    const response: ChatCompletionResponse = {
      id: 'chatcmpl_1b',
      object: 'chat.completion',
      created: 1735689600,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'hi again' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new ChatCompletionsResource(http);

    const result = await resource.create(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/chat/completions', {
      body: params,
    });
    expect(http.stream).not.toHaveBeenCalled();
  });

  it('creates a streaming completion via http.stream when stream is true', async () => {
    const http = createMockHttp();
    const streamParams: ChatCompletionRequest & { stream: true } = {
      ...baseParams,
      stream: true,
    };
    const chunk: ChatCompletionChunk = {
      id: 'chatcmpl_2',
      object: 'chat.completion.chunk',
      created: 1735689600,
      model: 'gpt-4',
      choices: [{ index: 0, delta: { content: 'hi' } }],
    };
    const fakeGenerator = vi.fn(async function* (): AsyncGenerator<
      ChatCompletionChunk,
      void,
      undefined
    > {
      yield chunk;
    });
    vi.mocked(http.stream).mockReturnValue(fakeGenerator());
    const resource = new ChatCompletionsResource(http);

    const result = await resource.create(streamParams);

    expect(http.stream).toHaveBeenCalledWith('POST', '/api/client/v1/chat/completions', {
      body: streamParams,
    });
    expect(http.request).not.toHaveBeenCalled();

    const received: ChatCompletionChunk[] = [];
    for await (const c of result) {
      received.push(c);
    }
    expect(received).toEqual([chunk]);
  });
});

describe('ChatCompletionsResource (v4 request fields)', () => {
  it('passes response_format, stream_options, service_tier, metadata and inputs through untouched', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ id: 'c', object: 'chat.completion', created: 1, model: 'agent:bot', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
    const params: ChatCompletionRequest = {
      model: 'agent:bot',
      messages: [{ role: 'user', content: 'x' }],
      response_format: { type: 'json_schema', json_schema: { name: 'r', schema: { type: 'object' }, strict: true } },
      stream_options: { include_usage: true },
      service_tier: 'flex',
      metadata: { ticket: 'OPS-12' },
      inputs: { team: 'ops' },
      reasoning_effort: 'max',
    };

    await new ChatCompletionsResource(http).create(params);

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/chat/completions', { body: params });
  });

  it('sends sessionId / idempotencyKey as headers and forwards the signal', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({});
    const controller = new AbortController();

    await new ChatCompletionsResource(http).create(
      { model: 'agent:bot', messages: [{ role: 'user', content: 'x' }] },
      { sessionId: 'conv_1', idempotencyKey: 'k1', signal: controller.signal },
    );

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/chat/completions', {
      body: { model: 'agent:bot', messages: [{ role: 'user', content: 'x' }] },
      headers: { 'X-Cognipeer-Session-Id': 'conv_1', 'Idempotency-Key': 'k1' },
      signal: controller.signal,
    });
  });

  it('returns the 202 body of a call past the wait window (choices empty, run to follow)', async () => {
    const http = createMockHttp();
    const accepted: ChatCompletionResponse = {
      id: 'chatcmpl_1',
      object: 'chat.completion',
      created: 1,
      model: 'agent:bot',
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      cognipeer: { status: 'in_progress', run_id: 'run_abc', session_id: 'conv_1' },
    };
    vi.mocked(http.request).mockResolvedValue(accepted);

    const res = await new ChatCompletionsResource(http).create({ model: 'agent:bot', messages: [{ role: 'user', content: 'x' }] });

    expect(res.choices).toEqual([]);
    expect(res.cognipeer?.run_id).toBe('run_abc');
  });

  it('streams the include_usage chunk as typed', async () => {
    const http = createMockHttp();
    const usageChunk: ChatCompletionChunk = {
      id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    vi.mocked(http.stream).mockReturnValue((async function* () { yield usageChunk; })());

    const stream = await new ChatCompletionsResource(http).create({
      model: 'm', messages: [{ role: 'user', content: 'x' }], stream: true, stream_options: { include_usage: true },
    });
    const seen: ChatCompletionChunk[] = [];
    for await (const c of stream) seen.push(c);

    expect(seen[0].usage?.total_tokens).toBe(3);
  });
});

