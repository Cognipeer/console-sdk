/**
 * `connect()` against real sockets: the `ws` package — imported the way an ES
 * module imports it (`ws/wrapper.mjs`) — talking to a stand-in for the Console.
 *
 * Kept apart from `realtime.test.ts` on purpose. `ws` only attaches its
 * `Receiver` / `Sender` statics in its CommonJS entry (`ws/index.js`), and that
 * entry patches the very class the ES wrapper exports: one `require('ws')`
 * anywhere in the process hides the bug these tests guard against. This file
 * never loads it.
 */

import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import type { WebSocketConstructorLike } from './realtime';
import { RealtimeResource } from './realtime';
import { createMockHttp } from '../test/mockHttp';

interface Upgrade {
  url: string | undefined;
  authorization: string | undefined;
  tenantHeader: string | string[] | undefined;
}

/** A Console stand-in: records each upgrade, then decides what the socket gets to hear. */
async function startServer(
  onConnection: (socket: InstanceType<typeof WebSocket>, upgrade: Upgrade) => void,
): Promise<{ baseURL: string; upgrades: Upgrade[]; stop(): Promise<void> }> {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const upgrades: Upgrade[] = [];
  server.on('connection', (socket, request) => {
    const upgrade = {
      url: request.url,
      authorization: request.headers.authorization,
      tenantHeader: request.headers['x-cpr-hdr-tenant'],
    };
    upgrades.push(upgrade);
    onConnection(socket, upgrade);
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseURL: `http://127.0.0.1:${port}`,
    upgrades,
    stop: () => new Promise<void>((resolve) => {
      for (const client of server.clients) client.terminate();
      server.close(() => resolve());
    }),
  };
}

const ws = WebSocket as unknown as WebSocketConstructorLike;

describe('connect() over the real ws package (ES module import)', () => {
  const stops: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));
  });

  it('has the shape that fooled the old detection: no Receiver / Sender statics, but terminate()', () => {
    const statics = WebSocket as unknown as Record<string, unknown>;
    expect(statics.Receiver).toBeUndefined();
    expect(statics.Sender).toBeUndefined();
    expect(typeof WebSocket.prototype.terminate).toBe('function');
  });

  it('sends a full-scope key as an Authorization header, never in the URL, with extra upgrade headers', async () => {
    const server = await startServer((socket) => {
      socket.send(JSON.stringify({ type: 'session.created', session: { id: 'sess_ws' } }));
    });
    stops.push(server.stop);
    const resource = new RealtimeResource(server.baseURL, 'sk-full-scope', createMockHttp());

    const connection = await resource.connect({
      model: 'support-voice',
      webSocket: ws,
      headers: { 'X-Cpr-Hdr-Tenant': 't1' },
    });

    expect(connection.session?.id).toBe('sess_ws');
    expect(server.upgrades).toEqual([{
      url: '/api/client/v1/realtime?model=support-voice',
      authorization: 'Bearer sk-full-scope',
      tenantHeader: 't1',
    }]);
    connection.close();
  });

  it('resolves only once the server has authenticated and created the session; the held session.update still arrives', async () => {
    const received: string[] = [];
    const server = await startServer((socket) => {
      socket.on('message', (data) => received.push(data.toString()));
      // Authenticating takes a moment; what the client sends meanwhile is held, not lost.
      setTimeout(() => {
        socket.send(JSON.stringify({ type: 'session.created', session: { id: 'sess_late' } }));
      }, 60);
    });
    stops.push(server.stop);
    const resource = new RealtimeResource(server.baseURL, 'sk-test', createMockHttp());

    const started = Date.now();
    const connection = await resource.connect({ webSocket: ws, firstSpeaker: 'agent' });

    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(connection.session?.id).toBe('sess_late');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received.map((text) => JSON.parse(text))).toEqual([
      { type: 'session.update', session: { first_speaker: 'agent' } },
    ]);
    connection.close();
  });

  it('delivers the frames sent in the same tick as session.created to listeners attached after connect()', async () => {
    // What the Console does for a first_speaker: 'agent' session on a text preset: the session, the echo of the
    // initial update and the whole greeting, back to back — typically one socket read on the client.
    const server = await startServer((socket) => {
      for (const event of [
        { type: 'session.created', session: { id: 'sess_burst' } },
        { type: 'session.updated', session: { id: 'sess_burst' } },
        { type: 'response.created', response: { id: 'greeting' } },
        { type: 'response.output_text.done', response_id: 'greeting', text: 'Merhaba' },
        { type: 'response.done', response_id: 'greeting', status: 'completed' },
      ]) socket.send(JSON.stringify(event));
    });
    stops.push(server.stop);
    const resource = new RealtimeResource(server.baseURL, 'sk-test', createMockHttp());

    const connection = await resource.connect({ webSocket: ws });
    const seen: string[] = [];
    connection.on('*', (event) => seen.push(event.type));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(seen).toEqual(['session.updated', 'response.created', 'response.output_text.done', 'response.done']);
    connection.close();
  });

  it('rejects with the server\'s reason and the close when the key is refused after the upgrade', async () => {
    const server = await startServer((socket) => {
      socket.send(JSON.stringify({ type: 'error', error: { message: 'Invalid API token', code: 'unauthorized' } }));
      socket.close(4401, 'Unauthorized');
    });
    stops.push(server.stop);
    const resource = new RealtimeResource(server.baseURL, 'sk-wrong', createMockHttp());

    await expect(resource.connect({ webSocket: ws })).rejects.toThrow(
      'Realtime connection refused: Invalid API token (unauthorized)',
    );
  });

  it('rejects when the server closes without a word, and tells a pending respond() when it drops later', async () => {
    const silent = await startServer((socket) => socket.close(1011, 'Internal error'));
    stops.push(silent.stop);
    const refused = new RealtimeResource(silent.baseURL, 'sk-test', createMockHttp());
    await expect(refused.connect({ webSocket: ws })).rejects.toThrow(
      'closed before the session was created (code 1011: Internal error)',
    );

    const flaky = await startServer((socket) => {
      socket.send(JSON.stringify({ type: 'session.created', session: { id: 'sess_flaky' } }));
      socket.on('message', () => socket.close(1011, 'Internal error'));
    });
    stops.push(flaky.stop);
    const resource = new RealtimeResource(flaky.baseURL, 'sk-test', createMockHttp());
    const connection = await resource.connect({ webSocket: ws });
    const closed = new Promise((resolve) => connection.onClose(resolve));

    await expect(connection.respond('hi', { timeoutMs: 10_000 })).rejects.toThrow(
      'Realtime socket closed (code 1011: Internal error)',
    );
    await expect(closed).resolves.toMatchObject({ code: 1011, reason: 'Internal error' });
    expect(connection.closed).toMatchObject({ code: 1011 });
  });

  it('rejects with the underlying error when nothing is listening', async () => {
    const server = await startServer(() => undefined);
    const baseURL = server.baseURL;
    await server.stop();
    const resource = new RealtimeResource(baseURL, 'sk-test', createMockHttp());

    await expect(resource.connect({ webSocket: ws })).rejects.toThrow(/ECONNREFUSED/);
  });
});
