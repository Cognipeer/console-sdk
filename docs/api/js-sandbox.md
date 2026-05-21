# JS Sandbox API

Run JavaScript inside a managed isolate. Useful as a tool target for agents
or for ad-hoc data shaping without spinning up your own runtime.

## Execute a snippet

```typescript
const exec = await client.jsSandbox.execute({
  code: `
    const total = variables.numbers.reduce((a, b) => a + b, 0);
    return { total, count: variables.numbers.length };
  `,
  variables: { numbers: [1, 2, 3, 4] },
  timeoutMs: 5_000,
});

console.log(exec.status);   // 'success'
console.log(exec.result);   // { total: 10, count: 4 }
console.log(exec.logs);     // captured console.* calls
console.log(exec.durationMs);
```

## List or inspect runtimes

```typescript
const runtimes = await client.jsSandbox.runtimes.list();
const def = await client.jsSandbox.runtimes.get('node-22-default');
```

## Types

```typescript
interface JsSandboxExecuteRequest {
  runtimeKey?: string;
  code: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

interface JsSandboxExecutionResult {
  executionId: string;
  runtimeKey: string;
  status: 'success' | 'error' | 'timeout' | string;
  durationMs?: number;
  result?: unknown;
  logs?: Array<{ level: string; message: string; args?: unknown[]; timestamp?: string }>;
  errorMessage?: string;
}
```
