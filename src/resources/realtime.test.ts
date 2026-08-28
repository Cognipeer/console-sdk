import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  RealtimeResource,
  RealtimeModelsResource,
  RealtimeConnection,
  WebSocketLike,
} from './realtime';
import { createMockHttp } from '../test/mockHttp';

type Listener = (event: unknown) => void;

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];

  readyState = 1; // OPEN
  sent: string[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  private listeners: Record<string, Listener[]> = {};

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.closeCalls.push({ code, reason });
  }

  addEventListener(type: string, listener: Listener): void {
    (this.listeners[type] ??= []).push(listener);
  }

  emit(type: string, event?: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }

  lastSentType(): string | undefined {
    const last = this.sent[this.sent.length - 1];
    return last ? (JSON.parse(last) as { type?: string }).type : undefined;
  }
}

describe('RealtimeModelsResource', () => {
  it('lists realtime models, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new RealtimeModelsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/realtime/models');
  });

  it('creates a realtime model', async () => {
    const http = createMockHttp();
    const model = { id: 'model1', key: 'support-voice' };
    http.request.mockResolvedValue(model);
    const resource = new RealtimeModelsResource(http);

    const result = await resource.create({ key: 'support-voice' } as never);

    expect(result).toBe(model);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/realtime/models', {
      body: { key: 'support-voice' },
    });
  });

  it('retrieves a realtime model by id', async () => {
    const http = createMockHttp();
    const model = { id: 'model1' };
    http.request.mockResolvedValue(model);
    const resource = new RealtimeModelsResource(http);

    const result = await resource.retrieve('model1');

    expect(result).toBe(model);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/realtime/models/model1');
  });

  it('updates a realtime model', async () => {
    const http = createMockHttp();
    const model = { id: 'model1', key: 'renamed' };
    http.request.mockResolvedValue(model);
    const resource = new RealtimeModelsResource(http);

    const result = await resource.update('model1', { key: 'renamed' } as never);

    expect(result).toBe(model);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/realtime/models/model1', {
      body: { key: 'renamed' },
    });
  });

  it('deletes a realtime model', async () => {
    const http = createMockHttp();
    const response = { deleted: true, id: 'model1' };
    http.request.mockResolvedValue(response);
    const resource = new RealtimeModelsResource(http);

    const result = await resource.delete('model1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/realtime/models/model1');
  });
});

describe('RealtimeResource', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.useRealTimers();
  });

  describe('url()', () => {
    it('builds a wss:// URL from an https:// base URL with the api key', () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const url = resource.url();

      expect(url).toBe('wss://console.cognipeer.com/api/client/v1/realtime?api_key=sk-test');
    });

    it('builds a ws:// URL from an http:// base URL', () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('http://localhost:3000', 'sk-test', http);

      expect(resource.url()).toBe('ws://localhost:3000/api/client/v1/realtime?api_key=sk-test');
    });

    it('includes model and agent when provided', () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const url = resource.url({ model: 'gpt-4o-realtime', agent: 'support-agent' });

      expect(url).toBe(
        'wss://console.cognipeer.com/api/client/v1/realtime?api_key=sk-test&model=gpt-4o-realtime&agent=support-agent',
      );
    });
  });

  describe('twilioStreamUrl()', () => {
    it('builds the Twilio Media Streams URL for a model', () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const url = resource.twilioStreamUrl('support-voice');

      expect(url).toBe(
        'wss://console.cognipeer.com/api/client/v1/realtime/twilio?api_key=sk-test&model=support-voice',
      );
    });
  });

  describe('connect()', () => {
    it('resolves a RealtimeConnection once the socket opens', async () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const connectPromise = resource.connect({ model: 'gpt-4o-realtime', webSocket: FakeWebSocket });
      const socket = FakeWebSocket.instances[0];
      expect(socket.url).toContain('model=gpt-4o-realtime');
      socket.emit('open');

      const connection = await connectPromise;

      expect(connection).toBeInstanceOf(RealtimeConnection);
    });

    it('sends a session.update with the runtime context once connected', async () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const connectPromise = resource.connect({
        webSocket: FakeWebSocket,
        runtimeContext: { userId: 'u1' } as never,
      });
      const socket = FakeWebSocket.instances[0];
      socket.emit('open');
      await connectPromise;

      expect(socket.sent).toHaveLength(1);
      const payload = JSON.parse(socket.sent[0]);
      expect(payload).toEqual({ type: 'session.update', session: { runtime_context: { userId: 'u1' } } });
    });

    it('rejects when the socket errors before opening', async () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const connectPromise = resource.connect({ webSocket: FakeWebSocket });
      const socket = FakeWebSocket.instances[0];
      socket.emit('error', new Error('connection refused'));

      await expect(connectPromise).rejects.toThrow('connection refused');
    });

    it('throws when no WebSocket implementation is available', async () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);
      const original = (globalThis as { WebSocket?: unknown }).WebSocket;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket = undefined;

      try {
        await expect(resource.connect()).rejects.toThrow('No WebSocket implementation found');
      } finally {
        (globalThis as { WebSocket?: unknown }).WebSocket = original;
      }
    });
  });
});

describe('RealtimeConnection', () => {
  it('dispatches server events to type-specific and wildcard listeners', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);
    const specific = vi.fn();
    const wildcard = vi.fn();
    connection.on('response.done', specific);
    connection.on('*', wildcard);

    socket.emit('message', { data: JSON.stringify({ type: 'response.done', status: 'completed' }) });

    expect(specific).toHaveBeenCalledWith({ type: 'response.done', status: 'completed' });
    expect(wildcard).toHaveBeenCalledWith({ type: 'response.done', status: 'completed' });
  });

  it('ignores unparsable message data', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);
    const listener = vi.fn();
    connection.on('*', listener);

    socket.emit('message', { data: 'not-json' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('off() unsubscribes a listener', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);
    const listener = vi.fn();
    connection.on('response.done', listener);
    connection.off('response.done', listener);

    socket.emit('message', { data: JSON.stringify({ type: 'response.done' }) });

    expect(listener).not.toHaveBeenCalled();
  });

  it('send() throws when the socket is not open', () => {
    const socket = new FakeWebSocket('wss://test');
    socket.readyState = 0; // CONNECTING
    const connection = new RealtimeConnection(socket);

    expect(() => connection.send({ type: 'ping' })).toThrow('Realtime socket is not open');
  });

  it('updateSession sends a session.update event', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.updateSession({ instructions: 'be nice' } as never);

    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'session.update',
      session: { instructions: 'be nice' },
    });
  });

  it('createItem sends a conversation.item.create event, defaulting role to user', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.createItem('hello');

    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'conversation.item.create',
      item: { role: 'user', content: 'hello' },
    });
  });

  it('appendAudio base64-encodes raw bytes before sending', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.appendAudio(new Uint8Array([104, 105])); // "hi"

    const payload = JSON.parse(socket.sent[0]);
    expect(payload.type).toBe('input_audio_buffer.append');
    expect(payload.audio).toBe(Buffer.from([104, 105]).toString('base64'));
  });

  it('appendAudio passes through an already-base64 string', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.appendAudio('aGk=');

    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'input_audio_buffer.append',
      audio: 'aGk=',
    });
  });

  it('clearAudio, commitAudio, createResponse, cancelResponse send the expected event types', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.clearAudio();
    expect(socket.lastSentType()).toBe('input_audio_buffer.clear');

    connection.commitAudio();
    expect(socket.lastSentType()).toBe('input_audio_buffer.commit');

    connection.createResponse({ instructions: 'be concise' });
    expect(JSON.parse(socket.sent[socket.sent.length - 1])).toEqual({
      type: 'response.create',
      response: { instructions: 'be concise' },
    });

    connection.cancelResponse();
    expect(socket.lastSentType()).toBe('response.cancel');
  });

  it('close() closes the underlying socket', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.close();

    expect(socket.closeCalls).toHaveLength(1);
  });

  describe('respond()', () => {
    it('resolves with the accumulated text and audio once response.done completes', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      socket.emit('message', {
        data: JSON.stringify({ type: 'response.audio.delta', audio: 'AAA' }),
      });
      socket.emit('message', {
        data: JSON.stringify({ type: 'response.audio.delta', audio: 'BBB' }),
      });
      socket.emit('message', {
        data: JSON.stringify({ type: 'response.output_text.done', text: 'Hi there' }),
      });
      socket.emit('message', {
        data: JSON.stringify({ type: 'response.done', status: 'completed' }),
      });

      const result = await promise;
      expect(result).toEqual({ text: 'Hi there', audio: 'AAABBB' });
      expect(socket.sent.some((s) => JSON.parse(s).type === 'conversation.item.create')).toBe(true);
      expect(socket.sent.some((s) => JSON.parse(s).type === 'response.create')).toBe(true);
    });

    it('rejects when response.done reports a failure status', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      socket.emit('message', {
        data: JSON.stringify({ type: 'response.done', status: 'failed', error: { message: 'oops' } }),
      });

      await expect(promise).rejects.toThrow('oops');
    });

    it('rejects when the connection reports an error event', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      socket.emit('message', {
        data: JSON.stringify({ type: 'error', error: { message: 'socket exploded' } }),
      });

      await expect(promise).rejects.toThrow('socket exploded');
    });

    it('rejects with a timeout error once the timeout elapses', async () => {
      vi.useFakeTimers();
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello', { timeoutMs: 1000 });
      const expectation = expect(promise).rejects.toThrow('Realtime response timed out');
      await vi.advanceTimersByTimeAsync(1000);
      await expectation;
      vi.useRealTimers();
    });
  });
});
