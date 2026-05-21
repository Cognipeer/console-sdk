# Audio API

OpenAI-compatible audio surface. The SDK accepts the same inputs the OpenAI
Audio API does — STT, translation, and TTS — but routes them through the
Console gateway.

## `client.audio.transcriptions.create(params)`

Speech-to-text. Accepts a base64 string, a structured `{ kind: 'blob' | 'buffer' | 'base64' }` source, or an inline `{ data, fileName }` object.

```typescript
import { readFileSync } from 'node:fs';
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const audioBuf = readFileSync('voice.mp3');

const transcript = await client.audio.transcriptions.create({
  model: 'whisper-1',
  audio: {
    kind: 'buffer',
    data: audioBuf,
    fileName: 'voice.mp3',
    contentType: 'audio/mpeg',
  },
  response_format: 'verbose_json',
  timestamp_granularities: ['segment'],
});

console.log(transcript.text);
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `model` | `string` | Model key (e.g. `whisper-1`). |
| `audio` | `string \| AudioFileInput \| AudioFileSource` | Audio payload. Strings are treated as base64. |
| `language` | `string` | Source language. |
| `prompt` | `string` | Bias prompt. |
| `response_format` | `'json' \| 'text' \| 'srt' \| 'verbose_json' \| 'vtt'` | Response shape. |
| `temperature` | `number` | Sampling temperature. |
| `timestamp_granularities` | `Array<'word' \| 'segment'>` | Required granularities when using `verbose_json`. |

### Audio input shapes

```typescript
type AudioFileSource =
  | { kind: 'base64'; data: string; fileName?: string; contentType?: string }
  | { kind: 'blob';   blob: Blob; fileName?: string }
  | { kind: 'buffer'; data: Uint8Array | ArrayBuffer; fileName?: string; contentType?: string };

interface AudioFileInput {
  data: string;        // raw base64
  fileName?: string;
  contentType?: string;
}
```

When you pass a `Blob`/`Buffer`/`AudioFileSource`, the SDK sends the request
as `multipart/form-data`. Plain base64 strings are sent as JSON, which is
useful for serverless runtimes that can't construct multipart bodies.

## `client.audio.translations.create(params)`

Same shape as `transcriptions.create`, but translates the audio to English on
the server.

```typescript
const en = await client.audio.translations.create({
  model: 'whisper-1',
  audio: { kind: 'buffer', data: readFileSync('greeting.tr.mp3') },
});
```

## `client.audio.speech.create(params)`

Synthesize speech. Returns the raw audio bytes (`Uint8Array`) plus the
response `Content-Type` header.

```typescript
import { writeFileSync } from 'node:fs';

const speech = await client.audio.speech.create({
  model: 'tts-1',
  input: 'Hello world',
  voice: 'alloy',
  response_format: 'mp3',
});

writeFileSync('hello.mp3', speech.audio);
console.log(speech.contentType); // audio/mpeg
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `model` | `string` | TTS model key (e.g. `tts-1`). |
| `input` | `string` | Text to synthesize. |
| `voice` | `string` | Voice identifier. |
| `response_format` | `'mp3' \| 'opus' \| 'aac' \| 'flac' \| 'wav' \| 'pcm'` | Output format. |
| `speed` | `number` | Playback speed multiplier. |
| `instructions` | `string` | Optional style instructions. |

### Response shape

```typescript
interface AudioSpeechResponse {
  audio: Uint8Array;
  contentType: string;
  requestId?: string;
}
```
