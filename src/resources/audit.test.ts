import { describe, it, expect, vi } from 'vitest';
import { AuditResource } from './audit';
import { createMockHttp } from '../test/mockHttp';
import { AuditLog, AuditLogListResponse } from '../types';

describe('AuditResource', () => {
  it('lists audit logs via GET /api/client/v1/audit/logs with query params', async () => {
    const http = createMockHttp();
    const log: AuditLog = {
      id: 'log_1',
      tenantId: 'tenant_1',
      actorType: 'user',
      service: 'console',
      action: 'read',
      event: 'guardrail.viewed',
      outcome: 'denied',
    };
    const response: AuditLogListResponse = { object: 'list', data: [log] };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new AuditResource(http);

    const result = await resource.logs({ outcome: 'denied', limit: 50 });

    expect(result).toBe(response.data);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/audit/logs', {
      query: { outcome: 'denied', limit: 50 },
    });
  });

  it('passes an undefined query when called without arguments', async () => {
    const http = createMockHttp();
    const response: AuditLogListResponse = { object: 'list', data: [] };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new AuditResource(http);

    await resource.logs();

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/audit/logs', {
      query: undefined,
    });
  });

  it('falls back to an empty array when the response has no data field', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ object: 'list' } as AuditLogListResponse);
    const resource = new AuditResource(http);

    const result = await resource.logs({ q: 'login' });

    expect(result).toEqual([]);
  });
});
