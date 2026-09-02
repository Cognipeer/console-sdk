import { HttpClient } from '../http';
import type {
  Guardrail,
  GuardrailCreateRequest,
  GuardrailEvaluateRequest,
  GuardrailEvaluateResponse,
  GuardrailHookEvaluateParams,
  GuardrailHookEvaluateResponse,
  GuardrailListItem,
  GuardrailListQuery,
  GuardrailUpdateRequest,
  HookVerdict,
} from '../types';

/**
 * Whether a verdict actually blocks the call.
 *
 * THE ONE RULE, encoded once so no call site re-derives it:
 * a verdict blocks only when its EFFECTIVE `decision` is `'block'` **and** it
 * was `enforced`. A guardrail in monitor mode reports what it would have done
 * without applying it, so `decision === 'block' && enforced === false` means
 * the decision was NOT applied and the call must proceed.
 *
 * Do not branch on `passed` instead: `passed` means "no blocking finding", not
 * "the request was not blocked", and the two diverge in exactly that mode.
 *
 * Accepts either shape the API returns — the camelCase {@link HookVerdict} on
 * `evaluate().verdict` and the snake_case body of `hooks.evaluate()` — since
 * `decision` and `enforced` are spelled the same on both.
 *
 * @example
 * ```typescript
 * const verdict = await client.guardrails.hooks.evaluate({
 *   hook: 'tool.pre',
 *   guardrail_key: 'tool-policy',
 *   tool_name: 'files/delete',
 *   tool_args: { path: '/etc/passwd' },
 * });
 *
 * if (shouldBlock(verdict)) {
 *   // `blocked_message.mode` decides HOW to refuse: 'error' rejects,
 *   // 'replace' substitutes `body` for the response.
 *   throw new Error(verdict.blocked_message?.body ?? 'Blocked by guardrail');
 * }
 * ```
 */
export function shouldBlock(
  verdict: Pick<HookVerdict, 'decision' | 'enforced'> | null | undefined,
): boolean {
  if (!verdict) return false;
  return verdict.decision === 'block' && verdict.enforced === true;
}

/**
 * Guardrails API resource
 */
export class GuardrailsResource {
  private http: HttpClient;

  /** Evaluate a single hook of the guardrail plane. */
  public hooks: GuardrailHooksResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.hooks = new GuardrailHooksResource(http);
  }

  /**
   * List the guardrail definitions this API token can address.
   *
   * The tenant and project come from the token, so the result is exactly the
   * set `evaluate` and `hooks.evaluate` accept by key: the token's own project
   * plus workspace-level guardrails that belong to no project.
   *
   * @param filters - Optional `enabled` / `type` / `search` filters
   */
  async list(filters?: GuardrailListQuery): Promise<GuardrailListItem[]> {
    const response = await this.http.request<{ guardrails: GuardrailListItem[] }>(
      'GET',
      '/api/client/v1/guardrails',
      { query: filters as Record<string, string | number | boolean | undefined> },
    );
    return response.guardrails ?? [];
  }

  /**
   * Evaluate text against a configured guardrail.
   *
   * The legacy shape, unchanged: always answers 200, findings or not. To decide
   * whether to refuse the call use {@link shouldBlock}(result.verdict) rather
   * than `!result.passed` — `passed` reports whether a BLOCKING FINDING exists,
   * which is not the same thing in monitor mode.
   *
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

/**
 * The hook plane: ask the Console what the policy says about one hook, from
 * wherever the model or the tool actually runs.
 *
 * Five hooks — `input.pre`, `output.pre`, `output.stream.delta`, `tool.pre`,
 * `tool.post` — each with its own subject. The parameters are discriminated on
 * `hook`, so a `tool.pre` call will not compile without `tool_name` and a
 * `tool.post` call will not compile without `tool_result`.
 */
export class GuardrailHooksResource {
  constructor(private http: HttpClient) {}

  /**
   * Evaluate ONE hook against one or more guardrails; several guardrails merge
   * into a single verdict by max() over the action ladder.
   *
   * Reading the answer:
   * - `shouldBlock(verdict)` — the only correct enforcement test. `decision` is
   *   already neutralised in monitor mode and `enforced: false` means the
   *   decision was NOT applied.
   * - `blocked_message` — an OBJECT. `mode: 'error'` means reject with `body`
   *   and `status`; `mode: 'replace'` means answer normally with `body`
   *   substituted for the response.
   * - `redacted_text` / `subject` — present only when a mutation was applied.
   *   Send those onwards instead of what you submitted.
   * - `disabled: true` — nothing ran, so `decision: 'allow'` is vacuous rather
   *   than a statement that the content is safe.
   *
   * An unknown `guardrail_key` is a 404 ({@link CognipeerAPIError}), never a
   * silent allow.
   *
   * @param params - Hook id, guardrail key(s), the subject for that hook, and
   *   optional `only` / `shadow` / `budget_ms` / `request_id`
   */
  async evaluate(params: GuardrailHookEvaluateParams): Promise<GuardrailHookEvaluateResponse> {
    return this.http.request<GuardrailHookEvaluateResponse>(
      'POST',
      '/api/client/v1/guardrails/hooks/evaluate',
      {
        body: params,
        // 246 (passed with findings) and 446 (blocked) are the extended verdict
        // statuses a guardrail can opt into. Both carry a complete verdict body,
        // so they are results, not failures. 246 is already 2xx; 446 is not, and
        // without listing it here a blocking guardrail would reject with a
        // transport error — the SDK would tell a caller that the request failed
        // rather than that its content was blocked, and a `catch` treating that
        // as an outage would fail OPEN on precisely the call that should stop.
        acceptStatuses: [246, 446],
      },
    );
  }
}
