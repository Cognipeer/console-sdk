import { HttpClient } from '../http';
import {
  Budget,
  BudgetStatus,
  CreateBudgetRequest,
  ListSpendReportQuery,
  SpendReport,
  UpdateBudgetRequest,
} from '../types';

/**
 * Spend API resource — cost reporting rolled up from the model usage logs.
 *
 * @example
 * ```typescript
 * const report = await client.spend.report({ group_by: 'day' });
 * console.log(report.total_cost, report.currency);
 * for (const m of report.by_model) console.log(m.model_key, m.cost);
 * ```
 */
export class SpendResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Spend totals, per-model breakdown, and a merged timeseries. */
  async report(query?: ListSpendReportQuery): Promise<SpendReport> {
    return this.http.request<SpendReport>(
      'GET',
      '/api/client/v1/spend/report',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
  }
}

/**
 * Budgets API resource — spend caps enforced by the quota guard on every
 * inference/batch request.
 *
 * Creating or changing budgets requires an owner/admin API token.
 *
 * @example
 * ```typescript
 * await client.budgets.create({ monthly_limit_usd: 250 });
 * const status = await client.budgets.status({ domain: 'llm' });
 * console.log(status.per_month.used_usd, '/', status.per_month.limit_usd);
 * ```
 */
export class BudgetsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List budget policies. */
  async list(): Promise<Budget[]> {
    const res = await this.http.request<{ data: Budget[] }>(
      'GET',
      '/api/client/v1/budgets',
    );
    return res.data ?? [];
  }

  /** Create a budget policy (owner/admin token required). */
  async create(data: CreateBudgetRequest): Promise<Budget> {
    return this.http.request<Budget>('POST', '/api/client/v1/budgets', { body: data });
  }

  /** Update limits/thresholds of a budget policy. */
  async update(budgetId: string, data: UpdateBudgetRequest): Promise<Budget> {
    return this.http.request<Budget>(
      'PATCH',
      `/api/client/v1/budgets/${encodeURIComponent(budgetId)}`,
      { body: data },
    );
  }

  /** Delete a budget policy. */
  async delete(budgetId: string): Promise<{ deleted: boolean; id: string }> {
    return this.http.request<{ deleted: boolean; id: string }>(
      'DELETE',
      `/api/client/v1/budgets/${encodeURIComponent(budgetId)}`,
    );
  }

  /** Current usage vs limits for the daily and monthly windows. */
  async status(query?: { domain?: string; model?: string; scope?: 'tenant' | 'token' }): Promise<BudgetStatus> {
    return this.http.request<BudgetStatus>(
      'GET',
      '/api/client/v1/budgets/status',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
  }
}
