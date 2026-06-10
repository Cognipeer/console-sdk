/**
 * Realtime API resource — WebSocket sessions for streaming chat with an
 * optional voice round-trip (STT on committed audio, TTS on responses).
 *
 * Works with the browser's native `WebSocket`, Node.js >= 21 (global
 * `WebSocket`), or any compatible implementation (e.g. the `ws` package)
 * passed via `connect({ webSocket })`.
 */

import { HttpClient } from '../http';
import {
  CreateRealtimeModelRequest,
  RealtimeModel,
  RealtimeServerEvent,
  RealtimeSessionUpdate,
  UpdateRealtimeModelRequest,
} from '../types';

/** Structural subset shared by browser WebSocket, Node global, and `ws`. */
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: { code: number; reason: string }) => void): void;
  addEventListener(type: 'error', listener: (event: unknown) => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

export type WebSocketConstructorLike = new (url: string) => WebSocketLike;

export interface RealtimeConnectOptions {
  /** Chat model key (can also be set later via `updateSession`). */
  model?: string;
  /** Custom WebSocket implementation (defaults to the global `WebSocket`). */
  webSocket?: WebSocketConstructorLike;
}

type EventListener = (event: RealtimeServerEvent) => void;

const OPEN = 1;

/**
 * A live realtime connection. Listen with `on(type, cb)` (use `'*'` for all
 * events), or use the high-level `respond()` helper for simple turn-taking.
 */
export class RealtimeConnection {
  private socket: WebSocketLike;
  private listeners = new Map<string, Set<EventListener>>();

  constructor(socket: WebSocketLike) {
    this.socket = socket;
    socket.addEventListener('message', (event: { data: unknown }) => {
      let parsed: RealtimeServerEvent;
      try {
        parsed = JSON.parse(String(event.data)) as RealtimeServerEvent;
      } catch {
        return;
      }
      this.dispatch(parsed);
    });
  }

  /** Subscribe to a server event type, or `'*'` for every event. */
  on(type: string, listener: EventListener): () => void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
    return () => set.delete(listener);
  }

  off(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatch(event: RealtimeServerEvent): void {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    for (const listener of this.listeners.get('*') ?? []) listener(event);
  }

  /** Send a raw client event. */
  send(event: Record<string, unknown>): void {
    if (this.socket.readyState !== OPEN) {
      throw new Error('Realtime socket is not open');
    }
    this.socket.send(JSON.stringify(event));
  }

  /** Update session config (model, instructions, voice, STT/TTS models…). */
  updateSession(session: RealtimeSessionUpdate): void {
    this.send({ type: 'session.update', session });
  }

  /** Append a user/system message to the conversation. */
  createItem(content: string, role: 'user' | 'system' | 'assistant' = 'user'): void {
    this.send({ type: 'conversation.item.create', item: { role, content } });
  }

  /** Append an audio chunk (base64 string or raw bytes) to the input buffer. */
  appendAudio(audio: string | Uint8Array): void {
    const base64 = typeof audio === 'string' ? audio : bytesToBase64(audio);
    this.send({ type: 'input_audio_buffer.append', audio: base64 });
  }

  clearAudio(): void {
    this.send({ type: 'input_audio_buffer.clear' });
  }

  /** Transcribe the buffered audio and append it as a user turn. */
  commitAudio(): void {
    this.send({ type: 'input_audio_buffer.commit' });
  }

  /** Ask the server to generate (and stream) the next assistant response. */
  createResponse(overrides?: { instructions?: string }): void {
    this.send({ type: 'response.create', response: overrides });
  }

  cancelResponse(): void {
    this.send({ type: 'response.cancel' });
  }

  /**
   * High-level helper: send a user message, wait for the full response.
   * Resolves with the final text (and base64 audio when TTS is configured).
   */
  respond(content: string, options?: { timeoutMs?: number }): Promise<{ text: string; audio?: string }> {
    const timeoutMs = options?.timeoutMs ?? 120_000;
    return new Promise((resolve, reject) => {
      let text = '';
      let audio: string | undefined;
      const offs: Array<() => void> = [];
      const cleanup = () => offs.forEach((off) => off());
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Realtime response timed out'));
      }, timeoutMs);

      offs.push(this.on('response.output_text.done', (event) => {
        text = String((event as { text?: unknown }).text ?? '');
      }));
      offs.push(this.on('response.audio.delta', (event) => {
        audio = (audio ?? '') + String((event as { audio?: unknown }).audio ?? '');
      }));
      offs.push(this.on('response.done', (event) => {
        clearTimeout(timer);
        cleanup();
        const status = (event as { status?: string }).status;
        if (status === 'completed' || status === 'cancelled') {
          resolve({ text, audio });
        } else {
          const error = (event as { error?: { message?: string } }).error;
          reject(new Error(error?.message ?? `Response ${status ?? 'failed'}`));
        }
      }));
      offs.push(this.on('error', (event) => {
        const error = (event as { error?: { message?: string } }).error;
        clearTimeout(timer);
        cleanup();
        reject(new Error(error?.message ?? 'Realtime error'));
      }));

      this.createItem(content);
      this.createResponse();
    });
  }

  close(): void {
    this.socket.close();
  }
}

/**
 * Realtime models — named session presets (chat + STT + TTS + voice +
 * instructions bundled under one key). Connect with `?model=<key>`.
 */
export class RealtimeModelsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List realtime models. */
  async list(): Promise<RealtimeModel[]> {
    const res = await this.http.request<{ data: RealtimeModel[] }>(
      'GET',
      '/api/client/v1/realtime/models',
    );
    return res.data ?? [];
  }

  /** Create a realtime model preset. */
  async create(data: CreateRealtimeModelRequest): Promise<RealtimeModel> {
    return this.http.request<RealtimeModel>('POST', '/api/client/v1/realtime/models', { body: data });
  }

  /** Fetch one realtime model by id. */
  async retrieve(modelId: string): Promise<RealtimeModel> {
    return this.http.request<RealtimeModel>(
      'GET',
      `/api/client/v1/realtime/models/${encodeURIComponent(modelId)}`,
    );
  }

  /** Update a realtime model preset. */
  async update(modelId: string, data: UpdateRealtimeModelRequest): Promise<RealtimeModel> {
    return this.http.request<RealtimeModel>(
      'PATCH',
      `/api/client/v1/realtime/models/${encodeURIComponent(modelId)}`,
      { body: data },
    );
  }

  /** Delete a realtime model preset. */
  async delete(modelId: string): Promise<{ deleted: boolean; id: string }> {
    return this.http.request<{ deleted: boolean; id: string }>(
      'DELETE',
      `/api/client/v1/realtime/models/${encodeURIComponent(modelId)}`,
    );
  }
}

export class RealtimeResource {
  private baseURL: string;
  private apiKey: string;

  /** Realtime model presets (CRUD). */
  public models: RealtimeModelsResource;

  constructor(baseURL: string, apiKey: string, http: HttpClient) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.models = new RealtimeModelsResource(http);
  }

  /** Build the websocket URL (useful for custom clients). */
  url(options?: { model?: string }): string {
    const ws = this.baseURL.replace(/^http/i, 'ws');
    const params = new URLSearchParams({ api_key: this.apiKey });
    if (options?.model) params.set('model', options.model);
    return `${ws}/api/client/v1/realtime?${params.toString()}`;
  }

  /**
   * Twilio Media Streams URL for a realtime model — paste into TwiML:
   * `<Connect><Stream url="..."/></Connect>`. The model must have STT, TTS
   * and a voice configured.
   */
  twilioStreamUrl(model: string): string {
    const ws = this.baseURL.replace(/^http/i, 'ws');
    const params = new URLSearchParams({ api_key: this.apiKey, model });
    return `${ws}/api/client/v1/realtime/twilio?${params.toString()}`;
  }

  /** Open a realtime session and resolve once the socket is connected. */
  async connect(options?: RealtimeConnectOptions): Promise<RealtimeConnection> {
    const Ctor = options?.webSocket
      ?? (globalThis as { WebSocket?: WebSocketConstructorLike }).WebSocket;
    if (!Ctor) {
      throw new Error(
        'No WebSocket implementation found. Pass one via connect({ webSocket }), e.g. `import WebSocket from "ws"`.',
      );
    }
    const socket = new Ctor(this.url({ model: options?.model }));
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve());
      socket.addEventListener('error', (event: unknown) => {
        reject(event instanceof Error ? event : new Error('WebSocket connection failed'));
      });
    });
    return new RealtimeConnection(socket);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const globals = globalThis as {
    Buffer?: { from(data: Uint8Array): { toString(encoding: string): string } };
    btoa?: (data: string) => string;
  };
  if (globals.Buffer) {
    return globals.Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (!globals.btoa) throw new Error('No base64 encoder available');
  return globals.btoa(binary);
}
