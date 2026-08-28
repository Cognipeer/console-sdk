import { describe, it, expect } from 'vitest';
import {
  AudioResource,
  AudioTranscriptionsResource,
  AudioTranslationsResource,
  AudioSpeechResource,
  OcrResource,
} from './audio';
import { createMockHttp } from '../test/mockHttp';

describe('AudioResource', () => {
  it('wires up transcriptions, translations, and speech sub-resources', () => {
    const http = createMockHttp();
    const resource = new AudioResource(http);

    expect(resource.transcriptions).toBeInstanceOf(AudioTranscriptionsResource);
    expect(resource.translations).toBeInstanceOf(AudioTranslationsResource);
    expect(resource.speech).toBeInstanceOf(AudioSpeechResource);
  });
});

describe('AudioTranscriptionsResource', () => {
  it('sends a JSON request when audio is a plain base64/data-URL string', async () => {
    const http = createMockHttp();
    const response = { text: 'hello world' };
    http.request.mockResolvedValue(response);
    const resource = new AudioTranscriptionsResource(http);

    const result = await resource.create({ model: 'whisper-1', audio: 'data:audio/mp3;base64,AAA=' });

    expect(result).toBe(response);
    expect(http.requestMultipart).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/audio/transcriptions', {
      body: {
        model: 'whisper-1',
        audio: { data: 'data:audio/mp3;base64,AAA=' },
        language: undefined,
        prompt: undefined,
        response_format: undefined,
        temperature: undefined,
        timestamp_granularities: undefined,
      },
    });
  });

  it('sends a JSON request when audio is an inline {data} object without a `kind`', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ text: 'hi' });
    const resource = new AudioTranscriptionsResource(http);

    await resource.create({ model: 'whisper-1', audio: { data: 'AAA=', fileName: 'voice.mp3' } });

    expect(http.requestMultipart).not.toHaveBeenCalled();
    const [, , options] = http.request.mock.calls[0];
    expect(options.body.audio).toEqual({ data: 'AAA=', fileName: 'voice.mp3' });
  });

  it('sends a multipart request when audio is a structured {kind: "buffer"} source', async () => {
    const http = createMockHttp();
    const response = { text: 'transcribed' };
    http.requestMultipart.mockResolvedValue(response);
    const resource = new AudioTranscriptionsResource(http);

    const result = await resource.create({
      model: 'whisper-1',
      audio: { kind: 'buffer', data: new Uint8Array([1, 2, 3]), fileName: 'voice.wav', contentType: 'audio/wav' },
    });

    expect(result).toBe(response);
    expect(http.request).not.toHaveBeenCalled();
    expect(http.requestMultipart).toHaveBeenCalledTimes(1);
    const [method, path, form] = http.requestMultipart.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/api/client/v1/audio/transcriptions');
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('model')).toBe('whisper-1');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('sends a multipart request when audio is a {kind: "blob"} source', async () => {
    const http = createMockHttp();
    http.requestMultipart.mockResolvedValue({ text: 'ok' });
    const resource = new AudioTranscriptionsResource(http);
    const blob = new Blob(['fake audio bytes']);

    await resource.create({ model: 'whisper-1', audio: { kind: 'blob', blob, fileName: 'clip.mp3' } });

    const [, , form] = http.requestMultipart.mock.calls[0];
    const appended = form.get('file');
    expect(appended).toBeInstanceOf(Blob);
    expect((appended as File).name).toBe('clip.mp3');
    expect(appended.size).toBe(blob.size);
  });

  it('includes optional STT parameters as multipart fields', async () => {
    const http = createMockHttp();
    http.requestMultipart.mockResolvedValue({ text: 'ok' });
    const resource = new AudioTranscriptionsResource(http);

    await resource.create({
      model: 'whisper-1',
      audio: { kind: 'buffer', data: new Uint8Array([1]) },
      language: 'en',
      prompt: 'context hint',
      response_format: 'json',
      temperature: 0.2,
      timestamp_granularities: ['word', 'segment'],
    });

    const [, , form] = http.requestMultipart.mock.calls[0];
    expect(form.get('language')).toBe('en');
    expect(form.get('prompt')).toBe('context hint');
    expect(form.get('response_format')).toBe('json');
    expect(form.get('temperature')).toBe('0.2');
    expect(form.getAll('timestamp_granularities[]')).toEqual(['word', 'segment']);
  });
});

describe('AudioTranslationsResource', () => {
  it('sends a JSON request for a string audio payload', async () => {
    const http = createMockHttp();
    const response = { text: 'translated' };
    http.request.mockResolvedValue(response);
    const resource = new AudioTranslationsResource(http);

    const result = await resource.create({ model: 'whisper-1', audio: 'AAA=' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/audio/translations', {
      body: expect.objectContaining({ model: 'whisper-1', audio: { data: 'AAA=' } }),
    });
  });
});

describe('AudioSpeechResource', () => {
  it('synthesizes speech and maps the binary result to an `audio` field', async () => {
    const http = createMockHttp();
    const bytes = new Uint8Array([1, 2, 3]);
    http.requestBinary.mockResolvedValue({ data: bytes, contentType: 'audio/mpeg', requestId: 'req_1' });
    const resource = new AudioSpeechResource(http);

    const result = await resource.create({ model: 'tts-1', input: 'Hello world', voice: 'alloy' });

    expect(result).toEqual({ audio: bytes, contentType: 'audio/mpeg', requestId: 'req_1' });
    expect(http.requestBinary).toHaveBeenCalledWith('POST', '/api/client/v1/audio/speech', {
      body: { model: 'tts-1', input: 'Hello world', voice: 'alloy' },
    });
  });
});

describe('OcrResource', () => {
  it('sends a JSON request when the document is a URL reference', async () => {
    const http = createMockHttp();
    const response = { text: 'extracted text' };
    http.request.mockResolvedValue(response);
    const resource = new OcrResource(http);

    const result = await resource.extract({
      model: 'cognipeer-ocr',
      document: { url: 'https://example.com/invoice.pdf' },
    });

    expect(result).toBe(response);
    expect(http.requestMultipart).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/ocr', {
      body: {
        model: 'cognipeer-ocr',
        document: { url: 'https://example.com/invoice.pdf' },
        pages: undefined,
        language: undefined,
        features: undefined,
        prompt: undefined,
      },
    });
  });

  it('sends a multipart request when the document is inline base64 data', async () => {
    const http = createMockHttp();
    const response = { text: 'extracted' };
    http.requestMultipart.mockResolvedValue(response);
    const resource = new OcrResource(http);

    const result = await resource.extract({
      model: 'cognipeer-ocr',
      document: { data: 'AAA=', fileName: 'invoice.pdf', contentType: 'application/pdf' },
      features: ['text', 'tables'],
    });

    expect(result).toBe(response);
    expect(http.request).not.toHaveBeenCalled();
    const [method, path, form] = http.requestMultipart.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/api/client/v1/ocr');
    expect(form.get('model')).toBe('cognipeer-ocr');
    expect(form.get('features')).toBe('text,tables');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });
});
