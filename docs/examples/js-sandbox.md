# JS Sandbox Example

Execute a JavaScript snippet inside a managed isolate, capture its return
value and console output, then inspect the run's duration.

## Run the example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com  # optional
export COGNIPEER_JS_RUNTIME_KEY=node-22-default              # optional
npm run example:js-sandbox
```

## Code

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const exec = await client.jsSandbox.execute({
  runtimeKey: process.env.COGNIPEER_JS_RUNTIME_KEY,
  code: `
    const sum = variables.numbers.reduce((a, b) => a + b, 0);
    console.log('summed', variables.numbers.length, 'numbers');
    return { sum, count: variables.numbers.length };
  `,
  variables: { numbers: [1, 1, 2, 3, 5, 8, 13, 21] },
  timeoutMs: 5_000,
});

console.log(exec.status, exec.result);
```

## Notes

- `code` is evaluated as a function body; use `return` to surface the result.
- `variables` is exposed as a `variables` global inside the sandbox.
- `console.log` / `console.error` etc. are captured into `exec.logs`.
- The runtime enforces `timeoutMs`; on overrun `status === 'timeout'`.
- `client.jsSandbox.runtimes.list()` shows which runtimes are available.
