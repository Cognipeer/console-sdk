import { HttpClient } from '../http';
import type { GuardrailEvaluateRequest, GuardrailEvaluateResponse } from '../types';

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
}
