import { describe, it, expect, vi } from 'vitest';
import { AutomationsResource } from './automations';
import { createMockHttp } from '../test/mockHttp';
import { Automation } from '../types';

describe('AutomationsResource', () => {
  const automation: Automation = {
    key: 'daily-report',
    name: 'Daily Report',
    status: 'idle',
  };

  it('lists automations via GET /api/client/v1/automations', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ automations: [automation] });
    const resource = new AutomationsResource(http);

    const result = await resource.list();

    expect(result).toEqual([automation]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/automations');
  });

  it('falls back to an empty array when the response has no automations field', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({});
    const resource = new AutomationsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
  });

  it('fetches a single automation via GET /api/client/v1/automations/:key with the key encoded', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ automation });
    const resource = new AutomationsResource(http);

    const result = await resource.get('daily report');

    expect(result).toBe(automation);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/automations/daily%20report',
    );
  });

  it('runs an automation via POST /api/client/v1/automations/:key/run', async () => {
    const http = createMockHttp();
    const running: Automation = { ...automation, status: 'running' };
    vi.mocked(http.request).mockResolvedValue({ automation: running });
    const resource = new AutomationsResource(http);

    const result = await resource.run('daily-report');

    expect(result).toBe(running);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/automations/daily-report/run',
    );
  });

  it('pauses an automation via POST /api/client/v1/automations/:key/pause', async () => {
    const http = createMockHttp();
    const paused: Automation = { ...automation, status: 'paused' };
    vi.mocked(http.request).mockResolvedValue({ automation: paused });
    const resource = new AutomationsResource(http);

    const result = await resource.pause('daily-report');

    expect(result).toBe(paused);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/automations/daily-report/pause',
    );
  });

  it('resumes an automation via POST /api/client/v1/automations/:key/resume', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ automation });
    const resource = new AutomationsResource(http);

    const result = await resource.resume('daily-report');

    expect(result).toBe(automation);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/automations/daily-report/resume',
    );
  });
});
