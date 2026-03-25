# Type Safety

Learn how to leverage TypeScript for type-safe AI applications with the Cognipeer Console SDK.

## Full TypeScript Support

The Cognipeer Console SDK is written in TypeScript and provides comprehensive type definitions for all API methods, parameters, and responses.

## Type-Safe Client

```typescript
import { ConsoleClient, ConsoleClientOptions } from '@cognipeer/console-sdk';

// Options are fully typed
const options: ConsoleClientOptions = {
  apiKey: 'your-api-key',
  baseURL: 'https://api.cognipeer.com',
  timeout: 30000,
  maxRetries: 3,
};

const client = new ConsoleClient(options);
```

## Chat Completions

### Request Types

```typescript
import type {
  ChatCompletionRequest,
  ChatMessage,
  ChatCompletionResponse,
} from '@cognipeer/console-sdk';

// Messages are strongly typed
const messages: ChatMessage[] = [
  {
    role: 'system',
    content: 'You are a helpful assistant.',
  },
  {
    role: 'user',
    content: 'Hello!',
  },
];

// Request parameters are validated
const request: ChatCompletionRequest = {
  model: 'gpt-4',
  messages,
  temperature: 0.7,
  max_tokens: 150,
};

// Response type is inferred
const response = await client.chat.completions.create(request);
// response: ChatCompletionResponse

// Access properties with autocomplete
const content = response.choices[0].message.content;
```

### Message Types

```typescript
import type {
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
} from '@cognipeer/console-sdk';

const systemMsg: SystemMessage = {
  role: 'system',
  content: 'You are a helpful assistant.',
  name: 'system', // optional
};

const userMsg: UserMessage = {
  role: 'user',
  content: 'What is TypeScript?',
};

const assistantMsg: AssistantMessage = {
  role: 'assistant',
  content: 'TypeScript is a typed superset of JavaScript.',
  tool_calls: [], // optional
};

const toolMsg: ToolMessage = {
  role: 'tool',
  content: 'Tool result',
  tool_call_id: 'call_123',
};
```

## Streaming Types

```typescript
import type {
  ChatCompletionChunk,
  ChatChoiceDelta,
} from '@cognipeer/console-sdk';

const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

// Type-safe iteration
for await (const chunk of stream) {
  // chunk: ChatCompletionChunk
  const delta: ChatChoiceDelta = chunk.choices[0];
  const content: string | undefined = delta.delta.content;
  
  if (content) {
    process.stdout.write(content);
  }
}
```

## Embeddings

```typescript
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingObject,
} from '@cognipeer/console-sdk';

const request: EmbeddingRequest = {
  model: 'text-embedding-3-small',
  input: 'Hello world',
  encoding_format: 'float', // Type-safe enum
};

const response = await client.embeddings.create(request);
// response: EmbeddingResponse

const embeddings: number[] = response.data[0].embedding;
```

## Vector Operations

```typescript
import type {
  VectorProvider,
  VectorIndex,
  VectorUpsertRequest,
  VectorQueryRequest,
  VectorMatch,
} from '@cognipeer/console-sdk';

// Provider type is constrained
const provider: VectorProvider = 'pinecone'; // or 'chroma', 'qdrant', 'weaviate'

// Index creation is type-safe
const index: VectorIndex = await client.vectors.createIndex({
  name: 'my-index',
  provider: 'pinecone',
  dimension: 1536,
  metric: 'cosine', // Type-safe enum
});

// Upsert with typed vectors
const upsertRequest: VectorUpsertRequest = {
  index: index.id,
  vectors: [
    {
      id: 'vec1',
      values: new Array(1536).fill(0),
      metadata: {
        text: 'Hello',
        timestamp: Date.now(),
      },
    },
  ],
};

await client.vectors.upsert(upsertRequest);

// Query with type-safe results
const queryRequest: VectorQueryRequest = {
  index: index.id,
  vector: new Array(1536).fill(0),
  topK: 5,
  includeMetadata: true,
};

const results = await client.vectors.query(queryRequest);

results.matches.forEach((match: VectorMatch) => {
  console.log(`Score: ${match.score}`);
  console.log(`Metadata:`, match.metadata);
});
```

## Tool Definitions

```typescript
import type {
  Tool,
  FunctionDefinition,
  ToolCall,
} from '@cognipeer/console-sdk';

// Type-safe tool definition
const tool: Tool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get weather information',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['location'],
    },
  },
};

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Weather in Paris?' }],
  tools: [tool],
});

// Type-safe tool call handling
const message = response.choices[0].message;

if (message.tool_calls && message.tool_calls.length > 0) {
  message.tool_calls.forEach((toolCall: ToolCall) => {
    console.log('Function:', toolCall.function.name);
    console.log('Arguments:', toolCall.function.arguments);
  });
}
```

## File Operations

```typescript
import type {
  FileUploadRequest,
  FileObject,
  FileListResponse,
} from '@cognipeer/console-sdk';

// Type-safe file upload
const uploadRequest: FileUploadRequest = {
  file: fileBuffer,
  filename: 'document.pdf',
  purpose: 'assistants', // Type-safe enum
};

const file: FileObject = await client.files.upload(uploadRequest);

// Status is type-checked
if (file.status === 'processed') {
  console.log('Markdown:', file.markdown);
}
```

## Tracing

```typescript
import type {
  Trace,
  TraceEvent,
  TraceWithEvents,
} from '@cognipeer/console-sdk';

// Type-safe trace creation
const trace: Trace = await client.tracing.createTrace({
  name: 'My Agent',
  metadata: {
    userId: 'user_123',
  },
  tags: ['production'],
});

// Type-safe event types
await client.tracing.addEvent(trace.id, {
  type: 'llm', // or 'tool', 'agent', 'custom'
  name: 'chat-completion',
  input: { prompt: 'Hello' },
  output: { response: 'Hi!' },
  metadata: {
    tokens: 15,
  },
});
```

## Error Handling

```typescript
import { CognipeerError } from '@cognipeer/console-sdk';

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  // Type guard for CognipeerError
  if (error instanceof CognipeerError) {
    // Properties are typed
    const status: number | undefined = error.status;
    const code: string | undefined = error.code;
    const message: string = error.message;
    
    console.error(`Error ${status}: ${message}`);
  } else {
    // Handle other error types
    console.error('Unexpected error:', error);
  }
}
```

## Custom Type Guards

Create reusable type guards:

```typescript
import type { AssistantMessage } from '@cognipeer/console-sdk';

// Check if message has tool calls
function hasToolCalls(message: AssistantMessage): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

// Check if response is streaming
function isStreaming(
  response: ChatCompletionResponse | AsyncIterable<ChatCompletionChunk>
): response is AsyncIterable<ChatCompletionChunk> {
  return Symbol.asyncIterator in response;
}

// Usage
const response = await client.chat.completions.create({...});

if (isStreaming(response)) {
  for await (const chunk of response) {
    // Handle stream
  }
} else {
  // Handle regular response
}
```

## Generic Helper Functions

Build type-safe helper functions:

```typescript
import type {
  ChatMessage,
  ChatCompletionResponse,
} from '@cognipeer/console-sdk';

async function chat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const response = await client.chat.completions.create({
    model: options?.model || 'gpt-4',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens,
  });

  return response.choices[0].message.content || '';
}

// Type-safe usage
const result = await chat(
  [{ role: 'user', content: 'Hello' }],
  { temperature: 0.5 }
);
```

## Exporting Types

All types are exported for use in your application:

```typescript
import type {
  // Client
  ConsoleClient,
  ConsoleClientOptions,
  
  // Chat
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ChatCompletionChunk,
  
  // Embeddings
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingObject,
  
  // Vectors
  VectorProvider,
  VectorIndex,
  VectorMatch,
  
  // Files
  FileObject,
  FileUploadRequest,
  
  // Tracing
  Trace,
  TraceEvent,
  
  // Errors
  CognipeerError,
  
  // Tools
  Tool,
  ToolCall,
  FunctionDefinition,
} from '@cognipeer/console-sdk';
```

## IDE Support

The SDK provides excellent IDE support:

- **Autocomplete**: All methods and parameters
- **Type Hints**: Inline documentation
- **Error Detection**: Catch type errors before runtime
- **Refactoring**: Safe renaming and restructuring

## Best Practices

1. **Use Type Imports**: Import types with `import type` for better tree-shaking
2. **Define Interfaces**: Create interfaces for your application-specific types
3. **Type Guards**: Use type guards for runtime type checking
4. **Strict Mode**: Enable `strict: true` in tsconfig.json
5. **Avoid `any`**: Leverage the provided types instead of using `any`

## Example: Type-Safe RAG System

```typescript
import type {
  ChatMessage,
  EmbeddingResponse,
  VectorMatch,
} from '@cognipeer/console-sdk';

interface Document {
  id: string;
  text: string;
  embedding: number[];
}

async function retrievalAugmentedGeneration(
  query: string,
  documents: Document[]
): Promise<string> {
  // 1. Embed query (type-safe)
  const queryEmbedding: EmbeddingResponse = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  // 2. Search vectors (type-safe)
  const results = await client.vectors.query({
    index: 'documents',
    vector: queryEmbedding.data[0].embedding,
    topK: 3,
  });

  // 3. Build context (type-safe)
  const context = results.matches
    .map((match: VectorMatch) => match.metadata?.text)
    .filter(Boolean)
    .join('\n\n');

  // 4. Generate response (type-safe)
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Answer based on this context:\n\n${context}`,
    },
    {
      role: 'user',
      content: query,
    },
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  return response.choices[0].message.content || '';
}
```

## Related

- [API Types](/api/types) - Complete type reference
- [Client API](/api/client) - Type-safe client usage
- [Error Handling](/guide/error-handling) - Type-safe error handling
