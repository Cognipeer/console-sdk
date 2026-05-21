import { randomUUID } from 'node:crypto';
import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  if (!apiKey) throw new Error('COGNIPEER_API_KEY is required');

  const client = new ConsoleClient({
    apiKey,
    ...(process.env.COGNIPEER_BASE_URL ? { baseURL: process.env.COGNIPEER_BASE_URL } : {}),
  });

  const sessionId = `sess_${randomUUID()}`;
  const startedAt = new Date();

  console.log('Starting streaming session', sessionId);

  await client.tracing.startStream(sessionId, {
    agent: { name: 'streaming-demo', model: 'gpt-4o-mini', version: '1.0.0' },
    threadId: 'thread_demo',
    startedAt: startedAt.toISOString(),
  });

  // Emit a few events one by one
  const events = [
    {
      type: 'llm_start',
      label: 'Initial prompt',
      sequence: 1,
      timestamp: new Date().toISOString(),
      model: 'gpt-4o-mini',
      actor: { scope: 'agent', name: 'streaming-demo', role: 'assistant' },
    },
    {
      type: 'llm_end',
      label: 'Initial response',
      sequence: 2,
      timestamp: new Date().toISOString(),
      status: 'success',
      model: 'gpt-4o-mini',
      inputTokens: 120,
      outputTokens: 80,
      actor: { scope: 'agent', name: 'streaming-demo', role: 'assistant' },
    },
    {
      type: 'tool_call',
      label: 'lookup_account',
      sequence: 3,
      timestamp: new Date().toISOString(),
      status: 'success',
      durationMs: 240,
      actor: { scope: 'tool', name: 'lookup_account' },
      toolName: 'lookup_account',
    },
  ];

  for (const event of events) {
    const ack = await client.tracing.appendEvent(sessionId, event);
    console.log(`  appended ${event.type} → totalEvents=${ack.totalEvents}`);
  }

  const endedAt = new Date();
  const end = await client.tracing.endStream(sessionId, {
    status: 'success',
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
  });

  console.log('\nSession closed:', end);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
