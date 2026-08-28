import { describe, it, expect, vi } from 'vitest';
import {
  CognipeerOTelSpanExporter,
  ExportResultCode,
  OTelSpanKind,
  OTelSpanStatusCode,
  type ReadableSpan,
} from './opentelemetry';

function makeSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'test-span',
    spanContext: () => ({ traceId: 'trace-1', spanId: 'span-1', traceFlags: 1 }),
    parentSpanId: undefined,
    kind: OTelSpanKind.INTERNAL,
    startTime: [1_700_000_000, 0],
    endTime: [1_700_000_001, 500_000_000],
    status: { code: OTelSpanStatusCode.OK },
    attributes: { 'http.method': 'GET' },
    events: [],
    resource: { attributes: { 'service.name': 'my-service' } },
    instrumentationLibrary: { name: 'my-lib', version: '1.0.0' },
    ...overrides,
  };
}

function jsonOkResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('CognipeerOTelSpanExporter', () => {
  describe('constructor', () => {
    it('strips a trailing slash from the base URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com/',
        fetch: fetchMock,
      });

      await new Promise<void>((resolve) => {
        exporter.export([makeSpan()], () => resolve());
      });

      expect(fetchMock.mock.calls[0][0]).toBe('https://console.cognipeer.com/api/client/v1/traces');
    });

    it('strips a legacy /api/client/v1 suffix from the base URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com/api/client/v1',
        fetch: fetchMock,
      });

      await new Promise<void>((resolve) => {
        exporter.export([makeSpan()], () => resolve());
      });

      expect(fetchMock.mock.calls[0][0]).toBe('https://console.cognipeer.com/api/client/v1/traces');
    });
  });

  describe('export()', () => {
    it('POSTs the OTLP payload and reports SUCCESS', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });
      const resultCallback = vi.fn();

      await new Promise<void>((resolve) => {
        exporter.export([makeSpan()], (result) => {
          resultCallback(result);
          resolve();
        });
      });

      expect(resultCallback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test',
      });

      const payload = JSON.parse(init.body);
      expect(payload.resourceSpans).toHaveLength(1);
      const resourceSpan = payload.resourceSpans[0];
      expect(resourceSpan.resource.attributes).toEqual([
        { key: 'service.name', value: { stringValue: 'my-service' } },
      ]);
      expect(resourceSpan.scopeSpans).toHaveLength(1);
      expect(resourceSpan.scopeSpans[0].scope).toEqual({ name: 'my-lib', version: '1.0.0' });

      const span = resourceSpan.scopeSpans[0].spans[0];
      expect(span.traceId).toBe('trace-1');
      expect(span.spanId).toBe('span-1');
      expect(span.name).toBe('test-span');
      expect(span.kind).toBe(OTelSpanKind.INTERNAL);
      expect(span.status).toEqual({ code: OTelSpanStatusCode.OK, message: undefined });
      expect(span.attributes).toEqual([{ key: 'http.method', value: { stringValue: 'GET' } }]);
      // 1_700_000_000s + 0ns => 1700000000000000000ns
      expect(span.startTimeUnixNano).toBe('1700000000000000000');
      // 1_700_000_001s + 500_000_000ns => 1700000001500000000ns
      expect(span.endTimeUnixNano).toBe('1700000001500000000');
    });

    it('merges custom extra headers with the defaults', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
        headers: { 'X-Custom': 'abc' },
      });

      await new Promise<void>((resolve) => {
        exporter.export([makeSpan()], () => resolve());
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers['X-Custom']).toBe('abc');
    });

    it('converts numeric, boolean, and array attribute values correctly', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });

      const span = makeSpan({
        attributes: {
          'retry.count': 3,
          'retry.backoff': 1.5,
          'request.cached': true,
          'request.tags': ['a', 'b'],
          'request.ignored': undefined,
        },
      });

      await new Promise<void>((resolve) => {
        exporter.export([span], () => resolve());
      });

      const [, init] = fetchMock.mock.calls[0];
      const payload = JSON.parse(init.body);
      const attrs = payload.resourceSpans[0].scopeSpans[0].spans[0].attributes;
      expect(attrs).toEqual([
        { key: 'retry.count', value: { intValue: '3' } },
        { key: 'retry.backoff', value: { doubleValue: 1.5 } },
        { key: 'request.cached', value: { boolValue: true } },
        { key: 'request.tags', value: { arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] } } },
      ]);
    });

    it('includes span events with their own converted attributes', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });

      const span = makeSpan({
        events: [
          {
            name: 'retry',
            time: [1_700_000_000, 250_000_000],
            attributes: { attempt: 2 },
          },
        ],
      });

      await new Promise<void>((resolve) => {
        exporter.export([span], () => resolve());
      });

      const [, init] = fetchMock.mock.calls[0];
      const payload = JSON.parse(init.body);
      const events = payload.resourceSpans[0].scopeSpans[0].spans[0].events;
      expect(events).toEqual([
        {
          name: 'retry',
          timeUnixNano: '1700000000250000000',
          attributes: [{ key: 'attempt', value: { intValue: '2' } }],
        },
      ]);
    });

    it('groups spans sharing the same resource and instrumentation library under one scope', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });

      const spanA = makeSpan({ name: 'a' });
      const spanB = makeSpan({ name: 'b' });

      await new Promise<void>((resolve) => {
        exporter.export([spanA, spanB], () => resolve());
      });

      const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(payload.resourceSpans).toHaveLength(1);
      expect(payload.resourceSpans[0].scopeSpans).toHaveLength(1);
      expect(payload.resourceSpans[0].scopeSpans[0].spans.map((s: { name: string }) => s.name)).toEqual([
        'a',
        'b',
      ]);
    });

    it('separates spans from different instrumentation libraries into different scopes', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonOkResponse());
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });

      const spanA = makeSpan({ name: 'a', instrumentationLibrary: { name: 'lib-a' } });
      const spanB = makeSpan({ name: 'b', instrumentationLibrary: { name: 'lib-b' } });

      await new Promise<void>((resolve) => {
        exporter.export([spanA, spanB], () => resolve());
      });

      const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(payload.resourceSpans[0].scopeSpans).toHaveLength(2);
    });

    it('reports SUCCESS without calling fetch when there are no spans', async () => {
      const fetchMock = vi.fn();
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });
      const resultCallback = vi.fn();

      await new Promise<void>((resolve) => {
        exporter.export([], (result) => {
          resultCallback(result);
          resolve();
        });
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(resultCallback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
    });

    it('reports FAILED with an error when the server responds with a non-ok status', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });
      const resultCallback = vi.fn();

      await new Promise<void>((resolve) => {
        exporter.export([makeSpan()], (result) => {
          resultCallback(result);
          resolve();
        });
      });

      expect(resultCallback).toHaveBeenCalledTimes(1);
      const [result] = resultCallback.mock.calls[0];
      expect(result.code).toBe(ExportResultCode.FAILED);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toContain('OTLP export failed: 500');
    });

    it('reports FAILED when the fetch implementation rejects', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });
      const resultCallback = vi.fn();

      await new Promise<void>((resolve) => {
        exporter.export([makeSpan()], (result) => {
          resultCallback(result);
          resolve();
        });
      });

      const [result] = resultCallback.mock.calls[0];
      expect(result.code).toBe(ExportResultCode.FAILED);
      expect((result.error as Error).message).toBe('network down');
    });
  });

  describe('shutdown() / forceFlush()', () => {
    it('resolve without making any network calls', async () => {
      const fetchMock = vi.fn();
      const exporter = new CognipeerOTelSpanExporter({
        apiKey: 'sk-test',
        baseURL: 'https://console.cognipeer.com',
        fetch: fetchMock,
      });

      await expect(exporter.shutdown()).resolves.toBeUndefined();
      await expect(exporter.forceFlush()).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
