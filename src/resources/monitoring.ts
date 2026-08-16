import { HttpClient } from '../http';
import { MonitoringInferenceQuery, MonitoringInferenceResponse } from '../types';

/**
 * Monitoring API resource — read-only inference-server metrics summary.
 * Inference servers are tenant-scoped (NOT project-scoped) and restricted to
 * owner/admin tokens or tokens with an explicit `inference-monitoring:read`
 * grant. Stored API keys are stripped from every echoed server.
 *
 * @example
 * ```typescript
 * const summary = await client.monitoring.inference();
 * console.log(summary.overview.active_servers, summary.overview.total_running_requests);
 * for (const server of summary.servers) {
 *   console.log(server.name, server.status, server.latest_metrics?.gpu_cache_usage_percent);
 * }
 * ```
 */
export class MonitoringResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Per-server latest metrics plus an aggregate overview and type breakdown. */
  async inference(query?: MonitoringInferenceQuery): Promise<MonitoringInferenceResponse> {
    return this.http.request<MonitoringInferenceResponse>(
      'GET',
      '/api/client/v1/monitoring/inference',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
  }
}
