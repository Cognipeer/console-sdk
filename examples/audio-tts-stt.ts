import { readFileSync, writeFileSync } from 'node:fs';
import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  if (!apiKey) throw new Error('COGNIPEER_API_KEY is required');

  const client = new ConsoleClient({
    apiKey,
    ...(process.env.COGNIPEER_BASE_URL ? { baseURL: process.env.COGNIPEER_BASE_URL } : {}),
  });

  const ttsModel = process.env.COGNIPEER_TTS_MODEL || 'tts-1';
  const ttsVoice = process.env.COGNIPEER_TTS_VOICE || 'alloy';
  const sttModel = process.env.COGNIPEER_STT_MODEL || 'whisper-1';

  // 1) Synthesize speech (binary response)
  console.log(`Synthesizing speech with ${ttsModel}/${ttsVoice}…`);
  const speech = await client.audio.speech.create({
    model: ttsModel,
    input: 'Hello from the Cognipeer Console SDK.',
    voice: ttsVoice,
    response_format: 'mp3',
  });

  const outFile = 'demo-tts.mp3';
  writeFileSync(outFile, speech.audio);
  console.log(`Wrote ${speech.audio.byteLength} bytes (${speech.contentType}) → ${outFile}`);

  // 2) Round-trip: transcribe the file we just wrote
  console.log(`Transcribing ${outFile} with ${sttModel}…`);
  const audioBuffer = readFileSync(outFile);
  const transcript = await client.audio.transcriptions.create({
    model: sttModel,
    audio: {
      kind: 'buffer',
      data: audioBuffer,
      fileName: outFile,
      contentType: 'audio/mpeg',
    },
    response_format: 'json',
  });

  console.log('Transcript:', transcript.text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
