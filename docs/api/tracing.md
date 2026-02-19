# Tracing API

The Tracing API provides built-in observability for agent executions, allowing you to monitor, debug, and analyze your AI workflows.

## LangChain v1 Middleware Integration

The recommended way to add tracing to LangChain v1 agents is using the `createCognipeerTracingMiddleware` function:

```typescript
import { createAgent } from 'langchain';
import { CognipeerClient, createCognipeerTracingMiddleware } from '@cognipeer/console-sdk';

// Create client
const client = new CognipeerClient({
  apiKey: process.env.COGNIPEER_API_KEY,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

// Create tracing middleware
const tracing = createCognipeerTracingMiddleware({
  client,
  agent: {
    name: 'my-agent',
    model: 'gpt-4o-mini',
  },
  debug: true, // Enable debug logging
});

// Create agent with middleware
const agent = createAgent({
  model: 'gpt-4o-mini',
  tools: [...],
  middleware: [tracing.middleware],
});

// Run agent
const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Session automatically flushes on agent completion
// Or manually end the session:
await tracing.end('success');

console.log('Session ID:', tracing.sessionId);
```

### Middleware Options

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `client` | `CognipeerClient \| CognipeerClientOptions` | Yes | SDK client or config |
| `sessionId` | `string` | No | Custom session ID (auto-generated if omitted) |
| `agent` | `TracingAgent` | No | Agent metadata |
| `agent.name` | `string` | No | Agent name |
| `agent.model` | `string` | No | Default model name |
| `agent.version` | `string` | No | Agent version |
| `threadId` | `string` | No | Thread ID to group sessions across agents into a single workflow |
| `config` | `Record<string, unknown>` | No | Custom config to store |
| `debug` | `boolean` | No | Enable debug logging |
| `logger` | `function` | No | Custom logger function |

### Middleware Binding

The middleware returns a binding object:

```typescript
interface CognipeerTracingMiddlewareBinding {
  middleware: AgentMiddleware;  // Pass to agent.middleware
  handler: CognipeerTracingCallbackHandler;  // Direct handler access
  sessionId: string;  // Current session ID
  flush: (status?: 'success' | 'error' | 'running') => Promise<void>;
  end: (status?: 'success' | 'error') => Promise<void>;
}
```

## Session Payload Format

When sending tracing data to Cognipeer, use the following format:

```typescript
interface TracingSessionRequest {
  sessionId: string;                    // Unique session identifier (e.g., "sess_ZOc-SYK2n0KcJejwXv")
  threadId?: string;                    // Optional thread ID to group related sessions across agents
  startedAt: string;                    // ISO 8601 timestamp
  endedAt: string;                      // ISO 8601 timestamp
  durationMs: number;                   // Total duration in milliseconds
  agent: {
    name: string;                       // Agent name
    model?: string;                     // Primary model used
    version?: string;                   // Agent version
  };
  config?: Record<string, unknown>;     // Custom configuration
  summary: {
    totalDurationMs: number;            // Total duration
    totalInputTokens: number;           // Total input tokens across all calls
    totalOutputTokens: number;          // Total output tokens
    totalCachedInputTokens: number;     // Cached tokens
    totalBytesIn: number;               // Request bytes
    totalBytesOut: number;              // Response bytes
    eventCounts: Record<string, number>; // e.g., { "ai_call": 2, "tool_call": 3 }
  };
  events: TracingEvent[];               // List of events
  status: 'success' | 'error' | 'running';
  errors: Array<{
    message: string;
    type?: string;
    timestamp?: string;
  }>;
}
```

### Event Format

Each event in the session follows this format:

```typescript
interface TracingEvent {
  sessionId: string;                    // Parent session ID
  id: string;                           // Unique event ID (e.g., "evt_0001_ImyC")
  type: 'ai_call' | 'tool_call';        // Event type
  label: string;                        // Human-readable label
  sequence: number;                     // Event sequence number
  timestamp: string;                    // ISO 8601 timestamp
  status: 'success' | 'error';          // Event status
  durationMs: number;                   // Duration in milliseconds
  
  // Token usage (for ai_call events)
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  
  // Byte usage
  requestBytes?: number;
  responseBytes?: number;
  
  // Model info
  model?: string;
  
  // Actor info
  actor: {
    scope: 'agent' | 'tool' | 'system';
    name: string;
    role: string;
  };
  
  // Event data with sections
  data: {
    sections: TracingSection[];
  };
  
  // Error info
  error?: string;
}
```

### Section Format

Sections contain the actual message/tool content:

```typescript
interface TracingSection {
  kind: 'message' | 'tool_call' | 'tool_result' | 'data';
  label: string;
  id: string;
  
  // For message sections
  role?: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  
  // For tool sections
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}
```

### Complete Example Payload

```json
{
  "sessionId": "sess_ZOc-SYK2n0KcJejwXv",
  "threadId": "thread_order-workflow-42",
  "startedAt": "2025-12-11T14:15:23.200Z",
  "endedAt": "2025-12-11T14:15:28.390Z",
  "durationMs": 5190,
  "agent": {
    "name": "MyAgent",
    "model": "gpt-4o-mini"
  },
  "config": {
    "enabled": true
  },
  "summary": {
    "totalDurationMs": 5177,
    "totalInputTokens": 1396,
    "totalOutputTokens": 100,
    "totalCachedInputTokens": 0,
    "totalBytesIn": 2414,
    "totalBytesOut": 2018,
    "eventCounts": {
      "ai_call": 1
    }
  },
  "events": [
    {
      "sessionId": "sess_ZOc-SYK2n0KcJejwXv",
      "id": "evt_0001_ImyC",
      "type": "ai_call",
      "label": "Assistant Response #1",
      "sequence": 1,
      "timestamp": "2025-12-11T14:15:28.389Z",
      "actor": {
        "scope": "agent",
        "name": "MyAgent",
        "role": "assistant"
      },
      "status": "success",
      "durationMs": 5177,
      "inputTokens": 1396,
      "outputTokens": 100,
      "totalTokens": 1496,
      "cachedInputTokens": 0,
      "requestBytes": 2414,
      "responseBytes": 2018,
      "model": "gpt-4o-mini",
      "data": {
        "sections": [
          {
            "kind": "message",
            "label": "System Message",
            "role": "system",
            "content": "You are a helpful assistant.",
            "id": "message-evt_0001_ImyC-01"
          },
          {
            "kind": "message",
            "label": "User Message",
            "role": "user",
            "content": "Hello!",
            "id": "message-evt_0001_ImyC-02"
          },
          {
            "kind": "message",
            "label": "Assistant Message",
            "role": "assistant",
            "content": "Hello! How can I help you today?",
            "id": "message-evt_0001_ImyC-03"
          }
        ]
      }
    }
  ],
  "status": "success",
  "errors": []
}
```

## Thread Correlation

Use `threadId` to group related sessions across agents into a single logical thread. This is useful for multi-agent workflows where several agents collaborate on a single task.

### Concept

A **thread** is a logical grouping of tracing sessions. When multiple agents (or multiple invocations of the same agent) contribute to a single workflow, they can share a `threadId` so you can visualise the entire flow in the dashboard.

### Usage

Pass `threadId` when creating the tracing binding:

```typescript
// LangChain middleware
const tracing = createCognipeerTracingMiddleware({
  client,
  threadId: 'thread_order-workflow-42',
  agent: { name: 'planner-agent' },
});

// LangGraph tracing
const tracing = createCognipeerLangGraphTracing({
  client,
  threadId: 'thread_order-workflow-42',
  agent: { name: 'executor-agent' },
});
```

Or include it directly in the session payload:

```json
{
  "sessionId": "sess_abc",
  "threadId": "thread_order-workflow-42",
  "agent": { "name": "planner-agent" },
  ...
}
```

### Dashboard

Navigate to **Tracing → Threads** in the dashboard to:

- Browse all threads with session counts and aggregated metrics
- Filter by status, agent name, or search by threadId
- Click a thread to see the full timeline of sessions in chronological order

## Low-Level Methods

### `tracing.createTrace(params)`

Create a new trace for tracking an agent execution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params.name` | `string` | Yes | Name of the trace/execution |
| `params.metadata` | `Record<string, any>` | No | Custom metadata |
| `params.tags` | `string[]` | No | Tags for categorization |

**Returns:** `Promise<Trace>`

**Example:**

```typescript
const trace = await client.tracing.createTrace({
  name: 'Customer Support Agent',
  metadata: { userId: 'user_123' },
  tags: ['support', 'production'],
});

console.log('Trace ID:', trace.id);
```

### `tracing.addEvent(traceId, event)`

Add an event to an existing trace.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `traceId` | `string` | Yes | The trace ID |
| `event.type` | `'llm' \| 'tool' \| 'agent' \| 'custom'` | Yes | Event type |
| `event.name` | `string` | Yes | Event name |
| `event.input` | `any` | No | Input data |
| `event.output` | `any` | No | Output data |
| `event.metadata` | `Record<string, any>` | No | Event metadata |
| `event.timestamp` | `number` | No | Event timestamp (default: now) |

**Returns:** `Promise<TraceEvent>`

**Example:**

```typescript
// Log LLM call
await client.tracing.addEvent(trace.id, {
  type: 'llm',
  name: 'gpt-4-completion',
  input: { prompt: 'Hello' },
  output: { response: 'Hi there!' },
  metadata: { tokens: 15, duration: 234 },
});

// Log tool usage
await client.tracing.addEvent(trace.id, {
  type: 'tool',
  name: 'search_database',
  input: { query: 'user orders' },
  output: { results: [...] },
});
```

### `tracing.endTrace(traceId, params?)`

Mark a trace as completed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `traceId` | `string` | Yes | The trace ID |
| `params.status` | `'success' \| 'error'` | No | Final status |
| `params.output` | `any` | No | Final output |
| `params.error` | `string` | No | Error message if failed |

**Returns:** `Promise<Trace>`

**Example:**

```typescript
await client.tracing.endTrace(trace.id, {
  status: 'success',
  output: { answer: 'Your order has been shipped.' },
});
```

### `tracing.getTrace(traceId)`

Retrieve a trace with all its events.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `traceId` | `string` | Yes | The trace ID |

**Returns:** `Promise<TraceWithEvents>`

**Example:**

```typescript
const trace = await client.tracing.getTrace(trace.id);

console.log('Duration:', trace.duration_ms);
console.log('Events:', trace.events.length);
```

### `tracing.listTraces(params?)`

List all traces with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params.limit` | `number` | No | Maximum traces to return |
| `params.status` | `'running' \| 'completed' \| 'error'` | No | Filter by status |
| `params.tags` | `string[]` | No | Filter by tags |
| `params.startDate` | `Date` | No | Filter traces after date |
| `params.endDate` | `Date` | No | Filter traces before date |

**Returns:** `Promise<TraceList>`

**Example:**

```typescript
const traces = await client.tracing.listTraces({
  limit: 50,
  status: 'completed',
  tags: ['production'],
});

traces.data.forEach(trace => {
  console.log(`${trace.name}: ${trace.duration_ms}ms`);
});
```

## Response Types

### `Trace`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique trace identifier |
| `name` | `string` | Trace name |
| `status` | `'running' \| 'completed' \| 'error'` | Current status |
| `created_at` | `number` | Unix timestamp |
| `ended_at` | `number \| null` | Completion timestamp |
| `duration_ms` | `number \| null` | Duration in milliseconds |
| `metadata` | `Record<string, any>` | Custom metadata |
| `tags` | `string[]` | Tags |

### `TraceEvent`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Event identifier |
| `trace_id` | `string` | Parent trace ID |
| `type` | `string` | Event type |
| `name` | `string` | Event name |
| `timestamp` | `number` | Unix timestamp |
| `input` | `any` | Input data |
| `output` | `any` | Output data |
| `metadata` | `Record<string, any>` | Event metadata |

### `TraceWithEvents`

Extends `Trace` with:

| Field | Type | Description |
|-------|------|-------------|
| `events` | `TraceEvent[]` | All events in chronological order |

## Complete Agent Example

```typescript
// Create trace for agent execution
const trace = await client.tracing.createTrace({
  name: 'Research Agent',
  metadata: { query: 'AI trends 2025' },
  tags: ['research', 'ai'],
});

try {
  // Step 1: Search
  await client.tracing.addEvent(trace.id, {
    type: 'tool',
    name: 'web_search',
    input: { query: 'AI trends 2025' },
    output: { results: [...] },
  });

  // Step 2: LLM Analysis
  const analysis = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Analyze these results...' }],
  });

  await client.tracing.addEvent(trace.id, {
    type: 'llm',
    name: 'analyze_results',
    input: { results: [...] },
    output: { analysis: analysis.choices[0].message.content },
  });

  // Step 3: Generate report
  await client.tracing.addEvent(trace.id, {
    type: 'agent',
    name: 'generate_report',
    output: { report: '...' },
  });

  // Mark as complete
  await client.tracing.endTrace(trace.id, {
    status: 'success',
    output: { report: '...' },
  });
} catch (error) {
  // Mark as failed
  await client.tracing.endTrace(trace.id, {
    status: 'error',
    error: error.message,
  });
}
```

## Integration with Chat API

```typescript
const trace = await client.tracing.createTrace({
  name: 'Chat Conversation',
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  // Pass trace ID to automatically log
  trace_id: trace.id,
});

// Events are automatically logged
await client.tracing.endTrace(trace.id, {
  status: 'success',
});
```

## Analyzing Traces

```typescript
// Get detailed trace
const trace = await client.tracing.getTrace(traceId);

// Calculate total LLM time
const llmTime = trace.events
  .filter(e => e.type === 'llm')
  .reduce((sum, e) => sum + (e.metadata?.duration || 0), 0);

console.log(`LLM time: ${llmTime}ms`);

// Count tool calls
const toolCalls = trace.events.filter(e => e.type === 'tool').length;
console.log(`Tool calls: ${toolCalls}`);

// View event timeline
trace.events.forEach(event => {
  console.log(`[${event.timestamp}] ${event.type}: ${event.name}`);
});
```

## Best Practices

1. **Meaningful Names**: Use descriptive trace and event names
2. **Metadata**: Include relevant context in metadata fields
3. **Tags**: Use tags for filtering and categorization
4. **Error Handling**: Always mark failed traces with error status
5. **Cleanup**: Archive or delete old traces periodically
6. **Privacy**: Avoid logging sensitive user data

## Use Cases

- **Debugging**: Track agent decision-making process
- **Performance**: Identify bottlenecks in LLM calls
- **Monitoring**: Track success rates and errors
- **Analytics**: Analyze patterns in agent behavior
- **Auditing**: Maintain logs for compliance

## Related

- [Chat API](/api/chat) - Integrate tracing with chat
- [Agent Tracing Example](/examples/tracing) - Complete example
- [RAG Example](/examples/rag) - Tracing in RAG systems
