import { HttpClient } from '../http';
import { TracingSessionRequest } from '../types';

/**
 * Tracing API resource
 */
export class TracingResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Ingest a tracing session
   * @param data - Tracing session data
   */
  async ingest(data: TracingSessionRequest): Promise<{ success: boolean; sessionId: string }> {
    return this.http.request('POST', '/api/client/v1/tracing/sessions', {
      body: data,
    });
  }
}
