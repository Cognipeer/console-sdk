import { describe, it, expect } from 'vitest';
import { PiiResource } from './pii';
import { createMockHttp } from '../test/mockHttp';
import type {
  PiiDetokenizeRequest,
  PiiDetokenizeResponse,
  PiiPolicy,
  PiiPolicyCreateRequest,
  PiiPolicyUpdateRequest,
  PiiScanRequest,
  PiiScanResponse,
} from '../types';

function makeScanResponse(overrides: Partial<PiiScanResponse> = {}): PiiScanResponse {
  return {
    policy_key: 'support-policy',
    policy_name: 'Support policy',
    action: 'redact',
    findings: [],
    output_text: 'Email me at [REDACTED_EMAIL]',
    input_length: 30,
    has_blocking: false,
    languages: ['en'],
    ...overrides,
  };
}

describe('PiiResource', () => {
  it('detects PII via POST /api/client/v1/pii/detect', async () => {
    const http = createMockHttp();
    const response = makeScanResponse({ action: 'detect' });
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const params: PiiScanRequest = { policy_key: 'support-policy', text: 'Email me at jane@example.com' };
    const result = await resource.detect(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/detect', { body: params });
  });

  it('redacts PII via POST /api/client/v1/pii/redact', async () => {
    const http = createMockHttp();
    const response = makeScanResponse({ action: 'redact' });
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const params: PiiScanRequest = { policy_key: 'support-policy', text: 'Email me at jane@example.com' };
    const result = await resource.redact(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/redact', { body: params });
  });

  it('masks PII via POST /api/client/v1/pii/mask', async () => {
    const http = createMockHttp();
    const response = makeScanResponse({ action: 'mask' });
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const params: PiiScanRequest = { policy_key: 'support-policy', text: 'Email me at jane@example.com' };
    const result = await resource.mask(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/mask', { body: params });
  });

  it('tokenizes PII via POST /api/client/v1/pii/tokenize', async () => {
    const http = createMockHttp();
    const response = makeScanResponse({
      action: 'tokenize',
      vault: { EMAIL_1: { value: 'jane@example.com', category: 'EMAIL' } },
    });
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const params: PiiScanRequest = { policy_key: 'support-policy', text: 'Email me at jane@example.com' };
    const result = await resource.tokenize(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/tokenize', { body: params });
  });

  it('scans PII with an action override via POST /api/client/v1/pii/scan', async () => {
    const http = createMockHttp();
    const response = makeScanResponse({ action: 'mask' });
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const params: PiiScanRequest = {
      policy_key: 'support-policy',
      text: 'Email me at jane@example.com',
      action: 'mask',
      locale: 'en',
    };
    const result = await resource.scan(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/scan', { body: params });
  });

  it('detokenizes text via POST /api/client/v1/pii/detokenize', async () => {
    const http = createMockHttp();
    const response: PiiDetokenizeResponse = { output_text: 'Email me at jane@example.com' };
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const params: PiiDetokenizeRequest = {
      text: 'Email me at [EMAIL_1]',
      vault: { EMAIL_1: { value: 'jane@example.com', category: 'EMAIL' } },
    };
    const result = await resource.detokenize(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/detokenize', { body: params });
  });

  it('creates a PII policy via POST /api/client/v1/pii/policies', async () => {
    const http = createMockHttp();
    const policy: PiiPolicy = {
      id: 'policy_1',
      tenantId: 'tenant_1',
      key: 'support-policy',
      name: 'Support policy',
      defaultAction: 'redact',
      categories: { EMAIL: true },
      enabled: true,
      createdBy: 'user_1',
    };
    http.request.mockResolvedValue({ policy });
    const resource = new PiiResource(http);

    const params: PiiPolicyCreateRequest = { name: 'Support policy', defaultAction: 'redact' };
    const result = await resource.createPolicy(params);

    expect(result).toBe(policy);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/pii/policies', { body: params });
  });

  it('updates a PII policy via PATCH /api/client/v1/pii/policies/{key}', async () => {
    const http = createMockHttp();
    const policy: PiiPolicy = {
      id: 'policy_1',
      tenantId: 'tenant_1',
      key: 'support-policy',
      name: 'Support policy v2',
      defaultAction: 'mask',
      categories: { EMAIL: true },
      enabled: true,
      createdBy: 'user_1',
    };
    http.request.mockResolvedValue({ policy });
    const resource = new PiiResource(http);

    const params: PiiPolicyUpdateRequest = { name: 'Support policy v2', defaultAction: 'mask' };
    const result = await resource.updatePolicy('support-policy', params);

    expect(result).toBe(policy);
    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      '/api/client/v1/pii/policies/support-policy',
      { body: params },
    );
  });

  it('encodes the policy key when updating', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ policy: {} as PiiPolicy });
    const resource = new PiiResource(http);

    await resource.updatePolicy('policy/with space', { name: 'x' });

    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      `/api/client/v1/pii/policies/${encodeURIComponent('policy/with space')}`,
      { body: { name: 'x' } },
    );
  });

  it('deletes a PII policy via DELETE /api/client/v1/pii/policies/{key}', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new PiiResource(http);

    const result = await resource.deletePolicy('support-policy');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/pii/policies/support-policy');
  });

  it('encodes the policy key when deleting', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ success: true });
    const resource = new PiiResource(http);

    await resource.deletePolicy('policy/with space');

    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      `/api/client/v1/pii/policies/${encodeURIComponent('policy/with space')}`,
    );
  });
});
