# Quick Start Guide

Get up and running with Cognipeer Console SDK in 5 minutes!

## 1. Installation

```bash
npm install @cognipeer/console-sdk
```

## 2. Get API Key

1. Sign up at [cognipeer.com](https://cognipeer.com)
2. Go to **Settings** → **API Tokens**
3. Create a new token
4. Copy your API key

## 3. Initialize Client

```typescript
import { CognipeerClient } from '@cognipeer/console-sdk';

const client = new CognipeerClient({
  apiKey: 'your-api-key',
});
```

## 4. Make Your First Request

```typescript
// Chat completion
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ],
});

console.log(response.choices[0].message.content);
```

## 5. Try Streaming

```typescript
// Streaming response
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## Next Steps

- [Full Documentation](https://cognipeer.github.io/console-sdk)
- [API Reference](/api/client)
- [Examples](/examples/)
- [Chat Guide](/api/chat)
- [Vector Search](/api/vectors)

## Common Use Cases

### RAG System

```typescript
// 1. Create embeddings
const embedding = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'What is AI?',
});

// 2. Search vectors
const results = await client.vectors.query('my-provider', 'my-index', {
  query: {
    vector: embedding.data[0].embedding,
    topK: 5,
  },
});

// 3. Generate answer with context
const context = results.result.matches
  .map(m => m.metadata?.text)
  .join('\n\n');

const answer = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: `Context: ${context}`,
    },
    {
      role: 'user',
      content: 'What is AI?',
    },
  ],
});
```

### File Processing

```typescript
// Upload file
const file = await client.files.upload('my-bucket', {
  fileName: 'document.pdf',
  data: 'data:application/pdf;base64,...',
  convertToMarkdown: true,
});

console.log(file.markdownContent);
```

### Agent Tracing

```typescript
// Track agent execution
await client.tracing.ingest({
  sessionId: 'session-123',
  agent: {
    name: 'MyAgent',
    version: '1.0.0',
  },
  status: 'completed',
  events: [...],
});
```

## Environment Variables

```bash
# .env
COGNIPEER_API_KEY=your-api-key
```

```typescript
const client = new CognipeerClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});
```

## Error Handling

```typescript
import { CognipeerAPIError } from '@cognipeer/console-sdk';

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  if (error instanceof CognipeerAPIError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.statusCode);
  }
}
```

## TypeScript Support

Full type safety out of the box:

```typescript
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@cognipeer/console-sdk';

const request: ChatCompletionRequest = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
};
```

## Need Help?

- 📖 [Documentation](https://cognipeer.github.io/console-sdk)
- 🐛 [Issues](https://github.com/Cognipeer/console-sdk/issues)
- 📧 [Email](mailto:support@cognipeer.com)
