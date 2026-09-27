import { HttpClient } from '../http';
import { CognipeerError } from '../types';
import {
  AegisEvaluateRequest,
  AegisEvaluation,
  AegisAuditEvent,
  AegisShield,
} from '../types';

/**
 * Common tail on every Aegis migration error: what replaced the concepts, and
 * when the surface disappears for good.
 */
const REMOVAL_NOTICE =
  'The Aegis enforcement plane has been removed from the Console and '
  + '/api/client/v1/aegis/* no longer exists. `client.aegis` is kept only so 1.x '
  + 'builds keep compiling and is removed in the next major.';

function removed(what: string, replacement: string): CognipeerError {
  return new CognipeerError(`${what} is removed. ${replacement} ${REMOVAL_NOTICE}`);
}

/**
 * Aegis enforcement-plane API resource.
 *
 * @deprecated Removed from the Console — every method now throws instead of
 * issuing a request that would 404. Use `client.guardrails` instead:
 *
 * - a **shield** is a **guardrail**: `shields.list()` → `guardrails.list()`,
 *   and `shieldId` → `guardrail_key`;
 * - `evaluate({ stage, resource })` →
 *   `guardrails.hooks.evaluate({ hook, tool_name, tool_args })`;
 * - the stage names carry over unchanged — `tool.pre`, `tool.post`,
 *   `input.pre` and `output.pre` are hook ids as they stand. `retrieval.pre`
 *   and `retrieval.post` have no hook and no replacement;
 * - the decision is read with `shouldBlock(verdict)`:
 *   `decision === 'block' && enforced === false` does NOT block.
 *
 * Removed entirely in the next major.
 */
export class AegisResource {
  /**
   * @deprecated Shields are guardrails now — use `client.guardrails`
   * (`list`/`create`/`update`/`delete`). Every method here rejects.
   */
  public shields: AegisShieldsResource;

  /** @deprecated Constructed by `ConsoleClient` for backwards compatibility
   *  only; the resource issues no requests. */
  constructor(_http?: HttpClient) {
    this.shields = new AegisShieldsResource();
  }

  /**
   * Evaluate a call against a shield's policy.
   *
   * @deprecated Use `client.guardrails.hooks.evaluate(...)`. `stage` becomes
   * `hook` (`tool.pre` / `tool.post` / `input.pre` / `output.pre` keep their
   * names), `shieldId` becomes `guardrail_key`, and `resource` splits into
   * `tool_name` / `tool_args` — plus `tool_result` on `tool.post`. Rejects;
   * removed in the next major.
   *
   * @returns A promise that always REJECTS with a {@link CognipeerError}.
   */
  evaluate(_params: AegisEvaluateRequest): Promise<AegisEvaluation> {
    // REJECT, do not throw. The signature promises a Promise, so a 1.x caller
    // written as `client.aegis.evaluate(...).catch(handle)` gets a synchronous
    // exception past its own error handling if this throws — the migration
    // message would surface as an unhandled error rather than in the catch
    // block the caller already has.
    return Promise.reject(removed(
      'client.aegis.evaluate()',
      'Use client.guardrails.hooks.evaluate({ hook, guardrail_key, ... }): `stage` '
        + 'is now `hook` (tool.pre, tool.post, input.pre and output.pre are unchanged; '
        + 'retrieval.pre and retrieval.post have no equivalent), `shieldId` is now '
        + '`guardrail_key`, and `resource` becomes `tool_name` + `tool_args` (plus '
        + '`tool_result` on tool.post). Decide with shouldBlock(verdict) — a verdict '
        + 'with decision "block" and enforced false must NOT block.',
    ));
  }
}

/**
 * Read-only access to the tenant's shields and their audit trails.
 *
 * @deprecated Shields are guardrails — use `client.guardrails`. Every method
 * rejects; removed in the next major.
 */
export class AegisShieldsResource {
  /** @deprecated Constructed by {@link AegisResource} only; issues no
   *  requests. */
  constructor(_http?: HttpClient) {}

  /**
   * List the tenant's shields.
   *
   * @deprecated Use `client.guardrails.list()` — it returns the guardrails
   * this token can address, each with the hooks it can serve
   * (`hooksSummary.servable`). Rejects; removed in the next major.
   *
   * @returns A promise that always REJECTS with a {@link CognipeerError}.
   */
  list(): Promise<AegisShield[]> {
    return Promise.reject(removed(
      'client.aegis.shields.list()',
      'Shields are guardrails now: use client.guardrails.list(), and pass a '
        + 'guardrail `key` wherever you passed a `shieldId`.',
    ));
  }

  /**
   * Read a shield's decision audit trail.
   *
   * @deprecated There is no client-API replacement: guardrail decisions are
   * recorded as evaluation logs and read in the Console dashboard. Every
   * verdict carries `trace_id` and `policy_version` to correlate against them.
   * Rejects; removed in the next major.
   *
   * @returns A promise that always REJECTS with a {@link CognipeerError}.
   */
  audit(
    _shieldId: string,
    _options: { limit?: number; decision?: AegisEvaluation['decision'] } = {},
  ): Promise<AegisAuditEvent[]> {
    return Promise.reject(removed(
      'client.aegis.shields.audit()',
      'Guardrail decisions are recorded as evaluation logs and read in the Console '
        + 'dashboard; there is no client-API equivalent. Correlate with the '
        + '`trace_id` and `policy_version` on each verdict.',
    ));
  }
}
