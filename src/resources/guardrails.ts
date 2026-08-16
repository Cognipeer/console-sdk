import { HttpClient } from '../http';
import type {
  Guardrail,
  GuardrailCreateRequest,
  GuardrailEvaluateRequest,
  GuardrailEvaluateResponse,
  GuardrailUpdateRequest,
} from '../types';

/**
 * Guardrails API resource
 */
export class GuardrailsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Evaluate text against a configured guardrail.
   * @param data - Guardrail evaluation payload
   */
  async evaluate(data: GuardrailEvaluateRequest): Promise<GuardrailEvaluateResponse> {
    return this.http.request('POST', '/api/client/v1/guardrails/evaluate', {
      body: data,
    });
  }

  /**
   * Create a guardrail definition.
   * @param params - Guardrail creation parameters (name + type required)
   */
  async create(params: GuardrailCreateRequest): Promise<Guardrail> {
    const response = await this.http.request<{ guardrail: Guardrail }>(
      'POST',
      '/api/client/v1/guardrails',
      { body: params },
    );
    return response.guardrail;
  }

  /**
   * Update a guardrail definition.
   * @param key - Guardrail key
   * @param params - Fields to update
   */
  async update(key: string, params: GuardrailUpdateRequest): Promise<Guardrail> {
    const response = await this.http.request<{ guardrail: Guardrail }>(
      'PATCH',
      `/api/client/v1/guardrails/${encodeURIComponent(key)}`,
      { body: params },
    );
    return response.guardrail;
  }

  /**
   * Delete a guardrail definition.
   * @param key - Guardrail key
   */
  async delete(key: string): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(
      'DELETE',
      `/api/client/v1/guardrails/${encodeURIComponent(key)}`,
    );
  }
}
