# Type Definitions

Complete TypeScript type definitions for the Cognipeer Console SDK.

## Client Types

### `ConsoleClientOptions`

Configuration options for the client.

```typescript
interface ConsoleClientOptions {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
}
```

## Chat Types

### `ChatCompletionRequest`

```typescript
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | ToolChoice;
  response_format?: { type: 'json_object' | 'text' };
}
```

### `ChatMessage`

```typescript
type ChatMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

interface SystemMessage {
  role: 'system';
  content: string;
  name?: string;
}

interface UserMessage {
  role: 'user';
  content: string | MessageContent[];
  name?: string;
}

interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
}

interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}
```

### `ChatCompletionResponse`

```typescript
interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}

interface ChatChoice {
  index: number;
  message: AssistantMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: LogProbs | null;
}
```

### `ChatCompletionChunk`

```typescript
interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatChoiceDelta[];
  usage?: Usage;
}

interface ChatChoiceDelta {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: ToolCallDelta[];
  };
  finish_reason: string | null;
}
```

## Embedding Types

### `EmbeddingRequest`

```typescript
interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}
```

### `EmbeddingResponse`

```typescript
interface EmbeddingResponse {
  object: 'list';
  data: EmbeddingObject[];
  model: string;
  usage: EmbeddingUsage;
}

interface EmbeddingObject {
  object: 'embedding';
  embedding: number[];
  index: number;
}

interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}
```

## Vector Types

### `VectorProvider`

```typescript
type VectorProvider = 'pinecone' | 'chroma' | 'qdrant' | 'weaviate';

interface VectorProviderConfig {
  provider: VectorProvider;
  apiKey?: string;
  endpoint?: string;
  namespace?: string;
}
```

### `VectorIndex`

```typescript
interface VectorIndex {
  id: string;
  name: string;
  provider: VectorProvider;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  created_at: number;
  count?: number;
}
```

### `VectorUpsertRequest`

```typescript
interface VectorUpsertRequest {
  index: string;
  vectors: Vector[];
  namespace?: string;
}

interface Vector {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}
```

### `VectorQueryRequest`

```typescript
interface VectorQueryRequest {
  index: string;
  vector?: number[];
  id?: string;
  topK?: number;
  filter?: Record<string, any>;
  namespace?: string;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

interface VectorQueryResponse {
  matches: VectorMatch[];
  namespace?: string;
}

interface VectorMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}
```

## File Types

### `FileUploadRequest`

```typescript
interface FileUploadRequest {
  file: File | Buffer | Blob;
  filename: string;
  purpose?: 'assistants' | 'vision' | 'batch';
}
```

### `FileObject`

```typescript
interface FileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: 'uploaded' | 'processed' | 'error';
  markdown?: string;
}
```

## Tracing Types

### `TracingSessionRequest`

```typescript
interface TracingSessionRequest {
  sessionId: string;
  threadId?: string;
  agent?: {
    name?: string;
    version?: string;
    model?: string;
  };
  config?: Record<string, unknown>;
  summary?: {
    totalDurationMs?: number;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalCachedInputTokens?: number;
    totalBytesIn?: number;
    totalBytesOut?: number;
    eventCounts?: Record<string, number>;
  };
  status?: 'success' | 'error' | 'running' | 'completed' | string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  errors?: Array<{
    message: string;
    type?: string;
    timestamp?: string;
  }>;
  events?: TracingEvent[];
  traceId?: string;
  rootSpanId?: string;
  source?: 'custom' | 'otlp';
}
```

### `TracingEvent`

```typescript
interface TracingEvent {
  sessionId?: string;
  id?: string;
  type?: string;
  label?: string;
  sequence?: number;
  timestamp?: string;
  status?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  requestBytes?: number;
  responseBytes?: number;
  model?: string;
  actor?: {
    scope?: 'agent' | 'tool' | 'system';
    name?: string;
    role?: string;
  };
  sections?: Array<Record<string, unknown>>;
  data?: {
    sections?: Array<Record<string, unknown>>;
  };
  error?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}
```

## Tool Types

### `Tool`

```typescript
interface Tool {
  type: 'function';
  function: FunctionDefinition;
}

interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: FunctionParameters;
}

interface FunctionParameters {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}
```

### `ToolCall`

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolChoice {
  type: 'function';
  function: {
    name: string;
  };
}
```

## Error Types

### `CognipeerError`

```typescript
class CognipeerError extends Error {
  status?: number;
  code?: string;
  type?: string;

  constructor(message: string, status?: number, code?: string);
}
```

## Utility Types

### `Usage`

```typescript
interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
```

### `ListResponse<T>`

```typescript
interface ListResponse<T> {
  object: 'list';
  data: T[];
  has_more?: boolean;
}
```

### `DeleteResponse`

```typescript
interface DeleteResponse {
  id: string;
  object: string;
  deleted: boolean;
}
```

## Type Guards

Utility functions for type checking:

```typescript
// Check if error is CognipeerError
function isCognipeerError(error: unknown): error is CognipeerError {
  return error instanceof CognipeerError;
}

// Check if message has tool calls
function hasToolCalls(message: AssistantMessage): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

// Check if response is streaming
function isStreamingResponse(
  response: ChatCompletionResponse | AsyncIterable<ChatCompletionChunk>
): response is AsyncIterable<ChatCompletionChunk> {
  return Symbol.asyncIterator in response;
}
```

## Generic Types

### `RequestOptions`

```typescript
interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}
```

### `PaginationParams`

```typescript
interface PaginationParams {
  limit?: number;
  after?: string;
  before?: string;
}
```

## Type Exports

All types are exported from the main package:

```typescript
import type {
  ConsoleClientOptions,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  VectorIndex,
  FileObject,
  Trace,
  TraceEvent,
  CognipeerError,
  // ... and more
} from '@cognipeer/console-sdk';
```

## Related

- [Client API](/api/client) - Client initialization
- [Chat API](/api/chat) - Chat types usage
- [Embeddings API](/api/embeddings) - Embedding types usage
- [Vectors API](/api/vectors) - Vector types usage
