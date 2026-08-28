import { describe, it, expect, vi } from 'vitest';
import { ConsoleClient } from '../client';
import {
  CognipeerLangGraphTracer,
  createCognipeerLangGraphTracing,
  createTracedGraphInvoker,
  createTracedGraphStreamer,
} from './langgraph';

function testClient(): ConsoleClient {
  return new ConsoleClient({ apiKey: 'sk-test', fetch: vi.fn() });
}

describe('CognipeerLangGraphTracer', () => {
  it('reuses an existing ConsoleClient and accepts a fixed sessionId', () => {
    const client = testClient();
    const tracer = new CognipeerLangGraphTracer({ client, sessionId: 'sess_1' });

    expect(tracer.getSessionId()).toBe('sess_1');
    // @ts-expect-error - reaching into a private field for the test
    expect(tracer.client).toBe(client);
  });

  it('generates a sessionId when none is provided', () => {
    const tracer = new CognipeerLangGraphTracer({ client: testClient() });
    expect(tracer.getSessionId()).toBeTruthy();
  });

  describe('startGraph / endGraph', () => {
    it('records chain_start/chain_end and does NOT auto-flush by default', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      const graphId = tracer.startGraph('MyAgent', { input: 'hi' });
      await tracer.endGraph(graphId, { output: 'done' }, 'success');

      expect(ingest).not.toHaveBeenCalled();

      await tracer.flush('success');
      expect(ingest).toHaveBeenCalledTimes(1);
      const payload = ingest.mock.calls[0][0];
      expect(payload.events).toHaveLength(2);
      expect(payload.events[0]).toMatchObject({ type: 'chain_start', label: 'MyAgent' });
      expect(payload.events[1]).toMatchObject({ type: 'chain_end', label: 'MyAgent', status: 'success' });
    });

    it('auto-flushes on endGraph when autoFlush is enabled', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client, autoFlush: true });

      const graphId = tracer.startGraph('MyAgent');
      await tracer.endGraph(graphId);

      expect(ingest).toHaveBeenCalledTimes(1);
      expect(ingest.mock.calls[0][0].status).toBe('success');
    });

    it('logs a warning and no-ops when ending an unknown graph id', async () => {
      const client = testClient();
      client.tracing.ingest = vi.fn().mockResolvedValue({});
      const logger = vi.fn();
      const tracer = new CognipeerLangGraphTracer({ client, logger });

      await tracer.endGraph('does-not-exist');

      expect(logger).toHaveBeenCalledWith('warning: graph not found', 'does-not-exist');
    });
  });

  describe('startNode / endNode', () => {
    it('records an ai_call event with input/output sections and updates eventCounts', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      tracer.startGraph('MyAgent');
      const nodeId = tracer.startNode('callModel', { messages: ['hi'] });
      await tracer.endNode(nodeId, { messages: ['hi', 'there'] }, 'success');
      await tracer.flush();

      const events = ingest.mock.calls[0][0].events;
      const startEvent = events.find((e: { label: string; metadata: { input: unknown } }) => e.label === 'callModel' && e.metadata.input);
      const endEvent = events.find((e: { label: string; metadata: { output: unknown } }) => e.label === 'callModel' && e.metadata.output);
      expect(startEvent).toBeTruthy();
      expect(endEvent).toMatchObject({ type: 'ai_call', status: 'success' });
      expect(endEvent.sections).toEqual(
        expect.arrayContaining([expect.objectContaining({ label: 'Output' })]),
      );

      const summary = ingest.mock.calls[0][0].summary;
      expect(summary.eventCounts).toEqual({ callModel: 1 });
    });

    it('logs a warning and no-ops when ending an unknown node id', async () => {
      const client = testClient();
      const logger = vi.fn();
      const tracer = new CognipeerLangGraphTracer({ client, logger });

      await tracer.endNode('does-not-exist');

      expect(logger).toHaveBeenCalledWith('warning: node not found', 'does-not-exist');
    });

    it('auto-flushes on endNode with status "running" when autoFlush is enabled', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client, autoFlush: true });

      tracer.startGraph('MyAgent');
      const nodeId = tracer.startNode('callModel');
      await tracer.endNode(nodeId);

      expect(ingest).toHaveBeenCalledTimes(1);
      expect(ingest.mock.calls[0][0].status).toBe('running');
    });
  });

  describe('errorNode', () => {
    it('records an error event and always flushes, regardless of autoFlush', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client, autoFlush: false });

      tracer.startGraph('MyAgent');
      const nodeId = tracer.startNode('callModel');
      await tracer.errorNode(nodeId, new Error('boom'));

      expect(ingest).toHaveBeenCalledTimes(1);
      const payload = ingest.mock.calls[0][0];
      expect(payload.status).toBe('error');
      const errorEvent = payload.events.find((e: { type: string }) => e.type === 'error');
      expect(errorEvent).toMatchObject({ label: 'callModel', status: 'error', error: 'boom' });
    });

    it('handles an error for an unknown node id without throwing', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      await tracer.errorNode('unknown-node', 'plain string error');

      const errorEvent = ingest.mock.calls[0][0].events[0];
      expect(errorEvent).toMatchObject({ label: 'Unknown Node', error: 'plain string error' });
    });
  });

  describe('recordToolCall / recordLLMCall', () => {
    it('records a tool_call event with tool_call and tool_result sections', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      tracer.recordToolCall('search', { q: 'hi' }, { hits: 3 }, 42);
      await tracer.flush();

      const event = ingest.mock.calls[0][0].events[0];
      expect(event).toMatchObject({ type: 'tool_call', label: 'search', toolName: 'search', durationMs: 42 });
      expect(event.sections).toEqual([
        expect.objectContaining({ kind: 'tool_call', toolName: 'search' }),
        expect.objectContaining({ kind: 'tool_result', toolName: 'search' }),
      ]);
    });

    it('omits the tool_result section when no result is given', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      tracer.recordToolCall('search', { q: 'hi' });
      await tracer.flush();

      expect(ingest.mock.calls[0][0].events[0].sections).toHaveLength(1);
    });

    it('records an LLM call and accumulates token usage into the summary', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      tracer.recordLLMCall('gpt-4o', 10, 5, 100);
      tracer.recordLLMCall('gpt-4o', 3, 2);
      await tracer.flush();

      const payload = ingest.mock.calls[0][0];
      expect(payload.summary).toMatchObject({ totalInputTokens: 13, totalOutputTokens: 7 });
      expect(payload.events[0]).toMatchObject({
        type: 'ai_call',
        model: 'gpt-4o',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe('wrapNode / traceNodes', () => {
    it('wraps a node function, tracing successful invocations', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });
      const fn = vi.fn().mockResolvedValue({ messages: ['ok'] });

      tracer.startGraph('MyAgent');
      const traced = tracer.wrapNode('callModel', fn);
      const result = await traced({ messages: ['hi'] });

      expect(result).toEqual({ messages: ['ok'] });
      expect(fn).toHaveBeenCalledWith({ messages: ['hi'] });
      await tracer.flush();
      const types = ingest.mock.calls[0][0].events.map((e: { type: string }) => e.type);
      expect(types).toEqual(['chain_start', 'ai_call', 'ai_call']);
    });

    it('wraps a node function, tracing and rethrowing failures', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });
      const failure = new Error('node exploded');
      const fn = vi.fn().mockRejectedValue(failure);

      tracer.startGraph('MyAgent');
      const traced = tracer.wrapNode('callModel', fn);

      await expect(traced({})).rejects.toThrow('node exploded');
      // errorNode always flushes, regardless of autoFlush.
      expect(ingest).toHaveBeenCalledTimes(1);
      expect(ingest.mock.calls[0][0].status).toBe('error');
    });

    it('traceNodes wraps every function in the given map', async () => {
      const client = testClient();
      client.tracing.ingest = vi.fn().mockResolvedValue({});
      const tracer = new CognipeerLangGraphTracer({ client });
      const callModel = vi.fn().mockResolvedValue({});
      const tools = vi.fn().mockResolvedValue({});

      tracer.startGraph('MyAgent');
      const traced = tracer.traceNodes({ callModel, tools });
      await traced.callModel({});
      await traced.tools({});

      expect(callModel).toHaveBeenCalledTimes(1);
      expect(tools).toHaveBeenCalledTimes(1);
    });
  });

  describe('flush', () => {
    it('is a no-op when there are no buffered events', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const tracer = new CognipeerLangGraphTracer({ client });

      await tracer.flush();

      expect(ingest).not.toHaveBeenCalled();
    });

    it('swallows ingest errors, logs them, and keeps events buffered for a retry', async () => {
      const client = testClient();
      const ingest = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({});
      client.tracing.ingest = ingest;
      const logger = vi.fn();
      const tracer = new CognipeerLangGraphTracer({ client, logger });

      tracer.recordToolCall('search');
      await expect(tracer.flush()).resolves.toBeUndefined();

      expect(logger).toHaveBeenCalledWith('flush error:', 'network down');

      // Events were NOT cleared on failure, so the next flush retries them.
      await tracer.flush();
      expect(ingest).toHaveBeenCalledTimes(2);
      expect(ingest.mock.calls[1][0].events).toHaveLength(1);
    });
  });

  describe('endSession', () => {
    it('ends any still-open graphs and flushes with the given status', async () => {
      const client = testClient();
      const ingest = vi.fn().mockResolvedValue({});
      client.tracing.ingest = ingest;
      const logger = vi.fn();
      const tracer = new CognipeerLangGraphTracer({ client, logger });

      tracer.startGraph('MyAgent');
      await tracer.endSession('success');

      expect(ingest).toHaveBeenCalledTimes(1);
      expect(ingest.mock.calls[0][0].status).toBe('success');
      expect(logger).toHaveBeenCalledWith('session ended:', tracer.getSessionId());
    });
  });
});

describe('createCognipeerLangGraphTracing', () => {
  it('returns a binding that delegates to an internal tracer', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerLangGraphTracing({ client, sessionId: 'sess_1' });

    expect(binding.sessionId).toBe('sess_1');
    expect(binding.tracer).toBeInstanceOf(CognipeerLangGraphTracer);

    const graphId = binding.startGraph('MyAgent');
    await binding.endGraph(graphId, { done: true }, 'success');
    await binding.end('success');

    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('wrapNode and traceNodes delegate to the tracer', async () => {
    const client = testClient();
    client.tracing.ingest = vi.fn().mockResolvedValue({});
    const binding = createCognipeerLangGraphTracing({ client });
    const fn = vi.fn().mockResolvedValue('ok');
    binding.startGraph('MyAgent');

    const wrapped = binding.wrapNode('node1', fn);
    await wrapped();

    const traced = binding.traceNodes({ node2: fn });
    await traced.node2();

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createTracedGraphInvoker', () => {
  it('starts and ends the graph around a successful invoke', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerLangGraphTracing({ client, autoFlush: true });
    const invoker = createTracedGraphInvoker(binding, 'MyAgent');
    const graph = { invoke: vi.fn().mockResolvedValue({ result: 'done' }) };

    const result = await invoker(graph, { input: 'hi' });

    expect(result).toEqual({ result: 'done' });
    expect(graph.invoke).toHaveBeenCalledWith({ input: 'hi' });
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest.mock.calls[0][0].events[1]).toMatchObject({ type: 'chain_end', status: 'success' });
  });

  it('ends the graph with status "error" and rethrows when invoke fails', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerLangGraphTracing({ client, autoFlush: true });
    const invoker = createTracedGraphInvoker(binding, 'MyAgent');
    const failure = new Error('invoke failed');
    const graph = { invoke: vi.fn().mockRejectedValue(failure) };

    await expect(invoker(graph, {})).rejects.toThrow('invoke failed');
    expect(ingest.mock.calls[0][0].events[1]).toMatchObject({ type: 'chain_end', status: 'error' });
  });
});

describe('createTracedGraphStreamer', () => {
  async function* fakeStream(chunks: unknown[]) {
    for (const chunk of chunks) yield chunk;
  }

  it('streams chunks through and ends the graph with the last chunk as final state', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerLangGraphTracing({ client, autoFlush: true });
    const streamer = createTracedGraphStreamer(binding, 'MyAgent');
    const graph = { stream: () => fakeStream([{ step: 1 }, { step: 2 }]) };

    const collected = [];
    for await (const chunk of streamer(graph, {})) {
      collected.push(chunk);
    }

    expect(collected).toEqual([{ step: 1 }, { step: 2 }]);
    expect(ingest.mock.calls[0][0].events[1]).toMatchObject({ type: 'chain_end', status: 'success' });
  });

  it('ends the graph with status "error" and rethrows when the stream throws', async () => {
    const client = testClient();
    const ingest = vi.fn().mockResolvedValue({});
    client.tracing.ingest = ingest;
    const binding = createCognipeerLangGraphTracing({ client, autoFlush: true });
    const streamer = createTracedGraphStreamer(binding, 'MyAgent');
    async function* throwingStream(): AsyncGenerator<unknown> {
      yield { step: 1 };
      throw new Error('stream broke');
    }
    const graph = { stream: () => throwingStream() };

    const collected: unknown[] = [];
    await expect(async () => {
      for await (const chunk of streamer(graph, {})) {
        collected.push(chunk);
      }
    }).rejects.toThrow('stream broke');

    expect(collected).toEqual([{ step: 1 }]);
    expect(ingest.mock.calls[0][0].events[1]).toMatchObject({ type: 'chain_end', status: 'error' });
  });
});
