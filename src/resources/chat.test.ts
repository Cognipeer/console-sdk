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
