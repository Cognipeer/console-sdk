# ConsoleClient API Reference

Complete API reference for the Cognipeer Console SDK client.

## Constructor

### `new ConsoleClient(options)`

Creates a new Cognipeer Console SDK client instance.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options.apiKey` | `string` | Yes | Your Cognipeer Console API key |
| `options.baseURL` | `string` | No | Custom API base URL (default: `https://api.cognipeer.com/api/client/v1`) |
| `options.timeout` | `number` | No | Request timeout in milliseconds (default: `60000`) |
| `options.maxRetries` | `number` | No | Maximum retry attempts (default: `3`) |
| `options.fetch` | `typeof fetch` | No | Custom fetch implementation |

**Returns:** `ConsoleClient`

**Example:**

```typescript
const client = new ConsoleClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.cognipeer.com',
  timeout: 30000,
  maxRetries: 5,
});
```

## Properties

### `client.chat`

Chat completions API resource.

**Type:** `ChatResource`

See [Chat API](/api/chat) for details.

### `client.embeddings`

Embeddings API resource.

**Type:** `EmbeddingsResource`

See [Embeddings API](/api/embeddings) for details.

### `client.vectors`

Vector operations API resource.

**Type:** `VectorsResource`

See [Vectors API](/api/vectors) for details.

### `client.files`

File management API resource.

**Type:** `FilesResource`

See [Files API](/api/files) for details.

### `client.prompts`

Prompt template API resource.

**Type:** `PromptsResource`

See [Prompts API](/api/prompts) for details.

### `client.tracing`

Agent tracing API resource.

**Type:** `TracingResource`

See [Tracing API](/api/tracing) for details.

### `client.guardrails`

Guardrail evaluation API resource.

**Type:** `GuardrailsResource`

See [Guardrails API](/api/guardrails) for details.

### `client.agents`

Agents API resource — list, retrieve, and invoke agents using the Responses API format.

**Type:** `AgentsResource`

See [Agents API](/api/agents) for details.

### `client.tools`

Unified tools API resource — list, retrieve, execute tools and convert them to Agent SDK-compatible objects.

**Type:** `ToolsResource`

See [Tools API](/api/tools) for details.

### `client.config`

Configuration management API resource — manage config groups, items, secrets, and audit logs.

**Type:** `ConfigResource`

See [Config API](/api/config) for details.

## Methods

### `client.getBaseURL()`

Get the configured base URL.

**Returns:** `string`

**Example:**

```typescript
const baseURL = client.getBaseURL();
console.log(baseURL); // "https://api.cognipeer.com/api/client/v1"
```

## Type Definitions

### `ConsoleClientOptions`

```typescript
interface ConsoleClientOptions {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
}
```

### `ChatMessage`

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

### `ChatCompletionRequest`

```typescript
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  request_id?: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | object;
}
```

### `ChatCompletionResponse`

```typescript
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
  request_id?: string;
}
```

### `EmbeddingRequest`

```typescript
interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  user?: string;
  request_id?: string;
}
```

### `EmbeddingResponse`

```typescript
interface EmbeddingResponse {
  object: string;
  data: Embedding[];
  model: string;
  usage: Usage;
  request_id?: string;
}
```

### `VectorProvider`

```typescript
interface VectorProvider {
  _id: string;
  key: string;
  driver: string;
  label: string;
  description?: string;
  status: 'active' | 'inactive' | 'error';
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### `VectorIndex`

```typescript
interface VectorIndex {
  _id: string;
  key: string;
  indexId: string;
  name: string;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  providerKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

## Error Types

### `CognipeerError`

Base error class for all SDK errors.

```typescript
class CognipeerError extends Error {
  constructor(
    message: string,
    statusCode?: number,
    response?: unknown
  );
}
```

**Properties:**
- `message: string` - Error message
- `statusCode?: number` - HTTP status code (if applicable)
- `response?: unknown` - Raw response data

### `CognipeerAPIError`

Error class for API-specific errors.

```typescript
class CognipeerAPIError extends CognipeerError {
  constructor(
    message: string,
    statusCode: number,
    errorType?: string,
    response?: unknown
  );
}
```

**Properties:**
- All properties from `CognipeerError`
- `errorType?: string` - API error type (e.g., 'invalid_request_error')

**Example:**

```typescript
import { CognipeerAPIError } from '@cognipeer/console-sdk';

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  if (error instanceof CognipeerAPIError) {
    console.error('Status:', error.statusCode);
    console.error('Type:', error.errorType);
    console.error('Message:', error.message);
  }
}
```

## Constants

### Default Values

```typescript
const DEFAULT_BASE_URL = 'https://api.cognipeer.com/api/client/v1';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;
```

## Usage Patterns

### Singleton Pattern

```typescript
let clientInstance: ConsoleClient | null = null;

export function getClient(): ConsoleClient {
  if (!clientInstance) {
    clientInstance = new ConsoleClient({
      apiKey: process.env.COGNIPEER_API_KEY!,
    });
  }
  return clientInstance;
}
```

### Factory Pattern

```typescript
export function createClient(
  environment: 'dev' | 'prod'
): ConsoleClient {
  return new ConsoleClient({
    apiKey: process.env[`${environment.toUpperCase()}_API_KEY`]!,
  });
}
```

### Request Wrapper

```typescript
async function safeRequest<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CognipeerAPIError) {
      console.error('API Error:', error.message);
    }
    return null;
  }
}

const response = await safeRequest(() =>
  client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  })
);
```

## See Also

- [Chat API](/api/chat)
- [Embeddings API](/api/embeddings)
- [Agents API](/api/agents)
- [Tools API](/api/tools)
- [Config API](/api/config)
- [LangGraph API](/api/langgraph)
- [Vectors API](/api/vectors)
- [Files API](/api/files)
- [Tracing API](/api/tracing)
- [Guardrails API](/api/guardrails)
- [Error Handling](/guide/error-handling)
- [Configuration](/guide/configuration)
