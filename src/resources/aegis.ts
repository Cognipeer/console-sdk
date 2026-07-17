import { HttpClient } from '../http';
import {
  AegisEvaluateRequest,
  AegisEvaluation,
  AegisAuditEvent,
  AegisShield,
} from '../types';

/**
 * Aegis enforcement-plane API resource (Enterprise module).
 *
 * Evaluates tool calls, retrievals and model I/O against a shield — an
 * enforcement instance with its own policy (tool allow/deny, egress and path
 * rules, side-effect classes) and DLP settings. Decisions are `allow`,
 * `redact`, `require_approval`, `sandbox` or `block`; every decision is
 * recorded on the shield's audit trail.
 *
 * Shields are created and configured in the Console dashboard
 * (`/dashboard/aegis`); the client surface evaluates against them and reads
 * them back. When no `shieldId` is given, the built-in `default` shield is
 * used.
 */
export class AegisResource {
  private http: HttpClient;
  public shields: AegisShieldsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.shields = new AegisShieldsResource(http);
  }

  /**
   * Evaluate a call against a shield's policy.
   *
   * A `require_approval` decision includes an `approval.approvalId`; once a
   * human approves it in the Console, re-run the SAME call with
   * `context.approvalToken` to proceed.
   *
   * @param params - Stage, actor, resource and optional shieldId/context
   */
  async evaluate(params: AegisEvaluateRequest): Promise<AegisEvaluation> {
    return this.http.request<AegisEvaluation>('POST', '/api/client/v1/aegis/evaluate', {
      body: params,
    });
  }
}

/**
 * Read-only access to the tenant's shields and their audit trails.
 */
export class AegisShieldsResource {
  constructor(private http: HttpClient) {}

  /** List the tenant's shields (including the built-in `default` shield). */
  async list(): Promise<AegisShield[]> {
    const res = await this.http.request<{ shields: AegisShield[] }>(
      'GET',
      '/api/client/v1/aegis/shields',
    );
    return res.shields ?? [];
  }

  /**
   * Read a shield's decision audit trail, newest first.
   * @param shieldId - Shield id (`'default'` for the built-in shield)
   * @param options - Optional limit (max 500) and decision filter
   */
  async audit(
    shieldId: string,
    options: { limit?: number; decision?: AegisEvaluation['decision'] } = {},
  ): Promise<AegisAuditEvent[]> {
    const res = await this.http.request<{ events: AegisAuditEvent[] }>(
      'GET',
      `/api/client/v1/aegis/shields/${encodeURIComponent(shieldId)}/audit`,
      { query: { limit: options.limit, decision: options.decision } },
    );
    return res.events ?? [];
  }
}
