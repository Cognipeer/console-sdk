import { describe, it, expect } from 'vitest';
import { AegisResource, AegisShieldsResource } from './aegis';
import { createMockHttp } from '../test/mockHttp';
import type { AegisAuditEvent, AegisEvaluateRequest, AegisEvaluation, AegisShield } from '../types';

describe('AegisResource', () => {
  it('evaluates a call against a shield via POST /api/client/v1/aegis/evaluate', async () => {
    const http = createMockHttp();
    const response: AegisEvaluation = {
      traceId: 'trace_1',
      shieldId: 'default',
      shieldMode: 'enforce',
      decision: 'allow',
      enforced: true,
      riskScore: 0.05,
      reasons: [],
      policyVersion: 'v1',
      findings: [],
      mutations: [],
    };
    http.request.mockResolvedValue(response);
    const resource = new AegisResource(http);

    const params: AegisEvaluateRequest = {
      stage: 'tool.pre',
      actor: { id: 'user_1', roles: ['member'] },
      resource: { type: 'tool', name: 'search', arguments: { query: 'weather' } },
    };
    const result = await resource.evaluate(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/aegis/evaluate', {
      body: params,
    });
  });
});

describe('AegisShieldsResource', () => {
  it('lists shields via GET /api/client/v1/aegis/shields', async () => {
    const http = createMockHttp();
    const shields: AegisShield[] = [
      {
        id: 'default',
        name: 'Default shield',
        mode: 'enforce',
        rules: {},
        dlp: { redactSecrets: true, redactPii: true },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    http.request.mockResolvedValue({ shields });
    const resource = new AegisShieldsResource(http);

    const result = await resource.list();

    expect(result).toBe(shields);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/aegis/shields');
  });

  it('returns an empty array when the shields envelope has no shields', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new AegisShieldsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
  });

  it('reads a shield audit trail with limit/decision filters via GET .../shields/{shieldId}/audit', async () => {
    const http = createMockHttp();
    const events: AegisAuditEvent[] = [
      {
        traceId: 'trace_1',
        shieldId: 'default',
        actorId: 'user_1',
        stage: 'tool.pre',
        resourceName: 'search',
        decision: 'allow',
        riskScore: 0.1,
        reasons: [],
        policyVersion: 'v1',
        at: '2024-01-01T00:00:00.000Z',
      },
    ];
    http.request.mockResolvedValue({ events });
    const resource = new AegisShieldsResource(http);

    const result = await resource.audit('default', { limit: 10, decision: 'allow' });

    expect(result).toBe(events);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/aegis/shields/default/audit',
      { query: { limit: 10, decision: 'allow' } },
    );
  });

  it('defaults limit/decision to undefined when no options are given', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ events: [] });
    const resource = new AegisShieldsResource(http);

    await resource.audit('default');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/aegis/shields/default/audit',
      { query: { limit: undefined, decision: undefined } },
    );
  });

  it('encodes the shield id into the audit path', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ events: [] });
    const resource = new AegisShieldsResource(http);

    await resource.audit('shield/with space');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/aegis/shields/${encodeURIComponent('shield/with space')}/audit`,
      { query: { limit: undefined, decision: undefined } },
    );
  });
});
