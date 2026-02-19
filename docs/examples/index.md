# Examples

Welcome to the Cognipeer Console SDK examples! Here you'll find practical examples for common use cases.

## Available Examples

### Chat & Completions

- **[Basic Chat](/examples/chat)** - Simple chat completions
- **[Streaming Chat](/examples/streaming)** - Real-time streaming responses
- **[Function Calling](/examples/functions)** - Using tools and function calls

### Embeddings & Vectors

- **[Create Embeddings](/examples/embeddings)** - Generate text embeddings
- **[RAG System](/examples/rag)** - Complete RAG implementation
- **[Semantic Search](/examples/search)** - Build semantic search

### Files & Documents

- **[File Upload](/examples/files)** - Upload and process files
- **[Markdown Conversion](/examples/markdown)** - Convert documents to markdown
- **[Document Q&A](/examples/doc-qa)** - Ask questions about documents

### Agents & Tracing

- **[Agent Tracing](/examples/tracing)** - Monitor agent execution
- **[Multi-Agent System](/examples/multi-agent)** - Coordinate multiple agents

## Quick Start Examples

### Chat Completion

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

console.log(response.choices[0].message.content);
```

### Streaming Chat

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### RAG System

```typescript
// 1. Create embeddings for query
const embeddingResponse = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'What is machine learning?',
});

// 2. Search vector database
const results = await client.vectors.query('my-provider', 'knowledge', {
  query: {
    vector: embeddingResponse.data[0].embedding,
    topK: 5,
  },
});

// 3. Generate response with context
const context = results.result.matches
  .map(m => m.metadata?.text)
  .join('\n\n');

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: `Context:\n${context}`,
    },
    {
      role: 'user',
      content: 'What is machine learning?',
    },
  ],
});
```

## Running Examples

Clone the repository and run examples:

```bash
git clone https://github.com/Cognipeer/console-sdk
cd console-sdk/examples

# Install dependencies
npm install

# Set your API key
export COGNIPEER_API_KEY=your-api-key

# Run an example
npm run example:chat
npm run example:rag
npm run example:streaming
```

## Example Projects

### Chatbot

Build a conversational AI chatbot:

```typescript
class Chatbot {
  private client: ConsoleClient;
  private messages: ChatMessage[] = [];

  constructor(apiKey: string) {
    this.client = new ConsoleClient({ apiKey });
    this.messages.push({
      role: 'system',
      content: 'You are a helpful assistant.',
    });
  }

  async chat(userMessage: string): Promise<string> {
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: this.messages,
    });

    const assistantMessage = response.choices[0].message;
    this.messages.push(assistantMessage);

    return assistantMessage.content;
  }
}

const bot = new Chatbot(process.env.COGNIPEER_API_KEY!);
console.log(await bot.chat('Hello!'));
console.log(await bot.chat('What can you help me with?'));
```

### Knowledge Base Search

```typescript
class KnowledgeBase {
  constructor(
    private client: ConsoleClient,
    private providerKey: string,
    private indexId: string
  ) {}

  async addDocument(id: string, text: string, metadata?: Record<string, unknown>) {
    const embedding = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    await this.client.vectors.upsert(this.providerKey, this.indexId, {
      vectors: [
        {
          id,
          values: embedding.data[0].embedding,
          metadata: { text, ...metadata },
        },
      ],
    });
  }

  async search(query: string, topK = 5) {
    const embedding = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const results = await this.client.vectors.query(
      this.providerKey,
      this.indexId,
      {
        query: {
          vector: embedding.data[0].embedding,
          topK,
        },
      }
    );

    return results.result.matches;
  }
}
```

## TypeScript Types

All examples are fully typed:

```typescript
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingResponse,
  QueryVectorsResponse,
} from '@cognipeer/console-sdk';
```

## Need Help?

- 📖 [API Reference](/api/client)
- 🐛 [Report Issues](https://github.com/Cognipeer/console-sdk/issues)
