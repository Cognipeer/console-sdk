# Tracing API

The SDK supports tracing in three complementary ways:

1. **Direct ingestion** via `client.tracing.ingest(...)`
2. **LangChain middleware/callback integrations** for automatic event capture
3. **OpenTelemetry exporter** for OTLP-native pipelines

## Resource

### `client.tracing.ingest(data)`

Ingest a full tracing session payload.

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

await client.tracing.ingest({
  sessionId: 'sess_abc123',
  threadId: 'thread_order-workflow-42',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  rootSpanId: '00f067aa0ba902b7',
  source: 'custom',
  status: 'success',
  startedAt: new Date(Date.now() - 2000).toISOString(),
  endedAt: new Date().toISOString(),
  durationMs: 2000,
  agent: {
    name: 'support-agent',
    version: '1.2.0',
    model: 'gpt-4o-mini',
  },
  summary: {
    totalInputTokens: 450,
    totalOutputTokens: 180,
    totalCachedInputTokens: 20,
    totalBytesIn: 9000,
    totalBytesOut: 4200,
    eventCounts: {
      ai_call: 1,
      tool_call: 1,
    },
  },
  events: [
    {
      id: 'evt_1',
      type: 'ai_call',
      label: 'Assistant response',
      sequence: 1,
      timestamp: new Date().toISOString(),
      status: 'success',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: 'b7ad6b7169203331',
      parentSpanId: '00f067aa0ba902b7',
      inputTokens: 450,
      outputTokens: 180,
      model: 'gpt-4o-mini',
      actor: { scope: 'agent', name: 'support-agent', role: 'assistant' },
      data: {
        sections: [
          {
            kind: 'message',
            label: 'User Message',
            role: 'user',
            content: 'Help me reset my password',
          },
        ],
      },
    },
  ],
  errors: [],
});
```

**Returns**

```typescript
Promise<{ success: boolean; sessionId: string }>;
```

## LangChain Integration

For LangChain v1 agents, use middleware for automatic tracing:

```typescript
import { createAgent } from 'langchain';
import { ConsoleClient, createCognipeerTracingMiddleware } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const tracing = createCognipeerTracingMiddleware({
  client,
  agent: {
    name: 'my-agent',
    model: 'gpt-4o-mini',
  },
  threadId: 'thread_checkout-17',
  debug: true,
});

const agent = createAgent({
  model: 'gpt-4o-mini',
  tools: [],
  middleware: [tracing.middleware],
});

await agent.invoke({
  messages: [{ role: 'user', content: 'Hello!' }],
});

await tracing.end('success');
```

### Middleware Options

| Name | Type | Description |
|------|------|-------------|
| `client` | `ConsoleClient \| ConsoleClientOptions` | SDK client or client config |
| `sessionId` | `string` | Optional custom session ID |
| `agent` | `TracingAgent` | Agent metadata (`name`, `model`, `version`) |
| `threadId` | `string` | Optional workflow thread correlation ID |
| `config` | `Record<string, unknown>` | Optional custom config snapshot |
| `debug` | `boolean` | Enables verbose tracing logs |
| `logger` | `function` | Optional custom logger |

## OpenTelemetry Exporter

Use `CognipeerOTelSpanExporter` when your runtime already emits OTel spans.

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { CognipeerOTelSpanExporter } from '@cognipeer/console-sdk';

const exporter = new CognipeerOTelSpanExporter({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL || 'https://api.cognipeer.com',
});

const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();
```

The exporter converts spans to OTLP/HTTP JSON and sends them to:

- `POST /api/client/v1/traces`

### Exporter Options

| Name | Type | Description |
|------|------|-------------|
| `apiKey` | `string` | Bearer token used for auth |
| `baseURL` | `string` | Cognipeer gateway base URL |
| `headers` | `Record<string, string>` | Extra headers for each export request |
| `timeout` | `number` | Request timeout in ms (default `30000`) |
| `fetch` | `typeof fetch` | Custom fetch implementation |

## Correlation Fields

| Field | Scope | Description |
|------|-------|-------------|
| `traceId` | Session + Event | W3C trace ID |
| `rootSpanId` | Session | Root span ID for the session |
| `spanId` | Event | Span ID for the event |
| `parentSpanId` | Event | Parent span for hierarchy |
| `source` | Session | Ingestion source (`custom` or `otlp`) |

## Thread Correlation

Set `threadId` to group related sessions (including multi-agent workflows):

```typescript
const tracing = createCognipeerTracingMiddleware({
  client,
  threadId: 'thread_order-workflow-42',
  agent: { name: 'planner-agent' },
});
```

All sessions that share the same `threadId` appear together in **Tracing → Threads**.
