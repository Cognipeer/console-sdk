import { describe, it, expect, vi } from 'vitest';
import { AnalyticsResource } from './analytics';
import { createMockHttp } from '../test/mockHttp';
import {
  AnalyticsOverviewResponse,
  AnalyticsUsageQuery,
  AnalyticsUsageResponse,
} from '../types';

describe('AnalyticsResource', () => {
  it('fetches usage via GET /api/client/v1/analytics/usage with query params', async () => {
    const http = createMockHttp();
    const response: AnalyticsUsageResponse = {
      object: 'analytics.usage',
      group_by: 'model',
      interval: 'day',
      from: '2026-07-01',
      to: '2026-07-31',
      currency: 'USD',
      totals: { cost: 12.5, calls: 100, input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
      by_model: [],
      timeseries: [],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new AnalyticsResource(http);
    const query: AnalyticsUsageQuery = { group_by: 'model', interval: 'day', from: '2026-07-01' };

    const result = await resource.usage(query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/analytics/usage', {
      query,
    });
  });

  it('passes an undefined query to usage() when called without arguments', async () => {
    const http = createMockHttp();
    const response: AnalyticsUsageResponse = {
      object: 'analytics.usage',
      group_by: 'model',
      interval: 'day',
      from: null,
      to: null,
      currency: 'USD',
      totals: { cost: 0, calls: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      by_model: [],
      timeseries: [],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new AnalyticsResource(http);

    const result = await resource.usage();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/analytics/usage', {
      query: undefined,
    });
  });

  it('fetches the dashboard overview via GET /api/client/v1/analytics/overview with query params', async () => {
    const http = createMockHttp();
    const response: AnalyticsOverviewResponse = {
      object: 'analytics.overview',
      stats: {
        models: { total: 5, llm: 3, embedding: 2 },
        vectors: { providers: 1, indexes: 2 },
        tracing: { totalSessions: 10, totalTokens: 5000, activeSessions: 1 },
        apiCalls: { total: 200, trend: 12.5 },
      },
      recent_sessions: [],
      daily: [],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new AnalyticsResource(http);

    const result = await resource.overview({ from: '2026-07-01' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/analytics/overview', {
      query: { from: '2026-07-01' },
    });
  });

  it('passes an undefined query to overview() when called without arguments', async () => {
    const http = createMockHttp();
    const response: AnalyticsOverviewResponse = {
      object: 'analytics.overview',
      stats: {
        models: { total: 0, llm: 0, embedding: 0 },
        vectors: { providers: 0, indexes: 0 },
        tracing: { totalSessions: 0, totalTokens: 0, activeSessions: 0 },
        apiCalls: { total: 0, trend: 0 },
      },
      recent_sessions: [],
      daily: [],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new AnalyticsResource(http);

    const result = await resource.overview();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/analytics/overview', {
      query: undefined,
    });
  });
});
