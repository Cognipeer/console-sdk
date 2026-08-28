import { describe, it, expect, vi } from 'vitest';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { ConsoleClient } from '../client';
import {
  CognipeerLangChainChatModel,
  CognipeerTracingCallbackHandler,
  createCognipeerAgentTracing,
  createCognipeerTracingMiddleware,
} from './langchain';
import type { ChatCompletionChunk, ChatCompletionResponse } from '../types';

function testClient(): ConsoleClient {
  return new ConsoleClient({ apiKey: 'sk-test', fetch: vi.fn() });
}

async function* fakeChunkStream(chunks: ChatCompletionChunk[]): AsyncGenerator<ChatCompletionChunk> {
  for (const chunk of chunks) yield chunk;
}

describe('CognipeerLangChainChatModel', () => {
  it('reuses an existing ConsoleClient instance instead of constructing a new one', () => {
    const client = testClient();
    const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });

    // @ts-expect-error - reaching into a private field for the test
    expect(model.client).toBe(client);
  });

  it('builds a new ConsoleClient when given plain options', () => {
    const model = new CognipeerLangChainChatModel({
      client: { apiKey: 'sk-test' },
      model: 'gpt-4o',
    });

    // @ts-expect-error - reaching into a private field for the test
    expect(model.client).toBeInstanceOf(ConsoleClient);
  });

  it('_llmType returns "cognipeer-chat"', () => {
    const model = new CognipeerLangChainChatModel({ client: testClient(), model: 'gpt-4o' });
    expect(model._llmType()).toBe('cognipeer-chat');
  });

  describe('_generate', () => {
    it('maps message roles, sends a non-streaming request, and maps the response back', async () => {
      const client = testClient();
      const create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Hello there!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o',
        request_id: 'req_1',
      } satisfies ChatCompletionResponse);
      client.chat.completions.create = create;
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });

      const result = await model._generate([
        new SystemMessage('Be helpful'),
        new HumanMessage('Hi'),
      ]);

      expect(create).toHaveBeenCalledTimes(1);
      const [payload] = create.mock.calls[0];
      expect(payload.stream).toBe(false);
      expect(payload.model).toBe('gpt-4o');
      expect(payload.messages).toEqual([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hi' },
      ]);

      expect(result.generations).toHaveLength(1);
      const generation = result.generations[0];
      expect(generation.text).toBe('Hello there!');
      expect(generation.message.content).toBe('Hello there!');
      expect(generation.generationInfo).toMatchObject({
        finish_reason: 'stop',
        request_id: 'req_1',
        model: 'gpt-4o',
      });
      expect(result.llmOutput?.model).toBe('gpt-4o');
      expect(result.llmOutput?.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        cachedTokens: undefined,
      });
    });

    it('maps AI messages with tool_calls and tool messages with tool_call_id', async () => {
      const client = testClient();
      const create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      });
      client.chat.completions.create = create;
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });

      const aiMessage = new AIMessage({
        content: '',
        additional_kwargs: {
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } }],
        },
      });
      const toolMessage = new ToolMessage({ content: 'result', tool_call_id: 'call_1' });

      await model._generate([aiMessage, toolMessage]);

      const [payload] = create.mock.calls[0];
      expect(payload.messages[0]).toMatchObject({
        role: 'assistant',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } }],
      });
      expect(payload.messages[1]).toMatchObject({ role: 'tool', tool_call_id: 'call_1', content: 'result' });
    });

    it('surfaces reasoning_content and reasoning in additional_kwargs when present', async () => {
      const client = testClient();
      client.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [
          {
            message: { content: 'answer', reasoning_content: 'thinking...', reasoning: { steps: 1 } },
            finish_reason: 'stop',
          },
        ],
      });
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });

      const result = await model._generate([new HumanMessage('Hi')]);

      expect(result.generations[0].message.additional_kwargs).toMatchObject({
        reasoning_content: 'thinking...',
        reasoning: { steps: 1 },
      });
    });

    it('renders array-based message content by concatenating text parts', async () => {
      const client = testClient();
      const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
      client.chat.completions.create = create;
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });

      const message = new HumanMessage({
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ] as never,
      });
      await model._generate([message]);

      const [payload] = create.mock.calls[0];
      expect(payload.messages[0].content).toBe('Hello world');
    });

    it('applies constructor defaults, but lets per-call options override them', async () => {
      const client = testClient();
      const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
      client.chat.completions.create = create;
      const model = new CognipeerLangChainChatModel({
        client,
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 100,
      });

      await model._generate([new HumanMessage('Hi')]);
      expect(create.mock.calls[0][0]).toMatchObject({ temperature: 0.2, max_tokens: 100 });

      await model._generate([new HumanMessage('Hi')], { temperature: 0.9 });
      expect(create.mock.calls[1][0]).toMatchObject({ temperature: 0.9, max_tokens: 100 });
    });

    it('calls handleLLMNewToken on the run manager when content is present', async () => {
      const client = testClient();
      client.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'final answer' } }],
      });
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });
      const handleLLMNewToken = vi.fn();

      await model._generate([new HumanMessage('Hi')], undefined, {
        handleLLMNewToken,
      } as never);

      expect(handleLLMNewToken).toHaveBeenCalledWith('final answer');
    });
  });

  describe('_streamResponseChunks', () => {
    it('requests a stream and yields ChatGenerationChunk for each chunk', async () => {
      const client = testClient();
      const create = vi.fn().mockResolvedValue(
        fakeChunkStream([
          {
            id: 'chunk_1',
            choices: [{ delta: { content: 'Hel' }, finish_reason: null }],
          } as unknown as ChatCompletionChunk,
          {
            id: 'chunk_2',
            choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }],
          } as unknown as ChatCompletionChunk,
        ]),
      );
      client.chat.completions.create = create;
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });

      const collected: string[] = [];
      for await (const chunk of model._streamResponseChunks([new HumanMessage('Hi')])) {
        collected.push(chunk.text);
      }

      expect(collected).toEqual(['Hel', 'lo']);
      expect(create.mock.calls[0][0]).toMatchObject({ stream: true });
    });

    it('invokes handleLLMNewToken per non-empty chunk', async () => {
      const client = testClient();
      client.chat.completions.create = vi.fn().mockResolvedValue(
        fakeChunkStream([
          { id: 'c1', choices: [{ delta: { content: 'a' } }] } as unknown as ChatCompletionChunk,
          { id: 'c2', choices: [{ delta: {} }] } as unknown as ChatCompletionChunk,
        ]),
      );
      const model = new CognipeerLangChainChatModel({ client, model: 'gpt-4o' });
      const handleLLMNewToken = vi.fn();

      const chunks = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage('Hi')],
        {} as never,
        { handleLLMNewToken } as never,
      )) {
        chunks.push(chunk);
      }

      expect(handleLLMNewToken).toHaveBeenCalledTimes(1);
      expect(handleLLMNewToken).toHaveBeenCalledWith('a');
    });
  });
});

describe('CognipeerTracingCallbackHandler', () => {
  it('uses a provided sessionId or generates one', () => {
    const client = testClient();
    const withId = new CognipeerTracingCallbackHandler({ client, sessionId: 'sess_fixed' });
    expect(withId.getSessionId()).toBe('sess_fixed');

    const withoutId = new CognipeerTracingCallbackHandler({ client });
    expect(withoutId.getSessionId()).toBeTruthy();
  });

  it('flush() is a no-op when there are no buffered events', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({ client });

    await handler.flush();

    expect(ingest).not.toHaveBeenCalled();
  });

  it('auto-flushes on chain end with status "running" by default', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({
      client,
      sessionId: 'sess_1',
      threadId: 'thread_1',
    });

    await handler.handleChainStart({ name: 'my-chain' }, { input: 'hi' }, 'run_1');
    await handler.handleChainEnd({ output: 'done' }, 'run_1');

    expect(ingest).toHaveBeenCalledTimes(1);
    const [payload] = ingest.mock.calls[0];
    expect(payload.sessionId).toBe('sess_1');
    expect(payload.threadId).toBe('thread_1');
    expect(payload.status).toBe('running');
    expect(payload.events).toHaveLength(2);
    expect(payload.events[0]).toMatchObject({ id: 'run_1', type: 'chain_start', label: 'my-chain' });
    expect(payload.events[1]).toMatchObject({ id: 'run_1', type: 'chain_end', status: 'completed' });
  });

  it('does not auto-flush when autoFlush is false', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({ client, autoFlush: false });

    await handler.handleChainStart({}, {}, 'run_1');
    await handler.handleChainEnd({}, 'run_1');

    expect(ingest).not.toHaveBeenCalled();
  });

  it('always flushes with status "error" on chain errors, even when autoFlush is false', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({ client, autoFlush: false });

    await handler.handleChainError(new Error('boom'), 'run_1');

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].status).toBe('error');
    expect(ingest.mock.calls[0][0].events[0]).toMatchObject({
      type: 'chain_error',
      status: 'error',
      metadata: { error: 'boom' },
    });
  });

  it('extracts token usage on LLM end and accumulates it into the summary', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({ client });

    await handler.handleLLMStart({ name: 'gpt-4o' }, ['hi'], 'run_1');
    await handler.handleLLMEnd(
      { llmOutput: { tokenUsage: { promptTokens: 10, completionTokens: 5 } } },
      'run_1',
    );

    const payload = ingest.mock.calls[0][0];
    expect(payload.summary).toMatchObject({ totalInputTokens: 10, totalOutputTokens: 5 });
    expect(payload.events[1]).toMatchObject({
      type: 'llm_end',
      usage: { promptTokens: 10, completionTokens: 5 },
    });
  });

  it('records and flushes tool start/end/error events', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({ client });

    await handler.handleToolStart({ name: 'search' }, { q: 'x' }, 'run_1');
    await handler.handleToolEnd({ result: 'ok' }, 'run_1');

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].events).toHaveLength(2);

    ingest.mockClear();
    await handler.handleToolStart({ name: 'search' }, {}, 'run_2');
    await handler.handleToolError(new Error('tool failed'), 'run_2');

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].status).toBe('error');
  });

  it('endSession flushes with the given status (defaulting to "completed")', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const handler = new CognipeerTracingCallbackHandler({ client });

    await handler.handleChainStart({}, {}, 'run_1');
    await handler.endSession();

    expect(ingest.mock.calls[0][0].status).toBe('completed');
  });

  it('logs via a custom logger when debug is enabled', async () => {
    const client = testClient();
    client.tracing.ingest = vi.fn().mockResolvedValue({});
    const logger = vi.fn();
    const handler = new CognipeerTracingCallbackHandler({ client, debug: true, logger });

    await handler.handleChainStart({}, {}, 'run_1');
    await handler.flush();

    expect(logger).toHaveBeenCalled();
  });
});

describe('createCognipeerAgentTracing', () => {
  it('returns a binding whose flush/end delegate to the underlying handler', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;

    const tracing = createCognipeerAgentTracing({ client, sessionId: 'sess_1' });

    expect(tracing.sessionId).toBe('sess_1');
    expect(tracing.callbacks).toEqual([tracing.handler]);
    expect(tracing.handler).toBeInstanceOf(CognipeerTracingCallbackHandler);

    await tracing.handler.handleChainStart({}, {}, 'run_1');
    await tracing.end();

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].status).toBe('completed');
  });
});

describe('createCognipeerTracingMiddleware', () => {
  it('returns a binding with the expected shape', () => {
    const client = testClient();
    const binding = createCognipeerTracingMiddleware({ client, sessionId: 'sess_1' });

    expect(binding.sessionId).toBe('sess_1');
    expect(binding.middleware.name).toBe('CognipeerTracingMiddleware');
    expect(typeof binding.middleware.beforeAgent).toBe('function');
    expect(typeof binding.middleware.wrapModelCall).toBe('function');
    expect(typeof binding.middleware.wrapToolCall).toBe('function');
  });

  it('beforeAgent/afterAgent record chain events; the auto-flush from handleChainEnd wins over the subsequent completed flush', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerTracingMiddleware({ client });

    await binding.middleware.beforeAgent?.({ messages: [] } as never, {} as never);
    await binding.middleware.afterAgent?.({ messages: [] } as never, {} as never);

    // handleChainEnd auto-flushes (autoFlush defaults true) with status "running"
    // before afterAgent's own `flush('completed')` runs - by then the event
    // buffer is already empty, so that second flush is a no-op.
    expect(ingest).toHaveBeenCalledTimes(1);
    const payload = ingest.mock.calls[0][0];
    expect(payload.status).toBe('running');
    expect(payload.events.map((e: { type: string }) => e.type)).toEqual(['chain_start', 'chain_end']);
  });

  it('wrapModelCall records an llm_end event around a successful call', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerTracingMiddleware({ client });
    const next = vi.fn().mockResolvedValue({ llmOutput: {} });

    const result = await binding.middleware.wrapModelCall?.({} as never, next);

    expect(result).toEqual({ llmOutput: {} });
    expect(next).toHaveBeenCalledTimes(1);
    await binding.flush('completed');
    expect(ingest.mock.calls[0][0].events[0]).toMatchObject({ type: 'llm_end', status: 'completed' });
  });

  it('wrapModelCall records an llm_error event and rethrows on failure', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerTracingMiddleware({ client });
    const failure = new Error('model exploded');
    const next = vi.fn().mockRejectedValue(failure);

    await expect(binding.middleware.wrapModelCall?.({} as never, next)).rejects.toThrow('model exploded');
    // handleLLMError always flushes regardless of autoFlush.
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].events[0]).toMatchObject({ type: 'llm_error', status: 'error' });
  });

  it('wrapToolCall records tool_start/tool_end using the tool call name and args', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerTracingMiddleware({ client });
    const next = vi.fn().mockResolvedValue('tool result');

    const result = await binding.middleware.wrapToolCall?.(
      { toolCall: { name: 'search', args: { q: 'x' } } } as never,
      next,
    );

    expect(result).toBe('tool result');
    await binding.flush('completed');
    const events = ingest.mock.calls[0][0].events;
    expect(events[0]).toMatchObject({ type: 'tool_start', label: 'search', metadata: { input: { q: 'x' } } });
    expect(events[1]).toMatchObject({ type: 'tool_end' });
  });

  it('wrapToolCall records tool_error and rethrows on failure', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerTracingMiddleware({ client });
    const failure = new Error('tool exploded');
    const next = vi.fn().mockRejectedValue(failure);

    await expect(
      binding.middleware.wrapToolCall?.({ toolCall: { name: 'search', args: {} } } as never, next),
    ).rejects.toThrow('tool exploded');
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].events[1]).toMatchObject({ type: 'tool_error', status: 'error' });
  });
});
