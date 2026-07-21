import { HttpClient } from '../http';
import {
  AnalyticsOverviewQuery,
  AnalyticsOverviewResponse,
  AnalyticsUsageQuery,
  AnalyticsUsageResponse,
} from '../types';

/**
 * Analytics API resource — read-only observability derived from the same
 * services that back the dashboard UI. All reads are tenant + project scoped
 * via the API token.
 *
 * @example
 * ```typescript
 * // Per-model usage time-series
 * const usage = await client.analytics.usage({ group_by: 'model', interval: 'day' });
 *
 * // Dashboard rollup (stats + recent sessions + daily counts)
 * const overview = await client.analytics.overview({ from: '2026-07-01' });
 * console.log(overview.stats.apiCalls.total);
 * ```
 */
export class AnalyticsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Usage time-series / breakdown. The response shape depends on `group_by`:
   *   - `model`   → `{ by_model, timeseries }`
   *   - `service` → `{ breakdown }` (per-service requests/tokens/cost)
   *   - `user` / `token` → `{ breakdown }` (per-entity attribution)
   *
   * Defaults to `group_by='model'`, `interval='day'`.
   */
  async usage(query?: AnalyticsUsageQuery): Promise<AnalyticsUsageResponse> {
    return this.http.request<AnalyticsUsageResponse>(
      'GET',
      '/api/client/v1/analytics/usage',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
  }

  /** Dashboard rollup — stats, recent tracing sessions, and daily counts. */
  async overview(query?: AnalyticsOverviewQuery): Promise<AnalyticsOverviewResponse> {
    return this.http.request<AnalyticsOverviewResponse>(
      'GET',
      '/api/client/v1/analytics/overview',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
  }
}
