import { HttpClient } from '../http';
import {
  OtlpExportTraceServiceRequest,
  OtlpIngestResponse,
  TracingEvent,
  TracingSessionRequest,
  TracingStreamEndRequest,
  TracingStreamEndResponse,
  TracingStreamEventResponse,
  TracingStreamStartRequest,
  TracingStreamStartResponse,
} from '../types';

/**
 * Agent Tracing API resource.
 *
 * Three ingestion modes are supported:
 *   - `ingest(session)`             — submit a full session in one shot.
 *   - `startStream / appendEvent /
 *      endStream`                   — incrementally stream a session.
 *   - `ingestOtlp(payload)`         — submit OTLP/HTTP JSON spans directly.
 *
 * @example
 * ```typescript
 * // Streaming style
 * await client.tracing.startStream('sess_1', { agent: { name: 'support-bot' } });
 * await client.tracing.appendEvent('sess_1', {
 *   type: 'llm_end',
 *   inputTokens: 120,
 *   outputTokens: 80,
 * });
 * await client.tracing.endStream('sess_1', { status: 'success' });
 * ```
 */
export class TracingResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Ingest a complete tracing session in a single request.
   * Idempotent — sending the same sessionId again will upsert.
   */
  async ingest(
    data: TracingSessionRequest,
  ): Promise<{ success: boolean; sessionId: string; eventsStored: number }> {
    return this.http.request('POST', '/api/client/v1/tracing/sessions', {
      body: data,
    });
  }

  /** Open a streaming tracing session. */
  async startStream(
    sessionId: string,
    data: TracingStreamStartRequest = {},
  ): Promise<TracingStreamStartResponse> {
    return this.http.request<TracingStreamStartResponse>(
      'POST',
      `/api/client/v1/tracing/sessions/stream/${encodeURIComponent(sessionId)}/start`,
      { body: data },
    );
  }

  /** Append one event to a streaming session. */
  async appendEvent(
    sessionId: string,
    event: TracingEvent,
  ): Promise<TracingStreamEventResponse> {
    return this.http.request<TracingStreamEventResponse>(
      'POST',
      `/api/client/v1/tracing/sessions/stream/${encodeURIComponent(sessionId)}/events`,
      { body: { event } },
    );
  }

  /** Close a streaming session, optionally posting final summary/errors. */
  async endStream(
    sessionId: string,
    data: TracingStreamEndRequest = {},
  ): Promise<TracingStreamEndResponse> {
    return this.http.request<TracingStreamEndResponse>(
      'POST',
      `/api/client/v1/tracing/sessions/stream/${encodeURIComponent(sessionId)}/end`,
      { body: data },
    );
  }

  /**
   * Ingest OTLP/HTTP JSON spans directly (mirrors what
   * `CognipeerOTelSpanExporter` does under the hood). Useful when you already
   * have an OTLP payload from another exporter.
   */
  async ingestOtlp(payload: OtlpExportTraceServiceRequest): Promise<OtlpIngestResponse> {
    return this.http.request<OtlpIngestResponse>('POST', '/api/client/v1/traces', {
      body: payload,
    });
  }
}
