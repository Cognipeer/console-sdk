# Chat API

The Chat API provides OpenAI-compatible chat completions with streaming support.

## Basic Usage

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(response.choices[0].message.content);
```

## Streaming

Stream responses for real-time output:

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

## Parameters

### `model` (required)

The model to use for completion:

```typescript
model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-opus' | string
```

### `messages` (required)

Array of conversation messages:

```typescript
messages: Array<{
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}>
```

### `temperature`

Controls randomness (0-2, default: 1):

```typescript
temperature: 0.7
```

### `max_tokens`

Maximum tokens to generate:

```typescript
max_tokens: 1000
```

### `stream`

Enable streaming responses:

```typescript
stream: true
```

## Tool Calling (Function Calling)

Define tools (functions) the model can call:

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the weather in Paris?' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
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
    },
  ],
});

if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    console.log('Function:', toolCall.function.name);
    console.log('Arguments:', toolCall.function.arguments);
  }
}
```

## Multi-Turn Conversations

Build conversation history:

```typescript
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
];

// First response
const response1 = await client.chat.completions.create({
  model: 'gpt-4',
  messages,
});

// Add assistant response to history
messages.push(response1.choices[0].message);

// Continue conversation
messages.push({ role: 'user', content: 'Tell me more' });

const response2 = await client.chat.completions.create({
  model: 'gpt-4',
  messages,
});
```

## Response Format

```typescript
{
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: [
    {
      index: number;
      message: {
        role: 'assistant';
        content: string;
        tool_calls?: ToolCall[];
      };
      finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    }
  ];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens?: number;
  };
  request_id?: string;
}
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
    console.error('Type:', error.errorType);
  }
}
```

## Best Practices

### System Prompts

Use system messages to set behavior:

```typescript
{
  role: 'system',
  content: `You are a customer support agent. Be helpful, concise, and professional.
  Always ask clarifying questions if needed.`
}
```

### Token Management

Monitor token usage:

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages,
  max_tokens: 500, // Limit response length
});

console.log('Tokens used:', response.usage.total_tokens);
```

### Streaming for UX

Use streaming for better user experience:

```typescript
async function streamResponse(userMessage: string) {
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
  });

  let fullResponse = '';
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      // Update UI in real-time
      updateUI(fullResponse);
    }
  }
  
  return fullResponse;
}
```

## See Also

- [Streaming Guide](/guide/streaming)
- [Error Handling](/guide/error-handling)
- [Chat Examples](/examples/chat)
