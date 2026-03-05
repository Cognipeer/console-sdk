/**
 * OpenTelemetry Span Exporter for Cognipeer Console
 *
 * Implements the OTel SpanExporter interface so that *any* OTel-instrumented
 * agent (LangChain, CrewAI, AutoGen, custom, …) can ship traces to Cognipeer
 * without adopting the Cognipeer agent-sdk.
 *
 * Usage with the OTel SDK:
 * ```ts
 * import { CognipeerOTelSpanExporter } from '@cognipeer/console-sdk';
 * import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
 * import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
 *
 * const exporter = new CognipeerOTelSpanExporter({
 *   apiKey: 'cp_...',
 *   baseURL: 'https://gateway.cognipeer.ai',
 * });
 *
 * const provider = new NodeTracerProvider();
 * provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
 * provider.register();
 * ```
 *
 * The exporter converts OTel `ReadableSpan[]` to the OTLP/HTTP JSON
 * `ExportTraceServiceRequest` and POSTs it to `/api/client/v1/traces`.
 */

/* ------------------------------------------------------------------ */
/*  Minimal OTel type surface (avoid hard dependency on @opentelemetry) */
/* ------------------------------------------------------------------ */

/** Subset of `@opentelemetry/api#SpanStatusCode` */
export const enum OTelSpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

/** Subset of `@opentelemetry/api#SpanKind` */
export const enum OTelSpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4,
}

/** Minimal attribute value type (aligned with @opentelemetry/api#AttributeValue) */
type AttributeValue = string | number | boolean | (string | number | boolean | null | undefined)[];

/** Minimal readable span shape (matches `@opentelemetry/sdk-trace-base#ReadableSpan`) */
export interface ReadableSpan {
  name: string;
  spanContext(): {
    traceId: string;
    spanId: string;
    traceFlags?: number;
  };
  parentSpanId?: string;
  kind: number; // SpanKind enum value
  startTime: [number, number]; // [seconds, nanoseconds]
  endTime: [number, number];
  status: { code: number; message?: string }; // SpanStatusCode enum value
  attributes: Record<string, AttributeValue | undefined>;
  events: Array<{
    name: string;
    time: [number, number];
    attributes?: Record<string, AttributeValue | undefined>;
  }>;
  resource: {
    attributes: Record<string, AttributeValue | undefined>;
  };
  instrumentationLibrary: {
    name: string;
    version?: string;
  };
}

/** Result codes returned by `export()` */
export const ExportResultCode = {
  SUCCESS: 0 as const,
  FAILED: 1 as const,
};

export interface ExportResult {
  code: number;
  error?: Error;
}

/* ------------------------------------------------------------------ */
/*  OTLP JSON wire types (subset)                                     */
/* ------------------------------------------------------------------ */

interface OtlpKeyValue {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: { values: Array<{ stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean }> };
  };
}

interface OtlpSpanEvent {
  name: string;
  timeUnixNano: string;
  attributes?: OtlpKeyValue[];
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  status: { code: number; message?: string };
  attributes: OtlpKeyValue[];
  events: OtlpSpanEvent[];
}

interface OtlpExportTraceServiceRequest {
  resourceSpans: Array<{
    resource: { attributes: OtlpKeyValue[] };
    scopeSpans: Array<{
      scope: { name: string; version?: string };
      spans: OtlpSpan[];
    }>;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function hrtimeToNano(hr: [number, number]): string {
  const ns = BigInt(hr[0]) * BigInt(1_000_000_000) + BigInt(hr[1]);
  return ns.toString();
}

function toOtlpAttribute(key: string, value: AttributeValue | undefined): OtlpKeyValue | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return { key, value: { stringValue: value } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { key, value: { intValue: String(value) } }
      : { key, value: { doubleValue: value } };
  }
  if (Array.isArray(value)) {
    const values = value
      .filter((v): v is string | number | boolean => v !== null && v !== undefined)
      .map((v) => {
        if (typeof v === 'string') return { stringValue: v };
        if (typeof v === 'boolean') return { boolValue: v };
        if (typeof v === 'number') return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v };
        return { stringValue: String(v) };
      });
    return { key, value: { arrayValue: { values } } };
  }
  return { key, value: { stringValue: String(value) } };
}

function spanToOtlp(span: ReadableSpan): OtlpSpan {
  const ctx = span.spanContext();
  const attributes: OtlpKeyValue[] = [];
  for (const [k, v] of Object.entries(span.attributes)) {
    const kv = toOtlpAttribute(k, v);
    if (kv) attributes.push(kv);
  }

  const events: OtlpSpanEvent[] = (span.events || []).map((evt) => {
    const evtAttrs: OtlpKeyValue[] = [];
    if (evt.attributes) {
      for (const [k, v] of Object.entries(evt.attributes)) {
        const kv = toOtlpAttribute(k, v);
        if (kv) evtAttrs.push(kv);
      }
    }
    return {
      name: evt.name,
      timeUnixNano: hrtimeToNano(evt.time),
      attributes: evtAttrs.length ? evtAttrs : undefined,
    };
  });

  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    parentSpanId: span.parentSpanId || undefined,
    name: span.name,
    kind: span.kind ?? OTelSpanKind.INTERNAL,
    startTimeUnixNano: hrtimeToNano(span.startTime),
    endTimeUnixNano: hrtimeToNano(span.endTime),
    status: {
      code: span.status.code ?? OTelSpanStatusCode.UNSET,
      message: span.status.message,
    },
    attributes,
    events,
  };
}

/* ------------------------------------------------------------------ */
/*  Exporter                                                          */
/* ------------------------------------------------------------------ */

export interface CognipeerOTelExporterOptions {
  /** API token (Bearer) */
  apiKey: string;
  /** Gateway base URL (e.g. https://gateway.cognipeer.ai) */
  baseURL: string;
  /** Extra headers to attach to every request */
  headers?: Record<string, string>;
  /** Request timeout in ms (default 30 000) */
  timeout?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

/**
 * OTel-compatible span exporter that ships traces to Cognipeer Console
 * via the `/api/client/v1/traces` OTLP/HTTP JSON endpoint.
 */
export class CognipeerOTelSpanExporter {
  private baseURL: string;
  private apiKey: string;
  private extraHeaders: Record<string, string>;
  private timeout: number;
  private fetchImpl: typeof fetch;

  constructor(opts: CognipeerOTelExporterOptions) {
    this.baseURL = opts.baseURL.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.extraHeaders = opts.headers ?? {};
    this.timeout = opts.timeout ?? 30_000;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  /**
   * Called by the OTel SDK to export finished spans.
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    this._doExport(spans)
      .then(() => resultCallback({ code: ExportResultCode.SUCCESS }))
      .catch((err) => resultCallback({ code: ExportResultCode.FAILED, error: err }));
  }

  /**
   * Flush pending exports. No-op here since we export synchronously.
   */
  async shutdown(): Promise<void> {
    // nothing to flush
  }

  /**
   * Force flush. Alias for shutdown().
   */
  async forceFlush(): Promise<void> {
    // nothing to flush
  }

  /* ---------------------------------------------------------------- */
  /*  Internal                                                        */
  /* ---------------------------------------------------------------- */

  private async _doExport(spans: ReadableSpan[]): Promise<void> {
    if (spans.length === 0) return;

    // Group spans by resource + instrumentation library
    const resourceMap = new Map<
      string,
      {
        resourceAttrs: OtlpKeyValue[];
        scopeMap: Map<string, { name: string; version?: string; spans: OtlpSpan[] }>;
      }
    >();

    for (const span of spans) {
      // Build resource key
      const resAttrs: OtlpKeyValue[] = [];
      if (span.resource?.attributes) {
        for (const [k, v] of Object.entries(span.resource.attributes)) {
          const kv = toOtlpAttribute(k, v);
          if (kv) resAttrs.push(kv);
        }
      }
      const resKey = JSON.stringify(resAttrs);

      let entry = resourceMap.get(resKey);
      if (!entry) {
        entry = { resourceAttrs: resAttrs, scopeMap: new Map() };
        resourceMap.set(resKey, entry);
      }

      const libName = span.instrumentationLibrary?.name ?? 'unknown';
      const libVer = span.instrumentationLibrary?.version;
      const scopeKey = `${libName}@${libVer ?? ''}`;

      let scope = entry.scopeMap.get(scopeKey);
      if (!scope) {
        scope = { name: libName, version: libVer, spans: [] };
        entry.scopeMap.set(scopeKey, scope);
      }

      scope.spans.push(spanToOtlp(span));
    }

    // Build OTLP payload
    const payload: OtlpExportTraceServiceRequest = {
      resourceSpans: [],
    };

    for (const entry of resourceMap.values()) {
      const scopeSpans = Array.from(entry.scopeMap.values()).map((s) => ({
        scope: { name: s.name, version: s.version },
        spans: s.spans,
      }));
      payload.resourceSpans.push({
        resource: { attributes: entry.resourceAttrs },
        scopeSpans,
      });
    }

    const url = `${this.baseURL}/api/client/v1/traces`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OTLP export failed: ${res.status} ${text}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
