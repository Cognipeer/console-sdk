import { describe, it, expect, vi } from 'vitest';
import { MonitoringResource } from './monitoring';
import { createMockHttp } from '../test/mockHttp';
import { MonitoringInferenceResponse } from '../types';

describe('MonitoringResource', () => {
  const response: MonitoringInferenceResponse = {
    object: 'monitoring.inference',
    overview: {
      active_servers: 2,
      avg_gpu_cache_usage: 0.42,
      disabled_servers: 1,
      errored_servers: 0,
      running_models_count: 3,
      total_running_requests: 5,
      total_servers: 3,
      total_waiting_requests: 1,
    },
    servers: [
      {
        key: 'server-1',
        name: 'Primary vLLM',
        type: 'vllm',
        status: 'active',
        last_error: null,
        last_polled_at: '2026-08-01T00:00:00.000Z',
        latest_metrics: {
          gpu_cache_usage_percent: 42.5,
          num_requests_running: 2,
          num_requests_waiting: 1,
          running_models: ['llama-3-8b'],
          timestamp: '2026-08-01T00:00:00.000Z',
        },
      },
    ],
    type_breakdown: [{ count: 2, type: 'vllm' }],
  };

  it('fetches inference metrics via GET /api/client/v1/monitoring/inference with a query', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new MonitoringResource(http);

    const result = await resource.inference({ from: '2026-07-01', to: '2026-07-31' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/monitoring/inference', {
      query: { from: '2026-07-01', to: '2026-07-31' },
    });
  });

  it('passes an undefined query when called without arguments', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new MonitoringResource(http);

    const result = await resource.inference();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/monitoring/inference', {
      query: undefined,
    });
  });
});
