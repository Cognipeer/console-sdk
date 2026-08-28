import { describe, it, expect } from 'vitest';
import { SpendResource, BudgetsResource } from './spend';
import { createMockHttp } from '../test/mockHttp';
import type { Budget, BudgetStatus, CreateBudgetRequest, SpendReport, UpdateBudgetRequest } from '../types';

describe('SpendResource', () => {
  it('fetches a spend report with query filters via GET /api/client/v1/spend/report', async () => {
    const http = createMockHttp();
    const response: SpendReport = {
      object: 'spend.report',
      from: '2024-01-01',
      to: '2024-01-31',
      group_by: 'day',
      currency: 'USD',
      total_cost: 12.5,
      total_calls: 100,
      total_input_tokens: 1000,
      total_output_tokens: 500,
      total_tokens: 1500,
      by_model: [],
      timeseries: [],
    };
    http.request.mockResolvedValue(response);
    const resource = new SpendResource(http);

    const query = { group_by: 'day' as const, from: '2024-01-01' };
    const result = await resource.report(query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/spend/report', {
      query,
    });
  });

  it('passes an undefined query through when no filters are given', async () => {
    const http = createMockHttp();
    const response: SpendReport = {
      object: 'spend.report',
      from: null,
      to: null,
      group_by: 'day',
      currency: 'USD',
      total_cost: 0,
      total_calls: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      by_model: [],
      timeseries: [],
    };
    http.request.mockResolvedValue(response);
    const resource = new SpendResource(http);

    const result = await resource.report();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/spend/report', {
      query: undefined,
    });
  });
});

describe('BudgetsResource', () => {
  it('lists budgets via GET /api/client/v1/budgets', async () => {
    const http = createMockHttp();
    const budgets: Budget[] = [
      {
        id: 'budget_1',
        object: 'budget',
        label: 'LLM budget',
        description: null,
        domain: 'llm',
        scope: 'tenant',
        scope_id: null,
        project_id: null,
        daily_limit_usd: 10,
        monthly_limit_usd: 250,
        alert_thresholds: [0.5, 0.8],
        enabled: true,
        priority: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];
    http.request.mockResolvedValue({ data: budgets });
    const resource = new BudgetsResource(http);

    const result = await resource.list();

    expect(result).toBe(budgets);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/budgets');
  });

  it('returns an empty array when the budgets envelope has no data', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BudgetsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
  });

  it('creates a budget via POST /api/client/v1/budgets', async () => {
    const http = createMockHttp();
    const response: Budget = {
      id: 'budget_1',
      object: 'budget',
      label: 'LLM budget',
      description: null,
      domain: 'llm',
      scope: 'tenant',
      scope_id: null,
      project_id: null,
      daily_limit_usd: 10,
      monthly_limit_usd: 250,
      alert_thresholds: null,
      enabled: true,
      priority: 0,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    http.request.mockResolvedValue(response);
    const resource = new BudgetsResource(http);

    const data: CreateBudgetRequest = { monthly_limit_usd: 250, domain: 'llm' };
    const result = await resource.create(data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/budgets', { body: data });
  });

  it('updates a budget via PATCH /api/client/v1/budgets/{budgetId}', async () => {
    const http = createMockHttp();
    const response = { id: 'budget_1' } as Budget;
    http.request.mockResolvedValue(response);
    const resource = new BudgetsResource(http);

    const data: UpdateBudgetRequest = { monthly_limit_usd: 500 };
    const result = await resource.update('budget_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/budgets/budget_1', {
      body: data,
    });
  });

  it('encodes the budget id when updating', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({} as Budget);
    const resource = new BudgetsResource(http);

    await resource.update('budget/with space', { label: 'x' });

    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      `/api/client/v1/budgets/${encodeURIComponent('budget/with space')}`,
      { body: { label: 'x' } },
    );
  });

  it('deletes a budget via DELETE /api/client/v1/budgets/{budgetId}', async () => {
    const http = createMockHttp();
    const response = { deleted: true, id: 'budget_1' };
    http.request.mockResolvedValue(response);
    const resource = new BudgetsResource(http);

    const result = await resource.delete('budget_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/budgets/budget_1');
  });

  it('fetches budget status with query filters via GET /api/client/v1/budgets/status', async () => {
    const http = createMockHttp();
    const response: BudgetStatus = {
      object: 'budget.status',
      domain: 'llm',
      configured: true,
      per_day: { limit_usd: 10, used_usd: 1, remaining_usd: 9 },
      per_month: { limit_usd: 250, used_usd: 20, remaining_usd: 230 },
      alert_thresholds: [0.5, 0.8],
    };
    http.request.mockResolvedValue(response);
    const resource = new BudgetsResource(http);

    const query = { domain: 'llm' };
    const result = await resource.status(query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/budgets/status', {
      query,
    });
  });

  it('passes an undefined query through to status when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({} as BudgetStatus);
    const resource = new BudgetsResource(http);

    await resource.status();

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/budgets/status', {
      query: undefined,
    });
  });
});
