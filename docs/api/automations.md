# Automations API

Built-in scheduled jobs (housekeeping, retention sweeps, etc). Use this API
to inspect their current state and override scheduling decisions.

## Methods

```typescript
const all = await client.automations.list();
const job = await client.automations.get('retention-sweep');

await client.automations.pause('retention-sweep');
await client.automations.resume('retention-sweep');

// Trigger immediately
const run = await client.automations.run('retention-sweep');
console.log(run.status, run.lastRunAt);
```

## Types

```typescript
interface Automation {
  key: string;
  name: string;
  description?: string;
  schedule?: string;
  status: 'idle' | 'running' | 'paused' | 'errored';
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
}
```
