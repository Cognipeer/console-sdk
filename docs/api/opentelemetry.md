# OpenTelemetry Integration

Ship OpenTelemetry spans to Cognipeer Console with a drop-in span exporter. Console ingests them via its OTLP/HTTP JSON traces endpoint, so any OTel-instrumented app can feed the same [tracing](/api/tracing) views.

```typescript
import { CognipeerOTelSpanExporter } from '@cognipeer/console-sdk';
```

> Requires `@opentelemetry/sdk-trace-base` (and the rest of your OTel setup) as peer dependencies.

## Wire up the exporter

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { CognipeerOTelSpanExporter } from '@cognipeer/console-sdk';

const exporter = new CognipeerOTelSpanExporter({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: 'https://api.cognipeer.com',
});

const sdk = new NodeSDK({
  spanProcessor: new BatchSpanProcessor(exporter),
});

sdk.start();
```

The exporter posts spans to `/api/client/v1/traces`. Pass the **host root** as `baseURL` (e.g. `https://api.cognipeer.com`); a legacy URL ending in `/api/client/v1` is stripped automatically.

## Options

`CognipeerOTelExporterOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | API token (Bearer), required |
| `baseURL` | `string` | — | Console host root, required |
| `headers` | `Record<string, string>` | `{}` | Extra headers on every request |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `fetch` | `typeof fetch` | global `fetch` | Custom fetch implementation |

The exporter implements the OTel `SpanExporter` contract (`export(spans, cb)` and `shutdown()`), so it plugs into any span processor.

## Use a simple processor in scripts

```typescript
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

const provider = new BasicTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();
```

For LangChain/LangGraph-native tracing without OTel, use the [LangChain](/api/langchain) callback handler instead.
