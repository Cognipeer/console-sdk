import { HttpClient } from '../http';
import {
  AudioFileInput,
  AudioFileSource,
  AudioSpeechRequest,
  AudioSpeechResponse,
  AudioTranscriptionRequest,
  AudioTranscriptionResponse,
  AudioTranslationRequest,
  AudioTranslationResponse,
  OcrDocumentInput,
  OcrExtractRequest,
  OcrExtractResponse,
} from '../types';

function isBlobLike(v: unknown): v is Blob {
  return typeof Blob !== 'undefined' && v instanceof Blob;
}

function isStructuredAudioInput(v: unknown): v is AudioFileSource {
  return Boolean(v) && typeof v === 'object' && 'kind' in (v as object);
}

function isInlineAudioInput(v: unknown): v is AudioFileInput {
  return Boolean(v) && typeof v === 'object' && typeof (v as AudioFileInput).data === 'string';
}

function shouldUseMultipart(audio: AudioTranscriptionRequest['audio']): boolean {
  if (typeof audio === 'string') return false;
  if (isInlineAudioInput(audio) && !isStructuredAudioInput(audio)) return false;
  return true;
}

function toBlobFromBuffer(
  data: Uint8Array | ArrayBuffer,
  contentType?: string,
): Blob {
  const view = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  // BlobPart accepts Uint8Array in both browser and Node 18+.
  return new Blob([view], { type: contentType || 'application/octet-stream' });
}

function base64ToBlob(base64: string, contentType?: string): Blob {
  const cleaned = base64.includes('base64,') ? base64.split('base64,').pop() || '' : base64;
  const binary = atob(cleaned);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType || 'application/octet-stream' });
}

function audioToBlob(source: AudioFileSource): { blob: Blob; fileName: string } {
  if (source.kind === 'blob') {
    const file = source.blob as Blob & { name?: string };
    return { blob: file, fileName: source.fileName || file.name || 'audio' };
  }
  if (source.kind === 'buffer') {
    return {
      blob: toBlobFromBuffer(source.data, source.contentType),
      fileName: source.fileName || 'audio',
    };
  }
  return {
    blob: base64ToBlob(source.data, source.contentType),
    fileName: source.fileName || 'audio',
  };
}

function ocrDocumentToBlob(
  doc: OcrDocumentInput,
): { blob?: Blob; fileName?: string; url?: string } {
  if ('url' in doc) {
    return { url: doc.url };
  }
  return {
    blob: base64ToBlob(doc.data, doc.contentType),
    fileName: doc.fileName || 'document',
  };
}

/**
 * Audio API resource — OpenAI-compatible STT, translation, and TTS.
 *
 * @example
 * ```typescript
 * // Transcribe an audio file
 * const transcript = await client.audio.transcriptions.create({
 *   model: 'whisper-1',
 *   audio: { data: buffer.toString('base64'), fileName: 'voice.mp3' },
 * });
 *
 * // Synthesize speech (returns binary)
 * const speech = await client.audio.speech.create({
 *   model: 'tts-1',
 *   input: 'Hello world',
 *   voice: 'alloy',
 *   response_format: 'mp3',
 * });
 * writeFileSync('out.mp3', speech.audio);
 * ```
 */
export class AudioResource {
  public transcriptions: AudioTranscriptionsResource;
  public translations: AudioTranslationsResource;
  public speech: AudioSpeechResource;

  constructor(http: HttpClient) {
    this.transcriptions = new AudioTranscriptionsResource(http);
    this.translations = new AudioTranslationsResource(http);
    this.speech = new AudioSpeechResource(http);
  }
}

class AudioBaseResource {
  protected http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  protected async sendSttRequest<T>(
    path: string,
    params: AudioTranscriptionRequest,
  ): Promise<T> {
    if (shouldUseMultipart(params.audio)) {
      const form = new FormData();
      form.append('model', params.model);

      const audio = params.audio as AudioFileSource;
      const { blob, fileName } = isBlobLike(audio)
        ? { blob: audio as Blob, fileName: 'audio' }
        : audioToBlob(audio);
      form.append('file', blob, fileName);

      if (params.language) form.append('language', params.language);
      if (params.prompt) form.append('prompt', params.prompt);
      if (params.response_format) form.append('response_format', params.response_format);
      if (typeof params.temperature === 'number') {
        form.append('temperature', String(params.temperature));
      }
      if (params.timestamp_granularities) {
        for (const g of params.timestamp_granularities) {
          form.append('timestamp_granularities[]', g);
        }
      }
      return this.http.requestMultipart<T>('POST', path, form);
    }

    const audio = params.audio;
    const audioPayload: AudioFileInput =
      typeof audio === 'string'
        ? { data: audio }
        : (audio as AudioFileInput);

    return this.http.request<T>('POST', path, {
      body: {
        model: params.model,
        audio: audioPayload,
        language: params.language,
        prompt: params.prompt,
        response_format: params.response_format,
        temperature: params.temperature,
        timestamp_granularities: params.timestamp_granularities,
      },
    });
  }
}

export class AudioTranscriptionsResource extends AudioBaseResource {
  async create(params: AudioTranscriptionRequest): Promise<AudioTranscriptionResponse> {
    return this.sendSttRequest<AudioTranscriptionResponse>(
      '/api/client/v1/audio/transcriptions',
      params,
    );
  }
}

export class AudioTranslationsResource extends AudioBaseResource {
  async create(params: AudioTranslationRequest): Promise<AudioTranslationResponse> {
    return this.sendSttRequest<AudioTranslationResponse>(
      '/api/client/v1/audio/translations',
      params,
    );
  }
}

export class AudioSpeechResource {
  private http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Synthesize speech. Returns the raw audio bytes. */
  async create(params: AudioSpeechRequest): Promise<AudioSpeechResponse> {
    const { data, contentType, requestId } = await this.http.requestBinary(
      'POST',
      '/api/client/v1/audio/speech',
      { body: params },
    );
    return { audio: data, contentType, requestId };
  }
}

/**
 * OCR API resource — document text extraction.
 *
 * @example
 * ```typescript
 * const result = await client.ocr.extract({
 *   model: 'cognipeer-ocr',
 *   document: { data: buffer.toString('base64'), fileName: 'invoice.pdf' },
 *   features: ['text', 'tables'],
 * });
 * console.log(result.text);
 * ```
 */
export class OcrResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async extract(params: OcrExtractRequest): Promise<OcrExtractResponse> {
    const useMultipart = !('url' in params.document);

    if (useMultipart) {
      const form = new FormData();
      form.append('model', params.model);

      const { blob, fileName } = ocrDocumentToBlob(params.document);
      if (blob && fileName) form.append('file', blob, fileName);

      if (params.pages) form.append('pages', params.pages.join(','));
      if (params.language) form.append('language', params.language);
      if (params.features) form.append('features', params.features.join(','));
      if (params.prompt) form.append('prompt', params.prompt);

      return this.http.requestMultipart<OcrExtractResponse>(
        'POST',
        '/api/client/v1/ocr',
        form,
      );
    }

    return this.http.request<OcrExtractResponse>('POST', '/api/client/v1/ocr', {
      body: {
        model: params.model,
        document: params.document,
        pages: params.pages,
        language: params.language,
        features: params.features,
        prompt: params.prompt,
      },
    });
  }
}
