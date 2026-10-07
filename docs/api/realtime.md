# Realtime API

Low-latency voice and chat sessions over one WebSocket. You stream audio in, and the Console
detects when the user has finished speaking, transcribes, runs your model or agent, and streams
synthesized speech back. It also places and answers phone calls through Twilio. The realtime
surface lives on `client.realtime`.

```
 mic ─▶ pcm16 / G.711 frames ─▶ Silero VAD ─▶ Smart Turn (semantic end-of-turn)
                                     │ pause            │ turn ended
                                     └─▶ speculative STT ──▶ transcript
                                                              │
 speaker ◀─ PCM frames ◀─ streaming TTS ◀─ clause chunker ◀─ streaming LLM / agent
```

The pipeline is chained (STT → LLM/agent → TTS), not speech-to-speech, so any chat model or
Console agent can be the brain. The target is a p50 of **≤ 900 ms** from the end of the user's speech to
the first audio byte, with `gpt-4o-mini-transcribe`, a fast chat model and OpenAI TTS (`pcm`).

It works with the browser's native `WebSocket`, Node.js ≥ 22 (global `WebSocket`), Bun, or any
compatible implementation (e.g. the [`ws`](https://github.com/websockets/ws) package) passed
via `connect({ webSocket })`.

::: info Defaults
Out of the box a session takes `pcm16` @ 24 kHz in, sends `pcm16` @ 24 kHz out, detects turns with
`semantic_vad`, and runs an agent's **published** version. Audio is raw `pcm16` or G.711 in both
directions — there are no container formats (webm, mp3, wav…). SDK 3.0 requires a Console with the
realtime voice engine; see the [changelog](../../CHANGELOG.md) for what was removed.
:::

## Quick start: text

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });

const conn = await client.realtime.connect({ model: 'gpt-4o-mini' });
const { text } = await conn.respond('Give me a haiku about the sea.');
console.log(text);
conn.close();
```

`model` is a realtime model (preset) key or a raw chat model key. Pass `{ agent: 'sales-assistant' }`
to have a Console agent generate the responses instead.

::: tip The generator locks when the session starts
You choose the response generator (a `model` or an `agent`) when you open the session. You can still change it
with `updateSession` before the first response, but **it locks once the conversation starts**:
later changes fail with `generator_locked`.
:::

## Quick start: voice (Node.js)

The example streams 24 kHz `pcm16` in and plays it back. Server turn detection decides when the user
has finished speaking, so you never call `commit`. The `session` fields below are the defaults, spelled
out.

```typescript
import WebSocket from 'ws';
import { createReadStream, createWriteStream } from 'node:fs';

const conn = await client.realtime.connect({
  model: 'support-voice',               // preset with STT + TTS (+ voice)
  webSocket: WebSocket,                 // sends the API key as an Authorization header
  session: {
    input_audio_format: 'pcm16',        // s16le mono…
    input_audio_sample_rate: 24000,     // …at 24 kHz
    output_audio_format: 'pcm16',
    output_audio_sample_rate: 24000,
    audio_transport: 'binary',          // audio out as binary frames (no base64)
    turn_detection: { type: 'semantic_vad', eagerness: 'auto' },
  },
  firstSpeaker: 'agent',
  firstMessage: { mode: 'static', text: 'Merhaba {{customer_name}}, size nasıl yardımcı olabilirim?' },
  variables: { customer_name: 'Ayşe' },
});

const speaker = createWriteStream('reply.pcm');
conn.onAudio((chunk) => speaker.write(Buffer.from(chunk.bytes)));     // chunk.pcm = Int16Array
conn.on('output_audio_buffer.cleared', () => { /* barge-in: drop queued playback */ });
conn.on('input_audio_buffer.committed', (e) => console.log('user:', e.transcript, e.turn));
conn.on('response.audio_transcript.delta', (e) => console.log('agent:', e.delta));
conn.on('response.metrics', (e) => console.log('e2e ms:', e.metrics.e2e_ms));

// 100 ms frames: 24000 samples/s × 2 bytes × 0.1 s = 4800 bytes
for await (const frame of createReadStream('question.pcm', { highWaterMark: 4800 })) {
  conn.sendAudio(frame as Buffer);
}
// Turn detection runs on the audio clock, not on wall time: a recording that stops at the last word
// never ends its turn. Finish it with ~2 s of silence (`max_turn_silence_ms` is 1800 by default).
for (let i = 0; i < 20; i++) conn.sendAudio(Buffer.alloc(4800));
```

## Quick start: voice (browser)

```typescript
import { pcm16ToFloat32 } from '@cognipeer/console-sdk';

const conn = await client.realtime.connect({     // browsers use ?api_key= — see Authentication
  model: 'support-voice',
  session: { input_audio_format: 'pcm16', output_audio_format: 'pcm16', audio_transport: 'binary' },
});

// Capture: AudioContext at 24 kHz + an AudioWorklet that posts Float32 frames.
const ctx = new AudioContext({ sampleRate: 24000 });
const mic = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
});
// The worklet gets 128 samples (5 ms) per call: gather them into 100 ms frames (2400 samples at 24 kHz)
// before posting, so the socket carries ~10 messages a second, not ~190.
await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([`
  registerProcessor('tap', class extends AudioWorkletProcessor {
    frame = new Float32Array(2400);
    filled = 0;
    process([input]) {
      for (const sample of input[0] ?? []) {
        this.frame[this.filled++] = sample;
        if (this.filled === this.frame.length) {
          this.port.postMessage(this.frame.slice());
          this.filled = 0;
        }
      }
      return true;
    }
  });`], { type: 'text/javascript' })));
const tap = new AudioWorkletNode(ctx, 'tap');
tap.port.onmessage = (e) => conn.sendAudio(e.data as Float32Array);   // Float32 → pcm16, binary frame
ctx.createMediaStreamSource(mic).connect(tap);

// Playback: gapless scheduling, flushed on barge-in.
let playhead = 0;
const sources = new Set<AudioBufferSourceNode>();
conn.onAudio(({ pcm, sampleRate }) => {
  const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
  buffer.copyToChannel(pcm16ToFloat32(pcm), 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  playhead = Math.max(playhead, ctx.currentTime);
  source.start(playhead);
  playhead += buffer.duration;
  sources.add(source);
  source.onended = () => sources.delete(source);    // finished audio is not kept alive
});
conn.on('output_audio_buffer.cleared', () => {
  sources.forEach((s) => s.stop());
  sources.clear();
  playhead = 0;
});
```

## Authentication

`connect()` picks how to send the API key (`auth: 'auto'`, the default):

| Runtime | How the key is sent |
| --- | --- |
| `ws` package (`connect({ webSocket: WebSocket })`), imported with `import` or `require` | `Authorization: Bearer` upgrade header |
| Node.js ≥ 22 global `WebSocket`, Bun | `Authorization: Bearer` upgrade header |
| Browsers, other implementations | `?api_key=` query parameter |

The server only accepts `?api_key=` for tokens **scoped to the realtime service**, because a URL
leaks more easily than a header (proxy logs, browser history). A full-scope tenant token must use the
header, or the upgrade is rejected. In a browser, use a realtime-scoped token and never your
full-scope key.

Force a mode with `auth: 'header'` or `auth: 'query'`. Extra upgrade headers (for example
`X-Cpr-Hdr-*` runtime-context headers) go in `headers`. Only header-capable runtimes can send them;
anywhere else `connect()` throws instead of silently dropping them.

**Permissions.** A session runs billed STT, model and TTS calls, so it needs **write** access to the
realtime service: a token (or member) that can only *read* realtime is refused. A **preset** session
needs nothing more, because the preset's author chose its agent and model. Choosing your own is the
agents / chat API again and needs that permission as well: `connect({ agent })` needs `agents` write,
`connect({ model: '<chat model key>' })` needs `models` write, and so does a `session.update` that
switches `model`, `agent_key` or `agent_version` mid-session. A token scoped to the realtime service
alone — the kind a browser must use — can therefore run presets, not `{ agent }` or a raw model key.
A refused `connect()` rejects with `unauthorized` (close code 4401) and the missing permission in the
message; a refused mid-session `session.update` raises a `forbidden` error event and the session goes
on.

## Connecting and closing

`connect()` resolves once the Console has **created the session** (`session.created`), not when the
socket opens: the upgrade is accepted first, and the key, the preset and the agent are checked
afterwards. A refused session therefore shows up as a rejection with the server's reason, before you
stream a single audio frame:

```typescript
try {
  const conn = await client.realtime.connect({ model: 'support-voice', timeoutMs: 10_000 });
} catch (error) {
  // Realtime connection refused: The `?api_key=` query parameter requires a token scoped to the
  //   realtime service; use an Authorization header for unscoped tokens (unauthorized)
  // WebSocket closed before the session was created (code 1011: Internal error)
  // Realtime session not ready after 10000 ms (the socket is open, the server has not created the session)
}
```

It rejects when the key is invalid or unscoped, the preset is disabled, the agent is unknown, the
connection cannot be made, or the session is not ready within `timeoutMs` (default 30 s, `0` waits
forever). The initial `session.update` goes out as soon as the socket opens; the server holds it
while it authenticates. (A custom client on a raw WebSocket should wait for `session.created` before
it streams audio in bulk: until the server has authenticated the socket it holds at most 500 messages or
4 MB and then closes with `1009`.)

`session.created` has been handled by the time `connect()` resolves, so read it from `conn.session`
rather than listening for it. Whatever the server sends right behind it — the echo of your initial
`session.update`, a text greeting — still reaches the listeners you attach straight after
`await connect()`.

A close after that is not silent either:

```typescript
conn.onClose(({ code, reason, error }) => {
  // 4401 unauthorized, 4402 license required, 1013 server busy, 1009 too much data,
  // 1011 server error, 1006 dropped (error = the transport error)…
});
conn.closed;   // null while open, { code, reason } once closed (also after `conn.close()`)
```

A pending `respond()` rejects as soon as the socket closes (or `conn.close()` is called) instead of
waiting out its timeout, and a send on a closed connection throws
`Realtime socket is not open (closed: code 4401: Unauthorized)`.

**Why a connection is refused.** Before the session exists the server sends an `error` event and
closes the socket; `connect()` rejects with that event's message and code. Mid-session errors never
close the socket.

| Close code | Error `code` | Meaning |
| --- | --- | --- |
| `4401` | `unauthorized` | Missing or invalid key, a full-scope token in `?api_key=`, a missing permission (see [Permissions](#authentication)), a disabled preset, an unknown agent. |
| `4402` | `license_required` | The tenant has no active ENTERPRISE license — realtime is an enterprise feature. |
| `1013` | `server_busy` | The node is at its live-session cap. Try again shortly. |
| `1009` | — | Too much data: a frame over the server's limit (1 MB by default), or too much sent before the session was ready. |
| `1011` | — | Server error. |

Two errors reach a **running** session and leave it open: `forbidden` (a `session.update` switched
agent, model or agent version without the permission to) and `event_too_large` (a non-audio event
over 256 KB was dropped; audio frames are not affected).

## Session configuration

`connect({ session })` sends the initial `session.update`, and `conn.updateSession(patch)` changes it
later. Fields are snake_case only.

| Field | Type | Description |
| --- | --- | --- |
| `model` / `agent_key` | `string` | Response generator. Locks after the first response. |
| `agent_version` | `'published' \| 'draft' \| number` | Agent sessions: version to run (default `published` — for presets and `{ agent }` sessions alike — falling back to the draft when nothing is published). |
| `instructions` | `string` | System prompt. Supports `{{variables}}`. |
| `temperature`, `max_output_tokens` | `number` | Chat model sampling. |
| `input_audio_format` | `pcm16 \| g711_ulaw \| g711_alaw` | Input audio (default `pcm16`). |
| `input_audio_sample_rate` | `8000 \| 16000 \| 24000 \| 48000` | `pcm16` input rate (default 24000). |
| `output_audio_format` | `pcm16 \| g711_ulaw \| g711_alaw` | Output audio (default `pcm16`). |
| `output_audio_sample_rate` | `8000 \| 16000 \| 24000 \| 48000` | `pcm16` output rate (default 24000). |
| `audio_transport` | `'json' \| 'binary'` | How output audio is sent: base64 in JSON (default) or binary frames. |
| `turn_detection` | `object \| null` | Server turn detection (default `{ type: 'semantic_vad' }`); `null` = manual commit. See [Turn detection](#turn-detection). |
| `input_audio_transcription` | `{ model, language?, prompt? }` | STT model, language hint and prompt. |
| `transcription_model` | `string` | Shorthand for `input_audio_transcription.model`. |
| `stt_mode` | `'batch' \| 'streaming'` | `batch`: speculative transcription on pauses (default; a speculation the user talks over is aborted). `streaming` (experimental): one streaming STT session per utterance with partial transcripts in `conversation.item.input_audio_transcription.delta` — OpenAI STT models only; other providers, or any stream failure, fall back to `batch` for that turn. |
| `tts_model`, `voice` | `string` | TTS model key; voice id (provider default when omitted). |
| `first_speaker` | `'agent' \| 'user'` | Who speaks first. See [First message](#first-message-and-variables). |
| `first_message` | `{ mode, text?, instructions?, interruptible? }` | What the agent says first. |
| `wait_for_user_ms` | `number` | `first_speaker: 'user'`: greet anyway after this much silence. |
| `variables` | `Record<string, string>` | `{{name}}` template values. |
| `tool_status_message` | `string` | Agent sessions: filler line spoken when the agent starts calling tools. |
| `tool_wait_audio` | `boolean` | Agent sessions: play a soft generated waiting sound while the agent runs tools, until the answer audio starts (default `false`). Combines with `tool_status_message` (the line is spoken first). Useful on phone calls. |
| `runtime_context` | `RuntimeContext \| null` | Downstream auth/data for agent tool calls. Re-send it to refresh tokens. |

The server echoes the effective config in `session.created` / `session.updated`. Read the latest
copy from `conn.session`. The echo differs from the update in a few places:

- `turn_detection` is the *effective* setting with every field present (`null` = server default);
  it is `null` for manual commit.
- `input_audio_sample_rate` / `output_audio_sample_rate` are always set (8000 for G.711).
- `variable_keys` lists the names of the session's `{{variables}}`; the values are never echoed.
- `audio_transport` is `binary` only when the connection can carry binary frames.
- `degraded` is `null`, or why server turn detection runs below full quality, e.g.
  `"turn: silence-only endpointing (model still loading)"` (energy VAD / silence-only endpointing
  while the ONNX models load or when they are unavailable). The server sends a fresh
  `session.updated` whenever it changes, so a client can show a hint and clear it once the models
  are in.

## Audio formats

| Format | Input | Output | Notes |
| --- | --- | --- | --- |
| `pcm16` (default) | ✅ binary or base64 | ✅ ~100 ms frames | Signed 16-bit **little-endian** mono at `*_audio_sample_rate` (8000 / 16000 / 24000 / 48000; default 24000). |
| `g711_ulaw` | ✅ | ✅ | 8 kHz μ-law (telephony). |
| `g711_alaw` | ✅ | ✅ | 8 kHz A-law. |

No other formats are accepted: encode or decode containers (webm, wav, mp3…) on your side.

**Input.** `conn.sendAudio(bytes)` sends a **binary frame**: no base64 and no JSON envelope. It
accepts `Buffer`, `Uint8Array`, `ArrayBuffer` and any typed array. An `Int16Array` is sent as s16le,
and a `Float32Array` (Web Audio samples, −1..1) is converted to `pcm16` first. `conn.appendAudio(...)`
sends the same bytes base64-encoded in an `input_audio_buffer.append` JSON event. Send 20–100 ms
frames: smaller frames add overhead, and larger ones delay VAD.

**Output.** `conn.onAudio(cb)` delivers decoded chunks from either transport:

```typescript
interface RealtimeAudioChunk {
  responseId: string | null;
  format: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  sampleRate: number;
  contentType: string;         // e.g. 'audio/L16;rate=24000'
  bytes: Uint8Array;           // raw bytes as received
  pcm: Int16Array;             // decoded samples (G.711 decoded too)
  text?: string;               // chunk text, on its first frame
  transport: 'json' | 'binary';
}
```

Binary frames do not carry a response id or format. The SDK attributes each one to the latest
`response.created` / `response.audio_transcript.delta`, and decodes it with the `output_audio_format` /
`output_audio_sample_rate` the session had when **that response started** — the server fixes both per
response, so a `session.update` mid-response only takes effect from the next one. `pcm16ToFloat32` and
`float32ToPcm16` are exported for Web Audio.

## Turn detection

The server decides when the user's turn ends. The default is `semantic_vad`; `null` switches to
manual commit (push-to-talk).

| `type` | How a turn ends |
| --- | --- |
| `semantic_vad` | Silero VAD finds a pause (`silence_duration_ms`), then the **Smart Turn** model judges whether the utterance is complete. "I'd like to book a…" keeps listening; "Book it for Friday." answers right away. After `max_turn_silence_ms` of silence the turn ends regardless. |
| `server_vad` | VAD plus a fixed silence (`silence_duration_ms`, default 600 ms). |
| `null` | Manual: call `commitAudio()` (push-to-talk). |

| Parameter | Default | Description |
| --- | --- | --- |
| `threshold` | `0.5` | VAD speech probability threshold. |
| `prefix_padding_ms` | `300` | Audio kept before speech onset. |
| `min_speech_ms` | `150` | Speech must last this long to count as speech. |
| `silence_duration_ms` | `600` / `200` | `server_vad`: silence that ends the turn. `semantic_vad`: pause before the first semantic check. |
| `max_turn_silence_ms` | `1800` | `semantic_vad`: the turn ends anyway after this much silence. |
| `semantic_threshold` | `0.5` | Smart Turn end-of-turn probability threshold. |
| `eagerness` | `auto` | `low` waits longer, `high` answers sooner. It scales `max_turn_silence_ms` and `semantic_threshold`. |
| `interrupt_min_ms` | `400` | Continuous speech required before a barge-in cancels the response. |
| `max_utterance_ms` | `30000` | Hard cap on one utterance (`reason: 'max_duration'`). |
| `create_response` | `true` | Respond automatically when a turn ends. |
| `interrupt_response` | `true` | Let a barge-in cancel the in-flight response. |

**Speculative STT.** When the user pauses, the server starts transcribing straight away. If the turn
then ends, that transcript is reused (`stt_speculative_hit: true`); if the user keeps talking, it is
discarded.

**Barge-in.** If the user starts talking while the agent speaks, you get
`input_audio_buffer.speech_started` (duck playback). Once the speech lasts `interrupt_min_ms`, the server
cancels the response and sends **`output_audio_buffer.cleared`**. Flush queued playback immediately
when that arrives. A cough or a short "mm-hm" never cancels. The cancelled response ends with
`response.done { status: 'cancelled', interrupted: true, played_ms }`.

**Playback progress.** Optionally call `conn.reportPlayback(responseId, playedMs)`
(`output_audio_buffer.played`) every few hundred ms while playing. On an interruption, the assistant's
history entry is then cut down to roughly what the user actually heard.

## First message and variables

| `first_speaker` | Behaviour |
| --- | --- |
| `agent` | The first message starts as soon as the first `session.update` is applied, or on `conn.startFirstMessage()`. |
| `user` | The agent waits for the user's first turn ("Alo?"), or for `wait_for_user_ms` of silence, then runs the first-message logic with the user's words as context. A "Hello?" gets a greeting rather than a generic reply. |

| `first_message.mode` | What is said |
| --- | --- |
| `none` | Nothing; the agent waits for the user. |
| `static` | `text`, verbatim after `{{variables}}` are filled. |
| `generate` | The agent receives `instructions` as a hidden user turn, plus the caller's first words when they spoke first (e.g. `[Görüşme başladı — arayan: "Alo?"]`), and writes the greeting itself. Hidden turns stay in history but are never echoed as `conversation.item.created`. |

`interruptible: false` protects the greeting from barge-in.

`connect()` merges `session`, `runtimeContext`, `variables`, `firstSpeaker` and `firstMessage` into
**one** initial `session.update`, so the greeting already sees all of them. Without any of those options,
`connect()` sends no update. If your preset says `first_speaker: 'agent'`, call
`conn.startFirstMessage()` (or send any `updateSession`) to start the greeting.

**Variables.** `{{name}}` placeholders in `instructions` and `first_message` are filled from
`variables`. Agents also receive the values as `runtime_context.metadata.variables`. Set them with
`connect({ variables })`, `conn.setVariables({...})`, `calls.create({ variables })`, or the `variables`
query parameter (JSON, for custom clients; avoid personal data in URLs).

```typescript
const conn = await client.realtime.connect({
  agent: 'collections-agent',
  variables: { customer_name: 'Ayşe', amount_due: '1.250 TL' },
  firstSpeaker: 'agent',
  firstMessage: {
    mode: 'generate',
    instructions: 'Görüşme başladı. Kendini tanıt ve {{customer_name}} ile konuştuğunu doğrula.',
  },
});
```

## Client events

| Event | Helper | Description |
| --- | --- | --- |
| *binary frame* | `sendAudio(bytes)` | Raw input audio in `input_audio_format` (`pcm16` / G.711). |
| `session.update` | `updateSession(patch)`, `setVariables(vars)` | Change session config. |
| `conversation.item.create` | `createItem(content, role?)` | Append a user/system/assistant message. |
| `input_audio_buffer.append` | `appendAudio(audio)` | Base64 input audio in `input_audio_format`. |
| `input_audio_buffer.commit` | `commitAudio()` | Manual end of turn: transcribe the buffer as a user turn. |
| `input_audio_buffer.clear` | `clearAudio()` | Drop buffered input. |
| `response.create` | `createResponse({ instructions?, input?, first_message? })`, `startFirstMessage()` | Generate a response. `input` appends a user message first; `first_message: true` runs the first-message logic. |
| `response.cancel` | `cancelResponse()` | Stop the in-flight response. |
| `output_audio_buffer.played` | `reportPlayback(responseId, playedMs)` | Optional playback progress. |

## Server events

Subscribe with `conn.on(type, cb)`. The callback is typed from `RealtimeServerEventMap`; use `'*'` for
every event.

| Event | Key fields | When |
| --- | --- | --- |
| `session.created` / `session.updated` | `session` | On connect / after each `session.update`, and whenever `session.degraded` changes. |
| `session.ended` | `reason` (`call_ended`…) | The server ends the session (e.g. the phone call hung up); the socket closes next. |
| `conversation.item.created` | `item { id, role, content }` | A message was added. |
| `input_audio_buffer.speech_started` | `audio_start_ms`, `item_id` | VAD heard speech. During playback, duck it. |
| `input_audio_buffer.speech_stopped` | `audio_end_ms`, `item_id` | The turn ended: the end-of-turn decision is made and the transcript follows in `input_audio_buffer.committed`. Not sent for a pause inside a turn. |
| `input_audio_buffer.committed` | `transcript`, `language`, `duration`, `item_id`, `turn { reason, endpoint_probability, detection_ms }` | A user turn ended and was transcribed. `reason`: `semantic`, `silence`, `max_silence`, `max_duration`, `manual`. |
| `input_audio_buffer.cleared` | — | After `clearAudio()`. |
| `conversation.item.input_audio_transcription.delta` | `item_id`, `delta` | Partial transcript (`stt_mode: 'streaming'`). |
| `response.created` | `response.id` | A response started. |
| `response.output_text.delta` / `.done` | `delta` / `text` | Streamed text / final text. |
| `response.tool_call.started` / `.completed` | `tool`, `call_id`, `message` / `status` | Agent tool calls. |
| `response.audio_transcript.delta` | `response_id`, `delta` | Sentence about to be spoken. With binary transport it precedes the sentence's binary frames. |
| `response.audio.delta` | `audio` (base64), `format`, `sample_rate`, `content_type`, `text` (first frame of a sentence) | Output audio (JSON transport). Prefer `onAudio`. |
| `response.audio.done` | `response_id` | All audio for the response was sent. |
| `output_audio_buffer.cleared` | `response_id` | **Barge-in: flush queued playback now.** |
| `response.metrics` | `metrics` | Per-turn latency, see below. |
| `response.done` | `status` (`completed`, `cancelled`, `failed`, `blocked`), `usage`, `error`, `interrupted`, `played_ms` | Response finished. |
| `error` | `error { message, code }` | Request-level error (`invalid_audio`, `generator_locked`, `config_missing`, `forbidden`, `event_too_large`…). While the session is being set up it carries the reason for a refusal (`unauthorized`, `license_required`, `server_busy`) and a close follows. |

## Latency metrics

Each answered user turn emits `response.metrics`. The same numbers are stored with the session
(Dashboard → Realtime → Sessions, turns table), and the dashboard shows p50/p95 per session.

| Metric | Meaning |
| --- | --- |
| `turn_detection_ms` | Last speech → end-of-turn decision (VAD pause + Smart Turn). |
| `stt_ms` | Transcription time that was not hidden by speculation. |
| `stt_speculative_hit` | The speculative transcript was reused. |
| `llm_first_token_ms` | Request → first token from the model/agent. Absent when no model ran (a `static` first message). |
| `llm_total_ms` | Full generation time. Absent when no model ran. |
| `tts_first_byte_ms` | First clause → first synthesized audio byte. |
| **`e2e_ms`** | **End of user speech (VAD) → first output audio byte sent.** This is the latency the user feels. Only present when the turn followed detected user speech. |
| `total_ms` | End of user speech → the response is done, including the rest of the audio. Only present when the turn followed detected user speech. |

Every field is optional. `e2e_ms` and `total_ms` are measured from the user's speech end, so a
response that no detected speech preceded — the agent's own greeting, a typed `createResponse({ input })`,
a response you create yourself after a push-to-talk `commitAudio()` — carries neither (a number
measured from the response start would skew the session and dashboard percentiles); the same turns
have no `turn_detection_ms` / `stt_*` either, since no turn was detected or transcribed for them. The
`llm_*` fields are absent when no model ran (a `static` first message). Read the values as
`metrics.e2e_ms ?? null`, not as always there.

```typescript
conn.on('response.metrics', ({ metrics }) => {
  console.log(`e2e ${metrics.e2e_ms} ms (turn ${metrics.turn_detection_ms}, stt ${metrics.stt_ms}, ` +
    `llm ${metrics.llm_first_token_ms}, tts ${metrics.tts_first_byte_ms})`);
});
```

To keep `e2e_ms` low, use a fast chat model, an STT model with good speculation (`gpt-4o-mini-transcribe`), and
`eagerness: 'high'` for snappy back-and-forth.

## Telephony

### Calls API

The Console can dial out through the preset's Twilio connection and run the conversation
server-side. Your code only places and observes the call.

```typescript
const call = await client.realtime.calls.create({
  to: '+905551234567',
  model: 'collections-voice',            // preset with STT, TTS and a telephony connection
  variables: { customer_name: 'Ayşe' },
  first_speaker: 'user',                 // outbound default: wait for "Alo?"
  first_message: { mode: 'generate', instructions: 'Kendini tanıt, {{customer_name}} ile görüştüğünü doğrula.' },
  machine_detection: true,
  connection: 'twilio-main',             // optional: which telephony connection dials out
  ring_timeout_sec: 30,                  // optional: Twilio Timeout, 5–240
});
// → { id, object: 'realtime.call', session_id, call_sid, status: 'queued', direction: 'outbound',
//     session_status: 'pending', started_at, … }

const state = await client.realtime.calls.get(call.session_id);  // status, answered_by, duration_sec…
// A lost Twilio status callback leaves a call "ringing" / "in-progress": ask Twilio for the live state.
const live = await client.realtime.calls.get(call.session_id, { refresh: true });
await client.realtime.calls.hangup(call.session_id);
```

| Method | Endpoint | Description |
| --- | --- | --- |
| `calls.create(body)` | `POST /api/client/v1/realtime/calls` | `{ to, model, from?, connection?, variables?, first_message?, first_speaker?, machine_detection?, ring_timeout_sec? }` → `RealtimeCall` |
| `calls.get(sessionId, { refresh? })` | `GET /api/client/v1/realtime/calls/:sessionId` | `RealtimeCall`. `{ refresh: true }` (`?refresh=true`) asks Twilio for the latest state first. |
| `calls.hangup(sessionId)` | `POST /api/client/v1/realtime/calls/:sessionId/hangup` | End the call → `RealtimeCall` |

All three return the same `RealtimeCall` view:

| Field | Description |
| --- | --- |
| `id`, `session_id` | Realtime session id (they are equal). |
| `object` | `'realtime.call'` |
| `call_sid` | Twilio Call SID, once Twilio accepted the call. |
| `status` | `queued`, `ringing`, `in-progress`, `completed`, `busy`, `no-answer`, `failed`, `canceled` |
| `direction` | `outbound` (or `inbound` for calls that came in on a connection's number) |
| `from`, `to` | E.164 numbers |
| `answered_by` | Twilio answering-machine detection result, when it ran |
| `duration_sec` | Call duration once completed |
| `connection_key` | Telephony connection used |
| `realtime_model` | Preset key running the conversation |
| `session_status` | `pending` (media stream not connected yet — what `calls.create` answers), `active`, `ended`, `error` |
| `started_at`, `ended_at` | ISO timestamps of the session (`started_at` is already set on the `calls.create` answer) |

The connection is `connection` when given, else the preset's `telephony.connection_key`, else the
project's only active connection (a 400 when several exist and none is named).

`first_message` on the call replaces the preset's, but not its barge-in protection: unless it sets
`interruptible` itself it keeps the preset's value, so a mandatory disclosure stays protected when a call
brings its own wording — and `interruptible: false` on the call protects a disclosure the preset did
not.

The call's transcript, turns and latency metrics are in the realtime session logs under the same
`session_id`.

### Twilio setup

1. **Expose the Console publicly.** Twilio must reach your webhooks over HTTPS and the media stream
   over WSS with a valid certificate. Set `REALTIME_PUBLIC_URL` to the public base URL (otherwise
   `config.app.url` is used). For local testing a tunnel is enough, e.g.
   `cloudflared tunnel --url http://localhost:3000` gives
   `REALTIME_PUBLIC_URL=https://<random>.trycloudflare.com`. The URL must match exactly what Twilio
   calls, because `X-Twilio-Signature` validation signs the full URL.
2. **Create a telephony connection** (Dashboard → Realtime → Telephony). Enter the Twilio Account
   SID, Auth Token (encrypted at rest) and default *from* number, and optionally an inbound preset. Use
   **Test** to check the credentials.
3. **Point the Twilio number at the Console** (Twilio Console → Phone Numbers → your number → Voice):
   - *A call comes in* → Webhook, `POST https://<public>/api/client/v1/realtime/twilio/voice/<tenantId>/<connectionKey>`
   - *Call status changes* → `POST https://<public>/api/client/v1/realtime/twilio/status/<tenantId>/<connectionKey>`

   The telephony page shows both URLs ready to copy (a connection key is only unique within a
   tenant, and Twilio's request carries no tenant, hence the `tenantId` segment).
4. **Enable the preset for telephony.** It needs STT, TTS (G.711 is produced for you) and, for
   inbound calls, `telephony.inbound_enabled`.

**How the media stream connects.** For both inbound calls (the voice webhook answers with TwiML)
and outbound calls (`calls.create`), the Console signs a short-lived stream token and points Twilio
at a **path-token URL**:

```xml
<Response><Connect>
  <Stream url="wss://<public>/api/client/v1/realtime/twilio/stream/<token>"/>
</Connect></Response>
```

Twilio does not allow query strings on `<Stream url>`, so the token is part of the path. It
is HMAC-signed and carries the tenant, preset, session id, direction, caller, variables and first
message. It must be used within 5 minutes and works only once, so a leaked TwiML cannot be replayed.
You never build this URL yourself.

This is the only media-stream route: there is no API-key-in-TwiML variant. To run a call on a
realtime preset, point the number's voice webhook at the Console (inbound) or use `calls.create`
(outbound).

**Greeting on calls.** Inbound calls default to `first_speaker: 'agent'`: the caller hears the first
message right away. Outbound calls default to `user`, so the agent waits for the callee's "Alo?" (or
`wait_for_user_ms`) and then greets with that context. This avoids talking over the pickup and works
with voicemail detection. Change the default per preset (`telephony.outbound_first_speaker`) or per call
(`first_speaker`).

### Twilio trial accounts

- **Verified numbers only.** A trial account can only call numbers listed under *Verified Caller
  IDs*. Calls to anything else fail with error 21219.
- **Trial preamble.** Outbound trial calls first play *"You have a trial account… press any key to
  execute your code"*. The media stream, and so the agent, starts only after the callee presses a
  key. Answering-machine results are unreliable behind the preamble, so turn `machine_detection` off
  while testing. Inbound calls to a trial number also hear a short trial notice before your TwiML
  runs.
- **Geo permissions.** International destinations (e.g. Turkey, +90) must be enabled under Voice →
  Settings → Geo permissions, or calls fail with error 21215.
- **One number, limited credit.** Upgrading the account removes the preamble and the verified-number
  restriction. Nothing in the Console needs to change.
- **Expect higher latency.** The phone network adds roughly 150–300 ms compared with a WebSocket
  client, and G.711 is 8 kHz narrowband audio.

## Realtime model presets

A realtime model bundles the generator (chat model or agent + version), STT, TTS, voice,
instructions, turn detection, first speaker / first message and telephony settings under one key.
Connect with `{ model: '<key>' }`, and session fields override the preset.

```typescript
const preset = await client.realtime.models.create({
  name: 'Support voice',
  agent_key: 'support-agent',
  agent_version: 'published',
  stt_model_key: 'gpt-4o-mini-transcribe',
  stt_language: 'tr', // set it: auto-detect is slower and mis-detects short phrases ("Alo")
  stt_prompt: 'Cognipeer, Pulse', // vocabulary hints: names the transcriber should spell right
  tts_model_key: 'tts-1',
  voice: 'alloy',
  output_audio_format: 'pcm16',
  turn_detection: { type: 'semantic_vad', eagerness: 'auto' },
  first_speaker: 'agent',
  first_message: { mode: 'static', text: 'Merhaba, ben destek asistanınız.' },
  telephony: { connection_key: 'twilio-main', inbound_enabled: true, outbound_first_speaker: 'user' },
  tool_status_message: 'Bir saniye, kontrol ediyorum…',
  tool_wait_audio: true, // soft hold sound while tools run (default false)
});

await client.realtime.models.update(preset.id!, { first_message: { mode: 'none' } });

// null clears an optional field: back to the provider's default voice, no language hint.
await client.realtime.models.update(preset.id!, { voice: null, stt_language: null, stt_prompt: null });
```

Updates are partial: fields you leave out keep their value; `null` clears an optional field
(`description`, `instructions`, `temperature`, `max_output_tokens`, `stt_model_key`, `tts_model_key`,
`voice`, `tool_status_message`, and every voice-engine field; `turn_detection: null` means manual
commit). Presets come back with every field present (`null` for unset values), except
`turn_detection`: it is **absent** when the preset does not set it (sessions then default to
`semantic_vad`) and `null` only for manual commit — so
`models.update(id, { ...retrieved, name })` never switches server VAD off. `telephony` comes back as
`{ connection_key, from_number, inbound_enabled, outbound_first_speaker }`. `stt_prompt` (max 1000
characters) becomes the session's `input_audio_transcription.prompt` — list brand and product names
there so batch and streaming STT spell them correctly. `tool_wait_audio` is always a
boolean (`false` when unset; sending `null` turns it off).

**Nested settings.** `first_message` and `telephony` are merged **sub-field by sub-field**: keys you
leave out keep their stored value and a `null` removes just that key (for the text keys of
`telephony` an empty string does the same). So `update(id, { telephony: { inbound_enabled: false } })`
stops answering inbound calls without losing the connection and caller id, and
`update(id, { first_message: { interruptible: false } })` keeps the text. A merge that leaves nothing
unsets the setting; `first_message: null` / `telephony: null` clears it outright.
`first_message.mode` must end up set, so send it when the preset has no first message yet.
`turn_detection` is the opposite: the object you send **replaces** the whole setting (an object
without a `type` means `semantic_vad`), and `null` means manual commit.

**Writing a retrieved preset back.** The types accept what `retrieve()` returns, so
`models.update(id, { ...retrieved, name })` compiles and works as is: the `null` sub-fields of the
`first_message` / `telephony` views, the fully populated `turn_detection` view, the read-only keys
(`id`, `object`, `created_at`, `updated_at`; ignored) and a `null` `chat_model_key` / `agent_key` (a
preset has one generator, so the other reads `null`; the `null` is ignored — setting one replaces the
other).

Agent presets run the agent's **published** version unless `agent_version` says otherwise (the view
shows `published` when the preset stores no version).

## Text and push-to-talk

Text needs nothing but a chat model:

```typescript
const conn = await client.realtime.connect({ model: 'gpt-4o-mini' });
conn.on('response.output_text.delta', (e) => process.stdout.write(e.delta));
conn.on('response.done', () => conn.close());
conn.createResponse({ input: 'Stream me a short story.' });   // appends the user message and answers it
```

Push-to-talk turns server turn detection off: you decide when the turn ends. Transcribing needs an
STT model and speaking needs a TTS model, so set them (or use a preset that has both); a bare chat
model fails `commitAudio()` with `config_missing`.

```typescript
const conn = await client.realtime.connect({
  model: 'gpt-4o-mini',
  session: {
    turn_detection: null,                          // no server VAD: appended audio just buffers
    transcription_model: 'gpt-4o-mini-transcribe',
    tts_model: 'tts-1',
  },
});
conn.onAudio((chunk) => play(chunk));
conn.on('input_audio_buffer.committed', (e) => console.log('you said:', e.transcript));

// While the button is held:
conn.sendAudio(pcm16Chunk);   // pcm16 @ 24 kHz (or the session's input format)
// When it is released:
conn.commitAudio();           // transcribe the buffer as a user turn…
conn.createResponse();        // …and answer it: text + streamed audio (events are handled in order)
```

Audio that arrives while `turn_detection` is `null` cancels a response that is still running (the
user talking over it), so do not stream the microphone during a reply you want to finish.

`respond(content)` resolves `{ text, audio?, responseId? }` for the response to **that** message. It
sends one `response.create { input }`, waits for the server's echo of the user item
(`conversation.item.created`) and follows the first response created after it. Any other response — a
greeting already running, or one that starts on connect right after the call — is ignored, and so are
errors that cannot be its own (`tts_failed`, `invalid_audio`, `transcription_failed`…: a sentence whose
speech failed does not fail the response). It rejects when the response fails or is blocked, on an
error its own request raised (for example `config_missing`), when the socket closes, and after
`timeoutMs` (default 120 s).

## Methods

| Method | Transport | Description |
| --- | --- | --- |
| `realtime.connect(options?)` | WS | Open a session; resolves a `RealtimeConnection` once the server created it |
| `realtime.url(options?)` | — | Raw WebSocket URL (`model`, `agent`, `firstSpeaker`, `variables`, `includeApiKey`) |
| `realtime.calls.create(body)` | `POST /api/client/v1/realtime/calls` | Place an outbound call |
| `realtime.calls.get(sessionId, options?)` | `GET /api/client/v1/realtime/calls/:sessionId` | Call status (`{ refresh: true }` asks Twilio first) |
| `realtime.calls.hangup(sessionId)` | `POST /api/client/v1/realtime/calls/:sessionId/hangup` | Hang up |
| `realtime.models.list()` | `GET /api/client/v1/realtime/models` | List presets |
| `realtime.models.create(data)` | `POST /api/client/v1/realtime/models` | Create a preset |
| `realtime.models.retrieve(id)` | `GET /api/client/v1/realtime/models/:id` | Fetch a preset |
| `realtime.models.update(id, data)` | `PATCH /api/client/v1/realtime/models/:id` | Update a preset |
| `realtime.models.delete(id)` | `DELETE /api/client/v1/realtime/models/:id` | Delete a preset |

| `RealtimeConnection` | Description |
| --- | --- |
| `on(type, cb)` / `off(type, cb)` | Typed server events (`'*'` = all) |
| `onAudio(cb)` | Decoded output audio from JSON or binary frames |
| `session` | Latest server-echoed session config |
| `onClose(cb)` / `closed` | Be told when the connection ends (code, reason, transport error) / `null` while open |
| `sendAudio(audio)` | Binary input frame (`pcm16` / G.711) |
| `appendAudio(audio)` | Base64 JSON input (same formats) |
| `commitAudio()` / `clearAudio()` | Manual end of turn (`turn_detection: null`) / drop buffered input |
| `updateSession(patch)` / `setVariables(vars)` | Session config |
| `createItem(content, role?)` | Append a message |
| `createResponse(overrides?)` / `startFirstMessage()` / `cancelResponse()` | Responses |
| `reportPlayback(responseId, playedMs)` | Playback progress for interruption truncation |
| `respond(content, options?)` | Send a message and await the full response |
| `send(event)` / `close()` | Raw event / close the socket |
