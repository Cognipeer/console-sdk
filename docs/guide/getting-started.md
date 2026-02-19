# Getting Started

Welcome to the Cognipeer Console SDK! This guide will help you get started with the Cognipeer Console SDK.

## What is Cognipeer Console SDK?

The Cognipeer Console SDK is the official TypeScript/JavaScript client library for [Cognipeer Console](https://cognipeer.com), a multi-tenant SaaS platform for AI and Agentic services. It provides:

- **Chat Completions**: OpenAI-compatible chat API with streaming
- **Embeddings**: Text vectorization for semantic search
- **Vector Operations**: Unified API for vector databases
- **File Management**: Upload and process documents
- **Agent Tracing**: Observability for agent executions

## Prerequisites

- Node.js 18 or higher
- A Cognipeer Console account and API key

## Installation

Install the SDK using your preferred package manager:

::: code-group

```bash [npm]
npm install @cognipeer/console-sdk
```

```bash [yarn]
yarn add @cognipeer/console-sdk
```

```bash [pnpm]
pnpm add @cognipeer/console-sdk
```

:::

## Get Your API Key

1. Sign up at [Cognipeer Console](https://cognipeer.com)
2. Navigate to your dashboard
3. Go to **Settings** > **API Tokens**
4. Create a new API token
5. Copy the token (you'll need it in the next step)

## Initialize the Client

Create a new client instance with your API key:

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: 'your-api-key-here',
});
```

::: tip Environment Variables
For security, we recommend storing your API key in an environment variable:

```typescript
const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});
```
:::

## Your First Request

Let's make a simple chat completion request:

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant.',
    },
    {
      role: 'user',
      content: 'What is the capital of France?',
    },
  ],
});

console.log(response.choices[0].message.content);
// Output: "The capital of France is Paris."
```

## Streaming Example

Stream responses for real-time output:

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'user',
      content: 'Tell me a short story about a robot.',
    },
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

## Configuration Options

The client supports several configuration options:

```typescript
const client = new ConsoleClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.cognipeer.com', // Optional: custom API URL
  timeout: 60000, // Optional: request timeout (ms)
  maxRetries: 3, // Optional: max retry attempts
  fetch: customFetch, // Optional: custom fetch implementation
});
```

## Next Steps

Now that you've set up the SDK, explore these topics:

- [Authentication](/guide/authentication) - Learn about API keys and security
- [Configuration](/guide/configuration) - Advanced client configuration
- [Chat API](/api/chat) - Detailed chat completions documentation
- [Examples](/examples/) - Real-world usage examples

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
} from '@cognipeer/console-sdk';

// Full intellisense and type checking
const request: ChatCompletionRequest = {
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
};
```

## Getting Help

- 📖 [Full Documentation](/api/client)
- 🐛 [Report Issues](https://github.com/Cognipeer/console-sdk/issues)
- 📧 [Email Support](mailto:support@cognipeer.com)
