import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  if (!apiKey) throw new Error('COGNIPEER_API_KEY is required');

  const client = new ConsoleClient({
    apiKey,
    ...(process.env.COGNIPEER_BASE_URL ? { baseURL: process.env.COGNIPEER_BASE_URL } : {}),
  });

  const runtimes = await client.jsSandbox.runtimes.list();
  console.log('Available runtimes:', runtimes.map((r) => `${r.key} (${r.status})`));

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

  console.log('Status :', exec.status);
  console.log('Result :', exec.result);
  console.log('Logs   :', exec.logs);
  console.log('Took   :', exec.durationMs, 'ms');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
