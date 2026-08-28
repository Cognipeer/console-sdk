import { describe, it, expect, vi } from 'vitest';
import { GuardrailsResource } from './guardrails';
import { createMockHttp } from '../test/mockHttp';
import {
  Guardrail,
  GuardrailCreateRequest,
  GuardrailEvaluateRequest,
  GuardrailEvaluateResponse,
  GuardrailUpdateRequest,
} from '../types';

describe('GuardrailsResource', () => {
  const guardrail: Guardrail = {
    id: 'grd_1',
    tenantId: 'tenant_1',
    key: 'pii-guard',
    name: 'PII Guard',
    type: 'preset',
    target: 'input',
    action: 'block',
    enabled: true,
    createdBy: 'user_1',
  };

  it('evaluates text via POST /api/client/v1/guardrails/evaluate', async () => {
    const http = createMockHttp();
    const response: GuardrailEvaluateResponse = {
      passed: false,
      guardrail_key: 'pii-guard',
      guardrail_name: 'PII Guard',
      action: 'block',
      findings: [
        {
          type: 'pii',
          category: 'email',
          severity: 'medium',
          message: 'Email address detected',
          action: 'block',
          block: true,
        },
      ],
      message: 'Blocked due to PII',
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new GuardrailsResource(http);
    const params: GuardrailEvaluateRequest = {
      guardrail_key: 'pii-guard',
      text: 'contact me at a@b.com',
      target: 'input',
    };

    const result = await resource.evaluate(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/guardrails/evaluate', {
      body: params,
    });
  });

  it('creates a guardrail via POST /api/client/v1/guardrails and unwraps the guardrail field', async () => {
    const http = createMockHttp();
    vi.mocked(http.request).mockResolvedValue({ guardrail });
    const resource = new GuardrailsResource(http);
    const params: GuardrailCreateRequest = {
      name: 'PII Guard',
      type: 'preset',
      action: 'block',
    };

    const result = await resource.create(params);

    expect(result).toBe(guardrail);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/guardrails', {
      body: params,
    });
  });

  it('updates a guardrail via PATCH /api/client/v1/guardrails/:key with the key encoded', async () => {
    const http = createMockHttp();
    const updated: Guardrail = { ...guardrail, enabled: false };
    vi.mocked(http.request).mockResolvedValue({ guardrail: updated });
    const resource = new GuardrailsResource(http);
    const params: GuardrailUpdateRequest = { enabled: false };

    const result = await resource.update('pii guard', params);

    expect(result).toBe(updated);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/guardrails/pii%20guard', {
      body: params,
    });
  });

  it('deletes a guardrail via DELETE /api/client/v1/guardrails/:key with the key encoded', async () => {
    const http = createMockHttp();
    const response = { success: true };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new GuardrailsResource(http);

    const result = await resource.delete('pii/guard');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/guardrails/pii%2Fguard',
    );
  });
});
