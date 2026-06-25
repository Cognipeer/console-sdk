# Spend & Budgets API

Report on model spend rolled up from usage logs, and enforce spend caps with budget policies. Spend lives on `client.spend`; budgets live on `client.budgets`.

## Overview

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });
```

## Spend report

```typescript
const report = await client.spend.report({ group_by: 'day' });

console.log(report.total_cost, report.currency);
for (const m of report.by_model) {
  console.log(m.model_key, m.cost);
}
```

`report()` returns the spend total, a per-model breakdown, and a merged timeseries. Narrow it with query options such as `group_by` and a date range.

## Budgets

Budgets are spend caps enforced by the quota guard on every inference and batch request. Creating or changing them requires an **owner/admin** API token.

```typescript
// Create a monthly cap
await client.budgets.create({ monthly_limit_usd: 250 });

// List, update, delete
const budgets = await client.budgets.list();
await client.budgets.update(budgets[0].id, { monthly_limit_usd: 500 });
await client.budgets.delete(budgets[0].id);
```

### Check current usage

```typescript
const status = await client.budgets.status({ domain: 'llm' });
console.log(status.per_month.used_usd, '/', status.per_month.limit_usd);
console.log(status.per_day.used_usd, '/', status.per_day.limit_usd);
```

`status()` accepts an optional `{ domain, model, scope }` filter (`scope` is `tenant` or `token`).

## Methods

| Method | HTTP | Description |
| --- | --- | --- |
| `spend.report(query?)` | `GET /api/client/v1/spend/report` | Totals, per-model breakdown, timeseries |
| `budgets.list()` | `GET /api/client/v1/budgets` | List budget policies |
| `budgets.create(data)` | `POST /api/client/v1/budgets` | Create a budget (owner/admin) |
| `budgets.update(id, data)` | `PATCH /api/client/v1/budgets/:id` | Update limits/thresholds |
| `budgets.delete(id)` | `DELETE /api/client/v1/budgets/:id` | Delete a budget |
| `budgets.status(query?)` | `GET /api/client/v1/budgets/status` | Usage vs limits (day/month) |
