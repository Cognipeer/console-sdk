# Audio Example (TTS → STT round-trip)

This example synthesizes speech with the Audio API, writes it to disk, then
transcribes the file back to text — exercising both `audio.speech.create`
(binary response) and `audio.transcriptions.create` (multipart upload).

## Run the example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com  # optional
export COGNIPEER_TTS_MODEL=tts-1
export COGNIPEER_TTS_VOICE=alloy
export COGNIPEER_STT_MODEL=whisper-1
npm run example:audio
```

## Code

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

// 1. Synthesize speech (binary)
const speech = await client.audio.speech.create({
  model: 'tts-1',
  input: 'Hello from the Cognipeer Console SDK.',
  voice: 'alloy',
  response_format: 'mp3',
});

writeFileSync('demo-tts.mp3', speech.audio);

// 2. Transcribe what we just generated
const transcript = await client.audio.transcriptions.create({
  model: 'whisper-1',
  audio: {
    kind: 'buffer',
    data: readFileSync('demo-tts.mp3'),
    fileName: 'demo-tts.mp3',
    contentType: 'audio/mpeg',
  },
});

console.log(transcript.text);
```

## Notes

- `client.audio.speech.create(...)` returns `{ audio: Uint8Array, contentType, requestId? }` — write the bytes straight to disk or pipe them into a Web Audio buffer.
- `client.audio.transcriptions.create(...)` accepts a base64 string, a
  `Blob`, an `ArrayBuffer`/`Uint8Array`, or an inline `{ data, fileName }` object.
- `client.audio.translations.create(...)` has the same shape and translates
  the audio to English on the server.
