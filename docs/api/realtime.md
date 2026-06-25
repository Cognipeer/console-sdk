# Realtime API

WebSocket sessions for streaming chat with an optional voice round-trip — speech-to-text on committed audio, text-to-speech on responses. The realtime surface lives on `client.realtime`.

It works with the browser's native `WebSocket`, Node.js ≥ 21 (global `WebSocket`), or any compatible implementation (e.g. the `ws` package) passed via `connect({ webSocket })`.

## Overview

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });
```

## Connect and take a turn

The high-level `respond()` helper sends a user message and resolves with the full assistant response.

```typescript
const conn = await client.realtime.connect({ model: 'gpt-4o-mini' });

const { text, audio } = await conn.respond('Give me a haiku about the sea.');
console.log(text);

conn.close();
```

::: tip Generator is locked at session start
The response generator — a `model` or an `agent` — is chosen when the session opens. You may still set it via `updateSession` before the first response, but it **locks once the conversation starts**. Pass `{ agent: 'sales-assistant' }` instead of `{ model }` to have an agent generate responses.
:::

## Event-driven usage

For full control, listen to server events directly. Use `'*'` to subscribe to every event.

```typescript
const conn = await client.realtime.connect({ model: 'gpt-4o-mini' });

conn.on('response.output_text.delta', (e) => process.stdout.write(e.delta));
conn.on('response.done', () => conn.close());

conn.createItem('Stream me a short story.');
conn.createResponse();
```

### Connection methods

| Method | Description |
| --- | --- |
| `conn.on(type, cb)` / `conn.off(type, cb)` | Subscribe / unsubscribe (`'*'` = all events) |
| `conn.send(event)` | Send a raw client event |
| `conn.updateSession(session)` | Update model, instructions, voice, STT/TTS models |
| `conn.createItem(content, role?)` | Append a conversation message |
| `conn.appendAudio(audio)` / `clearAudio()` / `commitAudio()` | Stream input audio; commit to transcribe as a user turn |
| `conn.createResponse(overrides?)` / `cancelResponse()` | Generate / cancel the next assistant response |
| `conn.respond(content, options?)` | High-level: send a message, await the full response |
| `conn.close()` | Close the socket |

## Voice round-trip

Configure STT, TTS, and a voice (on the session or a realtime model preset) to get audio back. `respond()` returns base64 `audio` alongside `text`; in event mode listen for `response.audio.delta`.

```typescript
const conn = await client.realtime.connect({ model: 'voice-assistant' });
conn.appendAudio(micChunkBase64);
conn.commitAudio();      // transcribe the buffered audio as a user turn
conn.createResponse();   // assistant replies with text + synthesized audio
```

## Node.js without a global WebSocket

```typescript
import WebSocket from 'ws';

const conn = await client.realtime.connect({
  model: 'gpt-4o-mini',
  webSocket: WebSocket,
});
```

## Realtime model presets

A realtime model bundles chat + STT + TTS + voice + instructions under one key; connect with `?model=<key>`. Manage presets via `client.realtime.models`.

```typescript
const models = await client.realtime.models.list();
const preset = await client.realtime.models.create({ /* ... */ });
await client.realtime.models.update(preset.id, { /* ... */ });
await client.realtime.models.delete(preset.id);
```

## Low-level URLs

```typescript
// Raw WebSocket URL (for custom clients):
const wsUrl = client.realtime.url({ model: 'gpt-4o-mini' });

// Twilio Media Streams URL — paste into TwiML:
//   <Connect><Stream url="..."/></Connect>
// The model must have STT, TTS, and a voice configured.
const twilioUrl = client.realtime.twilioStreamUrl('voice-assistant');
```

## Methods

| Method | Transport | Description |
| --- | --- | --- |
| `realtime.connect(options?)` | WS | Open a session, resolve a `RealtimeConnection` |
| `realtime.url(options?)` | — | Build the raw WebSocket URL |
| `realtime.twilioStreamUrl(model)` | — | Twilio Media Streams URL |
| `realtime.models.list()` | `GET /api/client/v1/realtime/models` | List presets |
| `realtime.models.create(data)` | `POST /api/client/v1/realtime/models` | Create a preset |
| `realtime.models.retrieve(id)` | `GET /api/client/v1/realtime/models/:id` | Fetch a preset |
| `realtime.models.update(id, data)` | `PATCH /api/client/v1/realtime/models/:id` | Update a preset |
| `realtime.models.delete(id)` | `DELETE /api/client/v1/realtime/models/:id` | Delete a preset |
