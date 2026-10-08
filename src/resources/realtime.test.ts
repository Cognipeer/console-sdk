import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  RealtimeResource,
  RealtimeModelsResource,
  RealtimeCallsResource,
  RealtimeSessionsResource,
  RealtimeConnection,
  WebSocketLike,
  float32ToPcm16,
  pcm16ToFloat32,
} from './realtime';
import type { RealtimeCloseInfo } from './realtime';
import type {
  RealtimeAudioChunk,
  RealtimeCall,
  RealtimeCallCreateRequest,
  RealtimeModel,
  RealtimeSessionView,
  UpdateRealtimeModelRequest,
} from '../types';
import { HttpClient } from '../http';
import { createMockHttp } from '../test/mockHttp';

/** `never` so the one implementation satisfies every typed `addEventListener` overload. */
type Listener = (event: never) => void;

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];

  readyState = 1; // OPEN
  binaryType?: string;
  sent: string[] = [];
  /** Binary frames, as handed to `send()`. */
  binary: Uint8Array[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  private listeners: Record<string, Listener[]> = {};

  constructor(public url: string, public init?: unknown) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string | ArrayBufferLike | ArrayBufferView): void {
    if (typeof data === 'string') this.sent.push(data);
    else this.binary.push(data as Uint8Array);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.closeCalls.push({ code, reason });
  }

  addEventListener(type: string, listener: Listener): void {
    (this.listeners[type] ??= []).push(listener);
  }

  emit(type: string, event?: unknown): void {
    for (const listener of this.listeners[type] ?? []) (listener as (event: unknown) => void)(event);
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

  it('updates a realtime model, sending null to clear optional fields', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'model1' });
    const patch: UpdateRealtimeModelRequest = { voice: null, stt_language: null, stt_prompt: null, turn_detection: null, name: 'Renamed' };

    await new RealtimeModelsResource(http).update('model1', patch);

    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/realtime/models/model1', { body: patch });
  });

  it('writes a retrieved preset back — { ...retrieved, name } — with its view shapes (null sub-fields, read-only keys)', async () => {
    // Everything here is typed as the server returns it: the point is that this body is a valid
    // UpdateRealtimeModelRequest as it is (under `tsc --strict` too), not just at runtime.
    const retrieved: RealtimeModel = {
      id: 'model1',
      object: 'realtime.model',
      key: 'support-voice',
      name: 'Support',
      description: null,
      status: 'active',
      chat_model_key: null,
      agent_key: 'support-agent',
      instructions: null,
      temperature: null,
      max_output_tokens: null,
      stt_model_key: 'stt',
      tts_model_key: 'tts',
      voice: null,
      tool_status_message: null,
      tool_wait_audio: false,
      output_audio_format: null,
      turn_detection: {
        type: 'semantic_vad',
        threshold: null,
        prefix_padding_ms: null,
        min_speech_ms: null,
        silence_duration_ms: null,
        max_turn_silence_ms: null,
        semantic_threshold: null,
        eagerness: 'auto',
        interrupt_min_ms: null,
        max_utterance_ms: null,
        create_response: true,
        interrupt_response: true,
      },
      stt_mode: null,
      stt_language: 'tr',
      stt_prompt: null,
      first_speaker: null,
      first_message: { mode: 'static', text: 'Merhaba', instructions: null, interruptible: true },
      wait_for_user_ms: null,
      interrupt_min_ms: null,
      agent_version: 'published',
      telephony: { connection_key: 'main', from_number: null, inbound_enabled: null, outbound_first_speaker: null },
      metadata: {},
      created_at: '2026-10-07T10:00:00.000Z',
      updated_at: null,
    };
    const http = createMockHttp();
    http.request.mockResolvedValue(retrieved);
    const resource = new RealtimeModelsResource(http);

    await resource.update('model1', { ...retrieved, name: 'Renamed' });
    expect(http.request).toHaveBeenLastCalledWith('PATCH', '/api/client/v1/realtime/models/model1', {
      body: { ...retrieved, name: 'Renamed' },
    });

    // Sub-field patches: first_message / telephony merge, a null removes one key; turn_detection
    // replaces the whole setting and may leave `type` out (semantic_vad).
    const patch: UpdateRealtimeModelRequest = {
      first_message: { interruptible: false, text: null },
      telephony: { inbound_enabled: false, from_number: null, outbound_first_speaker: null },
      turn_detection: { eagerness: 'high', interrupt_min_ms: 300 },
      chat_model_key: null,
      agent_key: null,
    };
    await resource.update('model1', patch);
    expect(http.request).toHaveBeenLastCalledWith('PATCH', '/api/client/v1/realtime/models/model1', { body: patch });
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

  it('has no legacy Twilio helpers (stream URLs are minted by the server)', () => {
    const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp()) as unknown as Record<string, unknown>;

    expect(resource.twilioStreamUrl).toBeUndefined();
    expect(resource.twilioStreamTwiml).toBeUndefined();
  });

  describe('connect()', () => {
    it('resolves a RealtimeConnection once the server has created the session', async () => {
      const http = createMockHttp();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', http);

      const connectPromise = resource.connect({ model: 'gpt-4o-realtime', webSocket: FakeWebSocket });
      const socket = FakeWebSocket.instances[0];
      expect(socket.url).toContain('model=gpt-4o-realtime');
      accept(socket);

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
      accept(socket);
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
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Hello' } });
      message(socket, { type: 'response.created', response: { id: 'r1' } });
      for (const bytes of [[1, 0], [2, 0]]) {
        message(socket, {
          type: 'response.audio.delta',
          response_id: 'r1',
          audio: Buffer.from(bytes).toString('base64'),
          format: 'pcm16',
          sample_rate: 24000,
          content_type: 'audio/L16;rate=24000',
        });
      }
      message(socket, { type: 'response.output_text.done', response_id: 'r1', text: 'Hi there' });
      message(socket, { type: 'response.done', response_id: 'r1', status: 'completed' });

      const result = await promise;
      expect(result).toEqual({ text: 'Hi there', audio: Buffer.from([1, 0, 2, 0]).toString('base64'), responseId: 'r1' });
      // One event: the server appends the user item and starts the response in the same step.
      expect(socket.sent.map((s) => JSON.parse(s))).toEqual([
        { type: 'response.create', response: { input: 'Hello' } },
      ]);
    });

    it('rejects when response.done reports a failure status', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Hello' } });
      message(socket, { type: 'response.created', response: { id: 'r1' } });
      message(socket, { type: 'response.done', response_id: 'r1', status: 'failed', error: { message: 'oops' } });

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

// ── Protocol v2 ───────────────────────────────────────────────────────

/** A `ws`-package look-alike: the real class carries Receiver/Sender statics. */
class WsLikeSocket extends FakeWebSocket {
  static Receiver = class {};
  static Sender = class {};
}

/**
 * What `ws` looks like to an ES-module importer (`ws/wrapper.mjs`): the bare
 * class — no `Receiver` / `Sender` statics, but the `terminate()` / `ping()`
 * methods every `ws` socket has.
 */
class WsEsmLikeSocket extends FakeWebSocket {
  terminate(): void {
    this.readyState = 3;
  }

  ping(): void {}

  pong(): void {}
}

function message(socket: FakeWebSocket, event: Record<string, unknown>): void {
  socket.emit('message', { data: JSON.stringify(event) });
}

/** The server's side of a successful connect: the upgrade completes, then the session is created. */
function accept(socket: FakeWebSocket, session: Record<string, unknown> = { id: 'sess_test' }): void {
  socket.emit('open');
  message(socket, { type: 'session.created', session });
}

/** Let a task pass: the frames a connection holds back at session.created are released once it is over. */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A close from the other side, the way a real socket reports it. */
function close(socket: FakeWebSocket, code: number, reason = ''): void {
  socket.readyState = 3;
  socket.emit('close', { code, reason });
}

/** The server's side of a refused connect: the upgrade completes, then an `error` event and the close. */
function refuse(socket: FakeWebSocket, text: string, code = 'unauthorized'): void {
  socket.emit('open');
  message(socket, { type: 'error', error: { message: text, code } });
  close(socket, 4401, 'Unauthorized');
}

function binaryFrame(socket: FakeWebSocket, data: unknown): void {
  socket.emit('message', { data });
}

function collectAudio(connection: RealtimeConnection): RealtimeAudioChunk[] {
  const chunks: RealtimeAudioChunk[] = [];
  connection.onAudio((chunk) => chunks.push(chunk));
  return chunks;
}

function int16Le(...samples: number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, i) => view.setInt16(i * 2, sample, true));
  return bytes;
}

async function openConnection(
  options: Parameters<RealtimeResource['connect']>[0] = {},
): Promise<{ socket: FakeWebSocket; connection: RealtimeConnection }> {
  const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
  const promise = resource.connect({ webSocket: FakeWebSocket, ...options });
  const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  accept(socket);
  return { socket, connection: await promise };
}

describe('RealtimeResource (protocol v2)', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
  });

  describe('url()', () => {
    it('omits the api key on request and drops an empty query string', () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());

      expect(resource.url({ includeApiKey: false })).toBe('wss://console.cognipeer.com/api/client/v1/realtime');
      expect(resource.url({ includeApiKey: false, model: 'voice' })).toBe(
        'wss://console.cognipeer.com/api/client/v1/realtime?model=voice',
      );
    });

    it('encodes first_speaker and variables (JSON) query parameters', () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());

      const url = new URL(resource.url({ model: 'voice', firstSpeaker: 'agent', variables: { customer_name: 'Ayşe' } }));

      expect(url.searchParams.get('api_key')).toBe('sk-test');
      expect(url.searchParams.get('first_speaker')).toBe('agent');
      expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({ customer_name: 'Ayşe' });
    });
  });

  describe('connect() auth', () => {
    it('sends an Authorization header (and no ?api_key=) through the ws package', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());

      const promise = resource.connect({ model: 'voice', webSocket: WsLikeSocket });
      const socket = FakeWebSocket.instances[0];
      accept(socket);
      await promise;

      expect(socket.url).toBe('wss://console.cognipeer.com/api/client/v1/realtime?model=voice');
      expect(socket.init).toEqual({ headers: { Authorization: 'Bearer sk-test' } });
    });

    it('recognises the ws package when it is imported as an ES module (no Receiver / Sender statics)', async () => {
      // `import WebSocket from 'ws'` resolves to ws/wrapper.mjs — the bare class. The key must still
      // go in the header, never in the URL, and extra upgrade headers must still be accepted.
      expect((WsEsmLikeSocket as unknown as Record<string, unknown>).Receiver).toBeUndefined();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-full-scope', createMockHttp());

      const promise = resource.connect({
        model: 'voice',
        webSocket: WsEsmLikeSocket,
        headers: { 'X-Cpr-Hdr-Tenant': 't1' },
      });
      const socket = FakeWebSocket.instances[0];
      accept(socket);
      await promise;

      expect(socket.url).toBe('wss://console.cognipeer.com/api/client/v1/realtime?model=voice');
      expect(socket.init).toEqual({
        headers: { 'X-Cpr-Hdr-Tenant': 't1', Authorization: 'Bearer sk-full-scope' },
      });
    });

    it('merges extra upgrade headers but never lets them replace Authorization', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());

      const promise = resource.connect({
        webSocket: WsLikeSocket,
        headers: { 'X-Cpr-Hdr-Tenant': 't1', Authorization: 'Bearer other' },
      });
      accept(FakeWebSocket.instances[0]);
      await promise;

      expect(FakeWebSocket.instances[0].init).toEqual({
        headers: { 'X-Cpr-Hdr-Tenant': 't1', Authorization: 'Bearer sk-test' },
      });
    });

    it('falls back to ?api_key= for implementations that cannot set headers (browsers)', async () => {
      const { socket } = await openConnection();

      expect(socket.url).toBe('wss://console.cognipeer.com/api/client/v1/realtime?api_key=sk-test');
      expect(socket.init).toBeUndefined();
    });

    it('honours an explicit auth mode', async () => {
      const header = await openConnection({ auth: 'header' });
      expect(header.socket.url).not.toContain('api_key');
      expect(header.socket.init).toEqual({ headers: { Authorization: 'Bearer sk-test' } });

      const query = await openConnection({ auth: 'query', webSocket: WsLikeSocket });
      expect(query.socket.url).toContain('api_key=sk-test');
      expect(query.socket.init).toBeUndefined();
    });

    it("uses the header with Node's global WebSocket (Node >= 22)", async () => {
      const original = (globalThis as { WebSocket?: unknown }).WebSocket;
      (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
      try {
        const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
        const promise = resource.connect();
        accept(FakeWebSocket.instances[0]);
        await promise;

        const major = Number(process.versions.node.split('.')[0]);
        expect(FakeWebSocket.instances[0].init).toEqual(
          major >= 22 ? { headers: { Authorization: 'Bearer sk-test' } } : undefined,
        );
      } finally {
        (globalThis as { WebSocket?: unknown }).WebSocket = original;
      }
    });

    it('refuses extra headers when they cannot be sent', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());

      await expect(
        resource.connect({ webSocket: FakeWebSocket, headers: { 'X-Cpr-Hdr-A': '1' } }),
      ).rejects.toThrow('upgrade headers');
      expect(FakeWebSocket.instances).toHaveLength(0);
    });
  });

  describe('connect() session', () => {
    it('sends one initial session.update merging session, runtime context, variables and first message', async () => {
      const { socket } = await openConnection({
        session: { input_audio_format: 'pcm16', variables: { a: '1' } },
        runtimeContext: { userId: 'u1' } as never,
        variables: { customer_name: 'Ayşe' },
        firstSpeaker: 'agent',
        firstMessage: { mode: 'static', text: 'Merhaba {{customer_name}}' },
      });

      expect(socket.sent).toHaveLength(1);
      expect(JSON.parse(socket.sent[0])).toEqual({
        type: 'session.update',
        session: {
          input_audio_format: 'pcm16',
          runtime_context: { userId: 'u1' },
          variables: { a: '1', customer_name: 'Ayşe' },
          first_speaker: 'agent',
          first_message: { mode: 'static', text: 'Merhaba {{customer_name}}' },
        },
      });
    });

    it('sends nothing when no session options are given', async () => {
      const { socket } = await openConnection({ model: 'voice' });

      expect(socket.sent).toHaveLength(0);
    });

    it('captures the session.created that makes connect() resolve', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket });
      const socket = FakeWebSocket.instances[0];
      accept(socket, { id: 'sess_1', input_audio_format: 'pcm16' });

      const connection = await promise;

      expect(connection.session?.id).toBe('sess_1');
    });

    it('tracks the server session view, incl. variable names and degraded turn detection updates', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket });
      const socket = FakeWebSocket.instances[0];
      socket.emit('open');
      // The shape the server's sessionView() sends.
      const view: RealtimeSessionView = {
        id: 'sess_2',
        model: 'gpt',
        agent_key: null,
        instructions: null,
        temperature: null,
        max_output_tokens: null,
        transcription_model: 'stt',
        input_audio_format: 'pcm16',
        input_audio_sample_rate: 24000,
        tts_model: 'tts',
        voice: null,
        output_audio_format: 'pcm16',
        output_audio_sample_rate: 24000,
        audio_transport: 'binary',
        turn_detection: {
          type: 'semantic_vad',
          threshold: null,
          prefix_padding_ms: null,
          min_speech_ms: null,
          silence_duration_ms: null,
          max_turn_silence_ms: null,
          semantic_threshold: null,
          eagerness: 'auto',
          interrupt_min_ms: null,
          max_utterance_ms: null,
          create_response: true,
          interrupt_response: true,
        },
        input_audio_transcription: { model: 'stt', language: 'tr', prompt: null },
        stt_mode: 'streaming',
        first_speaker: 'agent',
        first_message: { mode: 'static', text: 'Merhaba', instructions: null, interruptible: true },
        wait_for_user_ms: null,
        variable_keys: ['customer_name'],
        agent_version: null,
        degraded: 'turn: silence-only endpointing (model still loading)',
        tool_status_message: null,
        tool_wait_audio: false,
        runtime_context: null,
      };
      message(socket, { type: 'session.created', session: view });
      const connection = await promise;
      expect(connection.session?.variable_keys).toEqual(['customer_name']);
      expect(connection.session?.degraded).toMatch(/model still loading/);
      await nextTask();

      const updates: Array<string | null | undefined> = [];
      connection.on('session.updated', (event) => updates.push(event.session.degraded));
      message(socket, { type: 'session.updated', session: { ...view, degraded: null } });
      expect(updates).toEqual([null]);
      expect(connection.session?.degraded).toBeNull();
    });

    it('rejects when the socket closes before opening', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket });

      FakeWebSocket.instances[0].emit('close', { code: 1008, reason: 'unauthorized' });

      await expect(promise).rejects.toThrow('closed before opening (code 1008)');
    });
  });

  describe('connect() readiness', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('stays pending after the socket opens and resolves on session.created, not before', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const settled = vi.fn();
      const promise = resource.connect({ webSocket: FakeWebSocket });
      promise.then(settled, settled);
      const socket = FakeWebSocket.instances[0];

      socket.emit('open');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(settled).not.toHaveBeenCalled();

      message(socket, { type: 'session.created', session: { id: 'sess_ready' } });
      const connection = await promise;
      expect(connection.session?.id).toBe('sess_ready');
    });

    it('delivers the frames that arrive right behind session.created to listeners attached after connect() resolves', async () => {
      // One socket read can carry several frames: the session, the echo of the initial update, a text
      // greeting. connect() resolves inside the dispatch of the first — its caller has not listened yet.
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket, firstSpeaker: 'agent' });
      const socket = FakeWebSocket.instances[0];
      socket.emit('open');
      message(socket, { type: 'session.created', session: { id: 'sess_1' } });
      message(socket, { type: 'session.updated', session: { id: 'sess_1', first_speaker: 'agent' } });
      message(socket, { type: 'response.created', response: { id: 'greeting' } });
      message(socket, { type: 'response.output_text.done', response_id: 'greeting', text: 'Merhaba' });
      binaryFrame(socket, int16Le(1, 2));

      const connection = await promise;
      const seen: string[] = [];
      connection.on('*', (event) => seen.push(event.type));
      const chunks = collectAudio(connection);
      message(socket, { type: 'response.done', response_id: 'greeting', status: 'completed' });
      expect(seen).toEqual([]);
      await nextTask();

      expect(seen).toEqual(['session.updated', 'response.created', 'response.output_text.done', 'response.done']);
      expect(chunks.map((chunk) => chunk.responseId)).toEqual(['greeting']);
      expect(connection.session?.first_speaker).toBe('agent');
    });

    it('goes back to dispatching frames the moment they arrive once that task is over', async () => {
      const { socket, connection } = await openConnection();
      await nextTask();
      const seen: string[] = [];
      connection.on('*', (event) => seen.push(event.type));

      message(socket, { type: 'response.created', response: { id: 'r1' } });

      expect(seen).toEqual(['response.created']);
    });

    it('sends the initial session.update as soon as the socket opens — the server holds it while it authenticates', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket, firstSpeaker: 'agent' });
      const socket = FakeWebSocket.instances[0];

      socket.emit('open');
      expect(socket.sent.map((s) => JSON.parse(s))).toEqual([
        { type: 'session.update', session: { first_speaker: 'agent' } },
      ]);

      message(socket, { type: 'session.created', session: { id: 'sess_1' } });
      await promise;
    });

    it('rejects with the server\'s reason when the key is refused (an error event, then the 4401 close)', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-full-scope', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket, auth: 'query' });
      const socket = FakeWebSocket.instances[0];

      refuse(socket, 'The `?api_key=` query parameter requires a token scoped to the realtime service');

      await expect(promise).rejects.toThrow(
        'Realtime connection refused: The `?api_key=` query parameter requires a token scoped to the realtime service (unauthorized)',
      );
      expect(socket.closeCalls).toHaveLength(1);
    });

    it('rejects with the close code and reason when the server closes before creating the session', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket });
      const socket = FakeWebSocket.instances[0];

      socket.emit('open');
      close(socket, 1011, 'Internal error');

      await expect(promise).rejects.toThrow('closed before the session was created (code 1011: Internal error)');
    });

    it('rejects with the underlying error when the connection fails (ws wraps it in an ErrorEvent)', async () => {
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket });

      FakeWebSocket.instances[0].emit('error', { type: 'error', error: new Error('connect ECONNREFUSED 127.0.0.1:3000') });

      await expect(promise).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:3000');
    });

    it('gives up after timeoutMs and closes the socket', async () => {
      vi.useFakeTimers();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const promise = resource.connect({ webSocket: FakeWebSocket, timeoutMs: 1000 });
      const expectation = expect(promise).rejects.toThrow(
        'Realtime session not ready after 1000 ms (the socket is open, the server has not created the session)',
      );
      const socket = FakeWebSocket.instances[0];
      socket.emit('open');

      await vi.advanceTimersByTimeAsync(1000);

      await expectation;
      expect(socket.closeCalls).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('reports a socket that never opened as such, and timeoutMs: 0 waits forever', async () => {
      vi.useFakeTimers();
      const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());
      const timedOut = resource.connect({ webSocket: FakeWebSocket, timeoutMs: 500 });
      const expectation = expect(timedOut).rejects.toThrow('not ready after 500 ms (the socket did not open)');
      await vi.advanceTimersByTimeAsync(500);
      await expectation;

      const patient = resource.connect({ webSocket: FakeWebSocket, timeoutMs: 0 });
      const settled = vi.fn();
      patient.then(settled, settled);
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(settled).not.toHaveBeenCalled();
      accept(FakeWebSocket.instances[1]);
      await expect(patient).resolves.toBeInstanceOf(RealtimeConnection);
    });
  });

  it('exposes the calls resource', () => {
    const resource = new RealtimeResource('https://console.cognipeer.com', 'sk-test', createMockHttp());

    expect(resource.calls).toBeInstanceOf(RealtimeCallsResource);
  });
});

describe('RealtimeCallsResource', () => {
  it('creates an outbound call (connection + ring timeout pass through; server call view comes back)', async () => {
    const http = createMockHttp();
    // The server's call view (same shape for create / get / hangup).
    const call: RealtimeCall = {
      id: 'sess_1',
      object: 'realtime.call',
      session_id: 'sess_1',
      call_sid: 'CA1',
      status: 'queued',
      direction: 'outbound',
      from: '+15550100',
      to: '+905551234567',
      answered_by: null,
      duration_sec: null,
      connection_key: 'twilio-main',
      realtime_model: 'support-line',
      session_status: 'pending',
      started_at: '2026-10-06T18:00:00.000Z',
      ended_at: null,
    };
    http.request.mockResolvedValue(call);
    const body: RealtimeCallCreateRequest = {
      to: '+905551234567',
      model: 'support-line',
      variables: { customer_name: 'Ayşe' },
      first_speaker: 'user',
      first_message: { mode: 'generate', instructions: 'Kendini tanıt' },
      machine_detection: true,
      connection: 'twilio-main',
      ring_timeout_sec: 30,
    };

    const result = await new RealtimeCallsResource(http).create(body);

    expect(result).toBe(call);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/realtime/calls', { body });
  });

  it('gets a call by session id (URL-encoded)', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'a/b' });

    await new RealtimeCallsResource(http).get('a/b');

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/realtime/calls/a%2Fb');
  });

  it('asks the server to refresh the call from Twilio on request (?refresh=true)', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'sess_1', status: 'completed' });

    await new RealtimeCallsResource(http).get('sess_1', { refresh: true });

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/realtime/calls/sess_1', {
      query: { refresh: true },
    });
  });

  it('puts ?refresh=true on the wire, the value the server\'s route accepts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sess 1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const http = new HttpClient('https://console.cognipeer.com', 'sk-test', 5000, 0, fetchMock);

    await new RealtimeCallsResource(http).get('sess 1', { refresh: true });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://console.cognipeer.com/api/client/v1/realtime/calls/sess%201?refresh=true',
    );
  });

  it('does not refresh unless asked to', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'sess_1' });

    await new RealtimeCallsResource(http).get('sess_1', { refresh: false });
    await new RealtimeCallsResource(http).get('sess_1', {});

    expect(http.request).toHaveBeenNthCalledWith(1, 'GET', '/api/client/v1/realtime/calls/sess_1');
    expect(http.request).toHaveBeenNthCalledWith(2, 'GET', '/api/client/v1/realtime/calls/sess_1');
  });

  it('hangs up a call', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'sess_1', status: 'completed' });

    const result = await new RealtimeCallsResource(http).hangup('sess_1');

    expect(result).toEqual({ id: 'sess_1', status: 'completed' });
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/realtime/calls/sess_1/hangup');
  });
});

describe('RealtimeConnection (protocol v2)', () => {
  describe('sendAudio()', () => {
    it('sends raw bytes as a binary frame', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      connection.sendAudio(new Uint8Array([1, 2, 3, 4]));

      expect(socket.sent).toHaveLength(0);
      expect(Array.from(socket.binary[0])).toEqual([1, 2, 3, 4]);
    });

    it('accepts ArrayBuffer, Buffer views and Int16Array (as s16le)', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      connection.sendAudio(new Uint8Array([9, 8]).buffer);
      connection.sendAudio(Buffer.from([0, 1, 2, 3, 4, 5]).subarray(2, 4));
      connection.sendAudio(new Int16Array([1, -2]));

      expect(socket.binary.map((frame) => Array.from(frame))).toEqual([
        [9, 8],
        [2, 3],
        Array.from(int16Le(1, -2)),
      ]);
    });

    it('converts Float32 samples to pcm16', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      connection.sendAudio(new Float32Array([0, 1, -1, 2]));

      expect(Array.from(socket.binary[0])).toEqual(Array.from(int16Le(0, 32767, -32768, 32767)));
    });

    it('stays binary for pcm16 and G.711 sessions', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      connection.updateSession({ input_audio_format: 'g711_ulaw' });
      message(socket, { type: 'session.updated', session: { id: 's', input_audio_format: 'g711_ulaw' } });

      connection.sendAudio(new Uint8Array([0xff]));

      expect(socket.binary).toHaveLength(1);
    });

    it('sends base64 strings as JSON appends', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      connection.sendAudio('aGk=');

      expect(JSON.parse(socket.sent[0])).toEqual({ type: 'input_audio_buffer.append', audio: 'aGk=' });
    });

    it('throws when the socket is not open', () => {
      const socket = new FakeWebSocket('wss://test');
      socket.readyState = 3;
      const connection = new RealtimeConnection(socket);

      expect(() => connection.sendAudio(new Uint8Array([1]))).toThrow('Realtime socket is not open');
    });
  });

  it('appendAudio encodes typed arrays and ArrayBuffers too', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.appendAudio(new Int16Array([1]));
    connection.appendAudio(new Uint8Array([104, 105]).buffer);

    expect(JSON.parse(socket.sent[0]).audio).toBe(Buffer.from(int16Le(1)).toString('base64'));
    expect(JSON.parse(socket.sent[1]).audio).toBe('aGk=');
  });

  describe('onAudio()', () => {
    it('decodes v2 JSON pcm16 deltas to Int16 samples', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);

      message(socket, {
        type: 'response.audio.delta',
        response_id: 'resp_1',
        audio: Buffer.from(int16Le(100, -200, 32767)).toString('base64'),
        format: 'pcm16',
        sample_rate: 16000,
        content_type: 'audio/L16;rate=16000',
        text: 'Merhaba.',
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        responseId: 'resp_1',
        format: 'pcm16',
        sampleRate: 16000,
        contentType: 'audio/L16;rate=16000',
        text: 'Merhaba.',
        transport: 'json',
      });
      expect(Array.from(chunks[0].pcm!)).toEqual([100, -200, 32767]);
    });

    it('decodes JSON G.711 deltas and falls back to the session format for untagged deltas', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);

      message(socket, {
        type: 'response.audio.delta',
        response_id: 'r',
        audio: Buffer.from([0xff, 0x00]).toString('base64'),
        format: 'g711_ulaw',
        sample_rate: 8000,
        content_type: 'audio/PCMU;rate=8000',
      });
      message(socket, { type: 'response.audio.delta', response_id: 'r', audio: Buffer.from(int16Le(7)).toString('base64') });

      expect(chunks[0]).toMatchObject({ format: 'g711_ulaw', sampleRate: 8000, contentType: 'audio/PCMU;rate=8000' });
      expect(Array.from(chunks[0].pcm)).toEqual([0, -32124]);
      expect(chunks[1]).toMatchObject({ format: 'pcm16', sampleRate: 24000, contentType: 'audio/L16;rate=24000' });
      expect(Array.from(chunks[1].pcm)).toEqual([7]);
    });

    it('turns binary frames into chunks tagged with the current response and sentence', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);
      message(socket, {
        type: 'session.updated',
        session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 16000, audio_transport: 'binary' },
      });
      message(socket, { type: 'response.created', response: { id: 'resp_2' } });
      message(socket, { type: 'response.audio_transcript.delta', response_id: 'resp_2', delta: 'İlk cümle.' });

      binaryFrame(socket, int16Le(1, 2).buffer);
      binaryFrame(socket, Buffer.from(int16Le(3)));

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({
        responseId: 'resp_2',
        format: 'pcm16',
        sampleRate: 16000,
        contentType: 'audio/L16;rate=16000',
        text: 'İlk cümle.',
        transport: 'binary',
      });
      expect(Array.from(chunks[0].pcm!)).toEqual([1, 2]);
      expect(chunks[1].text).toBeUndefined();
      expect(Array.from(chunks[1].pcm!)).toEqual([3]);
    });

    it('joins ws fragment arrays', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);

      binaryFrame(socket, [Buffer.from([1, 0]), Buffer.from([2, 0])]);

      expect(Array.from(chunks[0].pcm!)).toEqual([1, 2]);
    });

    it('decodes G.711 μ-law and A-law frames', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);

      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'g711_ulaw' } });
      binaryFrame(socket, new Uint8Array([0xff, 0x7f, 0x00, 0x80]));
      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'g711_alaw' } });
      binaryFrame(socket, new Uint8Array([0xd5, 0x55, 0x2a, 0xaa]));

      expect(chunks[0]).toMatchObject({ format: 'g711_ulaw', sampleRate: 8000, contentType: 'audio/PCMU;rate=8000' });
      expect(Array.from(chunks[0].pcm!)).toEqual([0, 0, -32124, 32124]);
      expect(chunks[1]).toMatchObject({ format: 'g711_alaw', sampleRate: 8000, contentType: 'audio/PCMA;rate=8000' });
      expect(Array.from(chunks[1].pcm!)).toEqual([8, -8, -32256, 32256]);
    });

    it('uses the requested output format until the server echoes one, defaulting to pcm16 @ 24 kHz', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);

      binaryFrame(socket, int16Le(5));
      connection.updateSession({ output_audio_format: 'pcm16', output_audio_sample_rate: 48000 });
      binaryFrame(socket, int16Le(1));
      connection.updateSession({ output_audio_format: 'g711_alaw' });
      binaryFrame(socket, new Uint8Array([0xd5]));

      expect(chunks[0]).toMatchObject({ format: 'pcm16', sampleRate: 24000, contentType: 'audio/L16;rate=24000' });
      expect(chunks[1]).toMatchObject({ format: 'pcm16', sampleRate: 48000 });
      expect(chunks[2]).toMatchObject({ format: 'g711_alaw', sampleRate: 8000, contentType: 'audio/PCMA;rate=8000' });
      expect(Array.from(chunks[2].pcm)).toEqual([8]);
    });

    it('decodes a response\'s binary frames with the format it started with, even after a mid-response session.update', () => {
      // The server fixes a response's output format when it creates the response and echoes a later
      // session.update at once — the frames still on the wire keep the old rate.
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);
      message(socket, {
        type: 'session.updated',
        session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 24000, audio_transport: 'binary' },
      });
      message(socket, { type: 'response.created', response: { id: 'greeting' } });
      binaryFrame(socket, int16Le(1, 2));

      message(socket, {
        type: 'session.updated',
        session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 48000, audio_transport: 'binary' },
      });
      binaryFrame(socket, int16Le(3, 4));

      message(socket, { type: 'response.done', response_id: 'greeting', status: 'completed' });
      message(socket, { type: 'response.created', response: { id: 'answer' } });
      binaryFrame(socket, int16Le(5, 6));

      expect(chunks.map((chunk) => [chunk.responseId, chunk.sampleRate])).toEqual([
        ['greeting', 24000],
        ['greeting', 24000],
        ['answer', 48000],
      ]);
    });

    it('does not decode a G.711 response as the pcm16 the session switched to (or the other way round)', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);
      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'g711_ulaw' } });
      message(socket, { type: 'response.created', response: { id: 'phone' } });

      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 24000 } });
      binaryFrame(socket, new Uint8Array([0xff, 0x7f]));

      expect(chunks[0]).toMatchObject({ responseId: 'phone', format: 'g711_ulaw', sampleRate: 8000 });
      expect(Array.from(chunks[0].pcm)).toEqual([0, 0]);
    });

    it('falls back to the session echo for frames that belong to no known response', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);
      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 16000 } });

      binaryFrame(socket, int16Le(1));
      message(socket, { type: 'response.audio_transcript.delta', response_id: 'unseen', delta: 'Merhaba.' });
      binaryFrame(socket, int16Le(2));

      expect(chunks.map((chunk) => chunk.sampleRate)).toEqual([16000, 16000]);
    });

    it('forgets the oldest responses\' formats instead of growing without bound', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);
      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 16000 } });
      message(socket, { type: 'response.created', response: { id: 'resp_0' } });
      for (let i = 1; i <= 40; i++) message(socket, { type: 'response.created', response: { id: `resp_${i}` } });
      message(socket, { type: 'session.updated', session: { id: 's', output_audio_format: 'pcm16', output_audio_sample_rate: 8000 } });

      // resp_0 was evicted: its late frames use the session echo; resp_40 is still remembered.
      message(socket, { type: 'response.audio_transcript.delta', response_id: 'resp_0', delta: 'old' });
      binaryFrame(socket, int16Le(1));
      message(socket, { type: 'response.audio_transcript.delta', response_id: 'resp_40', delta: 'new' });
      binaryFrame(socket, int16Le(2));

      expect(chunks.map((chunk) => chunk.sampleRate)).toEqual([8000, 16000]);
    });

    it('drops a pending sentence when playback is cleared', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);

      message(socket, { type: 'response.audio_transcript.delta', response_id: 'r', delta: 'stale' });
      message(socket, { type: 'output_audio_buffer.cleared', response_id: 'r' });
      binaryFrame(socket, int16Le(1));

      expect(chunks[0].text).toBeUndefined();
    });

    it('dispatches JSON text that arrives as bytes as an event, not audio', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const chunks = collectAudio(connection);
      const listener = vi.fn();
      connection.on('response.done', listener);

      binaryFrame(socket, Buffer.from(JSON.stringify({ type: 'response.done', status: 'completed' })));

      expect(listener).toHaveBeenCalledWith({ type: 'response.done', status: 'completed' });
      expect(chunks).toHaveLength(0);
    });

    it('keeps event order when a frame arrives as a Blob', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const order: string[] = [];
      connection.onAudio((chunk) => order.push(`audio:${chunk.pcm![0]}`));
      connection.on('output_audio_buffer.cleared', () => order.push('cleared'));

      binaryFrame(socket, { arrayBuffer: async () => int16Le(42).buffer });
      message(socket, { type: 'output_audio_buffer.cleared', response_id: 'r' });
      expect(order).toEqual([]);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(order).toEqual(['audio:42', 'cleared']);

      // Back to synchronous delivery once the queue drained.
      message(socket, { type: 'output_audio_buffer.cleared', response_id: 'r' });
      expect(order).toEqual(['audio:42', 'cleared', 'cleared']);
    });

    it('unsubscribes', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const listener = vi.fn();
      const off = connection.onAudio(listener);
      off();

      binaryFrame(socket, int16Le(1));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('switches a blob binaryType to arraybuffer', () => {
    const socket = new FakeWebSocket('wss://test');
    socket.binaryType = 'blob';
    new RealtimeConnection(socket);

    expect(socket.binaryType).toBe('arraybuffer');
  });

  it('types and dispatches v2 server events', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);
    const metrics: number[] = [];
    const reasons: string[] = [];
    connection.on('response.metrics', (event) => metrics.push(event.metrics.e2e_ms ?? -1));
    connection.on('input_audio_buffer.committed', (event) => reasons.push(event.turn?.reason ?? 'none'));

    message(socket, { type: 'response.metrics', response_id: 'r', metrics: { e2e_ms: 830, stt_speculative_hit: true } });
    message(socket, {
      type: 'input_audio_buffer.committed',
      transcript: 'Alo?',
      language: 'tr',
      duration: 1.2,
      turn: { reason: 'semantic', endpoint_probability: 0.93, detection_ms: 214 },
    });

    expect(metrics).toEqual([830]);
    expect(reasons).toEqual(['semantic']);
  });

  it('ignores JSON that is not an object', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);
    const listener = vi.fn();
    connection.on('*', listener);

    socket.emit('message', { data: 'null' });
    socket.emit('message', { data: '42' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('client helpers send the v2 events', () => {
    const socket = new FakeWebSocket('wss://test');
    const connection = new RealtimeConnection(socket);

    connection.startFirstMessage();
    connection.setVariables({ customer_name: 'Ayşe' });
    connection.reportPlayback('resp_1', 1234.6);
    connection.createResponse({ input: 'Merhaba' });

    expect(socket.sent.map((s) => JSON.parse(s))).toEqual([
      { type: 'response.create', response: { first_message: true } },
      { type: 'session.update', session: { variables: { customer_name: 'Ayşe' } } },
      { type: 'output_audio_buffer.played', response_id: 'resp_1', played_ms: 1235 },
      { type: 'response.create', response: { input: 'Merhaba' } },
    ]);
  });

  describe('respond()', () => {
    it('ignores a response that was already running (e.g. the greeting)', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      message(socket, { type: 'response.created', response: { id: 'greet' } });

      const promise = connection.respond('Hello');
      const settled = vi.fn();
      promise.then(settled, settled);
      message(socket, { type: 'response.output_text.done', response_id: 'greet', text: 'Merhaba!' });
      message(socket, { type: 'response.done', response_id: 'greet', status: 'cancelled' });
      await Promise.resolve();
      expect(settled).not.toHaveBeenCalled();

      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Hello' } });
      message(socket, { type: 'response.created', response: { id: 'mine' } });
      message(socket, { type: 'response.output_text.done', response_id: 'mine', text: 'Hi there' });
      message(socket, { type: 'response.done', response_id: 'mine', status: 'completed' });

      await expect(promise).resolves.toEqual({ text: 'Hi there', audio: undefined, responseId: 'mine' });
    });

    it('ignores a greeting that starts AFTER respond() was called (agent speaks first on connect)', async () => {
      // Server order for connect({ firstSpeaker: 'agent' }) + respond(): the
      // greeting starts from the first session.update, the user item is
      // echoed, the greeting is superseded, then the answer runs.
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const promise = connection.respond('What are your opening hours?');
      const settled = vi.fn();
      promise.then(settled, settled);

      message(socket, { type: 'response.created', response: { id: 'resp_greeting' } });
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'What are your opening hours?' } });
      message(socket, { type: 'response.output_text.done', response_id: 'resp_greeting', text: 'Hello, I am' });
      message(socket, { type: 'response.done', response_id: 'resp_greeting', status: 'cancelled' });
      await Promise.resolve();
      expect(settled).not.toHaveBeenCalled();

      message(socket, { type: 'response.created', response: { id: 'resp_answer' } });
      message(socket, { type: 'response.output_text.done', response_id: 'resp_answer', text: 'We open at nine.' });
      message(socket, { type: 'response.done', response_id: 'resp_answer', status: 'completed' });
      await expect(promise).resolves.toEqual({ text: 'We open at nine.', audio: undefined, responseId: 'resp_answer' });
    });

    it('a user item echoed for someone else\'s message does not anchor it', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const promise = connection.respond('Mine');
      message(socket, { type: 'conversation.item.created', item: { id: 'item_0', role: 'user', content: 'Other' } });
      message(socket, { type: 'response.created', response: { id: 'other' } });
      message(socket, { type: 'response.done', response_id: 'other', status: 'completed' });
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Mine' } });
      message(socket, { type: 'response.created', response: { id: 'mine' } });
      message(socket, { type: 'response.output_text.done', response_id: 'mine', text: 'ok' });
      message(socket, { type: 'response.done', response_id: 'mine', status: 'completed' });
      await expect(promise).resolves.toMatchObject({ responseId: 'mine', text: 'ok' });
    });

    it('collects binary audio as one base64 payload', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Hello' } });
      message(socket, { type: 'response.created', response: { id: 'r1' } });
      binaryFrame(socket, new Uint8Array([1, 2]));
      binaryFrame(socket, new Uint8Array([3, 4]));
      message(socket, { type: 'response.output_text.done', response_id: 'r1', text: 'ok' });
      message(socket, { type: 'response.done', response_id: 'r1', status: 'completed' });

      const result = await promise;
      expect(result.audio).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'));
    });

    it('is not failed by errors that cannot come from its own request (speech, audio, other events)', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Hello' } });
      message(socket, { type: 'response.created', response: { id: 'r1' } });
      // A failed sentence of speech, noise from the mic, a concurrent session.update: the response goes on.
      for (const code of ['tts_failed', 'invalid_audio', 'transcription_failed', 'audio_buffer_empty', 'generator_locked']) {
        message(socket, { type: 'error', error: { message: `${code} happened`, code } });
      }
      message(socket, { type: 'response.output_text.done', response_id: 'r1', text: 'Still answered' });
      message(socket, { type: 'response.done', response_id: 'r1', status: 'completed' });

      await expect(promise).resolves.toMatchObject({ text: 'Still answered', responseId: 'r1' });
    });

    it('is failed by an error its own request raises', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      message(socket, {
        type: 'error',
        error: { message: 'Set `model` or `agent_key` via session.update before creating a response', code: 'config_missing' },
      });

      await expect(promise).rejects.toThrow('Set `model` or `agent_key`');
    });

    it('rejects a blocked response with its message', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('Hello');
      message(socket, { type: 'conversation.item.created', item: { id: 'item_1', role: 'user', content: 'Hello' } });
      message(socket, { type: 'response.created', response: { id: 'r1' } });
      message(socket, { type: 'response.done', response_id: 'r1', status: 'blocked', error: { message: 'Blocked by guardrail' } });

      await expect(promise).rejects.toThrow('Blocked by guardrail');
    });

    it('rejects an empty message instead of waiting for an echo that never comes', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      await expect(connection.respond('')).rejects.toThrow('non-empty');
      expect(socket.sent).toHaveLength(0);
    });
  });

  describe('connection lifecycle', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Listener sets left behind by a finished `respond()`. */
    function leftoverListeners(connection: RealtimeConnection): number {
      const listeners = (connection as unknown as { listeners: Map<string, Set<unknown>> }).listeners;
      return [...listeners.values()].reduce((total, set) => total + set.size, 0);
    }

    it('is open until the socket closes, then reports the code and reason of the close', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const closes: RealtimeCloseInfo[] = [];
      connection.onClose((info) => closes.push(info));
      expect(connection.closed).toBeNull();

      close(socket, 1011, 'Internal error');

      expect(connection.closed).toEqual({ code: 1011, reason: 'Internal error' });
      expect(closes).toEqual([{ code: 1011, reason: 'Internal error' }]);
    });

    it('reports a close that carries no code, and a repeated close only once', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const listener = vi.fn();
      connection.onClose(listener);

      socket.emit('close', undefined);
      close(socket, 1000, 'late duplicate');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(connection.closed).toEqual({ code: 1005, reason: '' });
    });

    it('includes the transport error that came before the close (a network drop)', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const listener = vi.fn();
      connection.onClose(listener);

      socket.emit('error', { type: 'error', error: new Error('read ECONNRESET') });
      close(socket, 1006);

      expect(listener).toHaveBeenCalledWith({ code: 1006, reason: '', error: expect.objectContaining({ message: 'read ECONNRESET' }) });
    });

    it('stops notifying an unsubscribed listener', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      const kept = vi.fn();
      const dropped = vi.fn();
      connection.onClose(kept);
      connection.onClose(dropped)();

      close(socket, 1000);

      expect(kept).toHaveBeenCalledTimes(1);
      expect(dropped).not.toHaveBeenCalled();
    });

    it('still tells a listener that subscribes after the close (asynchronously), unless it unsubscribes first', async () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      close(socket, 4401, 'Unauthorized');
      const late = vi.fn();
      const withdrawn = vi.fn();

      connection.onClose(late);
      connection.onClose(withdrawn)();
      expect(late).not.toHaveBeenCalled();
      await Promise.resolve();

      expect(late).toHaveBeenCalledWith({ code: 4401, reason: 'Unauthorized' });
      expect(withdrawn).not.toHaveBeenCalled();
    });

    it('says why a send fails after the server closed the socket', () => {
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      close(socket, 4401, 'Unauthorized');

      expect(() => connection.sendAudio(new Uint8Array([1]))).toThrow(
        'Realtime socket is not open (closed: code 4401: Unauthorized)',
      );
    });

    it('rejects a pending respond() when the server closes the socket, instead of timing out 120 s later', async () => {
      vi.useFakeTimers();
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('hi');
      const expectation = expect(promise).rejects.toThrow('Realtime socket closed (code 1011: Internal error)');
      close(socket, 1011, 'Internal error');

      await expectation;
      expect(vi.getTimerCount()).toBe(0);
      expect(leftoverListeners(connection)).toBe(0);
    });

    it('rejects a pending respond() when close() is called, without waiting for the close handshake', async () => {
      vi.useFakeTimers();
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);

      const promise = connection.respond('hi');
      const expectation = expect(promise).rejects.toThrow('Realtime connection closed');
      connection.close();

      await expectation;
      expect(socket.closeCalls).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(leftoverListeners(connection)).toBe(0);
    });

    it('does not leave a timer or listeners behind when respond() is called on a closed socket', async () => {
      vi.useFakeTimers();
      const socket = new FakeWebSocket('wss://test');
      const connection = new RealtimeConnection(socket);
      close(socket, 1006);

      await expect(connection.respond('hi')).rejects.toThrow('Realtime socket is not open (closed: code 1006)');

      expect(vi.getTimerCount()).toBe(0);
      expect(leftoverListeners(connection)).toBe(0);
    });

    it('does not leave a timer behind when respond() fails on a socket that was never open', async () => {
      vi.useFakeTimers();
      const socket = new FakeWebSocket('wss://test');
      socket.readyState = 0; // CONNECTING
      const connection = new RealtimeConnection(socket);

      await expect(connection.respond('hi')).rejects.toThrow('Realtime socket is not open');

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

describe('PCM helpers', () => {
  it('float32ToPcm16 scales and clamps', () => {
    expect(Array.from(float32ToPcm16(new Float32Array([0, 0.5, 1, -1, 3, -3])))).toEqual([
      0, 16384, 32767, -32768, 32767, -32768,
    ]);
  });

  it('pcm16ToFloat32 maps the full range to -1..1', () => {
    expect(Array.from(pcm16ToFloat32(new Int16Array([0, 32767, -32768, -16384])))).toEqual([0, 1, -1, -0.5]);
  });
});

describe('RealtimeSessionsResource', () => {
  it('sends a message into a running session; the idempotency key rides in a header, not the body', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({
      object: 'realtime.session.message', id: 'item_1', session_id: 'rt_1', response_queued: true, replayed: false,
    });
    const resource = new RealtimeSessionsResource(http as unknown as HttpClient);
    const result = await resource.sendMessage('rt 1', {
      content: 'Your report is ready', mode: 'now', label: 'report-bot', idempotencyKey: 'job-42',
    });
    expect(result.response_queued).toBe(true);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/realtime/sessions/rt%201/messages', {
      body: { content: 'Your report is ready', mode: 'now', label: 'report-bot' },
      headers: { 'Idempotency-Key': 'job-42' },
    });
  });

  it('sends no headers without an idempotency key, and is reachable as client.realtime.sessions', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const realtime = new RealtimeResource('https://x.test', 'key', http as unknown as HttpClient);
    await realtime.sessions.sendMessage('rt_1', { content: 'hi', respond: false });
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/realtime/sessions/rt_1/messages', {
      body: { content: 'hi', respond: false },
    });
  });
});
