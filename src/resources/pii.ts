import { HttpClient } from '../http';
import type {
  PiiDetokenizeRequest,
  PiiDetokenizeResponse,
  PiiPolicy,
  PiiPolicyCreateRequest,
  PiiPolicyUpdateRequest,
  PiiScanRequest,
  PiiScanResponse,
} from '../types';

/**
 * PII API resource.
 *
 * Every detection call is policy-based: pass a `policy_key` and the enabled
 * categories, custom patterns, languages and severities all come from that
 * stored policy. The named endpoints pin the action; `scan()` lets you
 * override it. The `tokenize` / `detokenize` pair is designed for an LLM
 * round-trip — tokenize the prompt, send it to a model, then detokenize the
 * model's response with the same vault (the vault is never persisted).
 *
 * @example
 * ```typescript
 * const policy = await client.pii.createPolicy({
 *   name: 'Support policy',
 *   defaultAction: 'redact',
 * });
 *
 * const result = await client.pii.redact({
 *   policy_key: policy.key,
 *   text: 'Email me at jane@example.com',
 * });
 * console.log(result.output_text);
 * ```
 */
export class PiiResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  // ── Detection ────────────────────────────────────────────────────────

  /** Detect PII against a policy without transforming the text. */
  async detect(params: PiiScanRequest): Promise<PiiScanResponse> {
    return this.http.request('POST', '/api/client/v1/pii/detect', { body: params });
  }

  /** Redact PII (`[REDACTED_X]`) against a policy. */
  async redact(params: PiiScanRequest): Promise<PiiScanResponse> {
    return this.http.request('POST', '/api/client/v1/pii/redact', { body: params });
  }

  /** Partially mask PII against a policy. */
  async mask(params: PiiScanRequest): Promise<PiiScanResponse> {
    return this.http.request('POST', '/api/client/v1/pii/mask', { body: params });
  }

  /** Reversibly tokenize PII (`[EMAIL_1]`) against a policy — returns a vault. */
  async tokenize(params: PiiScanRequest): Promise<PiiScanResponse> {
    return this.http.request('POST', '/api/client/v1/pii/tokenize', { body: params });
  }

  /** Scan with a policy, optionally overriding the action via `params.action`. */
  async scan(params: PiiScanRequest): Promise<PiiScanResponse> {
    return this.http.request('POST', '/api/client/v1/pii/scan', { body: params });
  }

  /** Restore original values from a vault returned by `tokenize()`. */
  async detokenize(params: PiiDetokenizeRequest): Promise<PiiDetokenizeResponse> {
    return this.http.request('POST', '/api/client/v1/pii/detokenize', { body: params });
  }

  // ── Policy authoring ─────────────────────────────────────────────────

  /**
   * Create a PII policy definition.
   * @param params Policy creation parameters (name required)
   */
  async createPolicy(params: PiiPolicyCreateRequest): Promise<PiiPolicy> {
    const res = await this.http.request<{ policy: PiiPolicy }>(
      'POST',
      '/api/client/v1/pii/policies',
      { body: params },
    );
    return res.policy;
  }

  /**
   * Update a PII policy definition.
   * @param key Policy key
   * @param params Fields to update
   */
  async updatePolicy(key: string, params: PiiPolicyUpdateRequest): Promise<PiiPolicy> {
    const res = await this.http.request<{ policy: PiiPolicy }>(
      'PATCH',
      `/api/client/v1/pii/policies/${encodeURIComponent(key)}`,
      { body: params },
    );
    return res.policy;
  }

  /**
   * Delete a PII policy definition.
   * @param key Policy key
   */
  async deletePolicy(key: string): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(
      'DELETE',
      `/api/client/v1/pii/policies/${encodeURIComponent(key)}`,
    );
  }
}
