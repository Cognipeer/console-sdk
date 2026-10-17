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

### `response_format`, `stream_options`, `service_tier`, `metadata`

```typescript
await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Extract the invoice total' }],
  // Constrain the answer to JSON that fits a schema (models and agents)
  response_format: { type: 'json_schema', json_schema: { name: 'invoice', schema: { type: 'object' }, strict: true } },
  stream: true,
  stream_options: { include_usage: true }, // a final chunk with `usage`
  service_tier: 'flex',                    // agents: low-priority deferred run
  metadata: { ticket: 'OPS-12' },          // agents: stored on the run
  reasoning_effort: 'xhigh',               // 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
});
```

## Calling an agent

`model` can name an agent (`agent:support-bot`, or its key when no model has that key): the agent runs its published
version and its answer is `message.content` (a JSON string with `response_format`). `client.models.list()` lists the
project's models and agents together (`cognipeer.kind === 'agent'`); a token that can only read agents lists the agents alone
(`models: []`, no providers). `version` pins a published version (a positive integer or numeric string) or runs the draft
(`'draft'`); anything else is `400 invalid_version`. The agent continues a session from a resent transcript only when
exactly one of the caller's sessions matches it, and the match covers file and image references and the `user` field, so
different end users start separate sessions.

```typescript
const res = await client.chat.completions.create(
  { model: 'agent:support-bot', messages: [{ role: 'user', content: 'Hi' }], inputs: { customer: 'acme' } },
  { sessionId: 'conv_1' }, // continue a session (X-Cognipeer-Session-Id); the answer carries `conversation_id`
);
res.conversation_id; // the session: pass it back as `conversation_id` in the body or as `sessionId`
```

The agent owns its history: only the last `user` message is the turn (system and developer messages are ignored,
the agent has its own prompt), and the session holds the rest. Name the session with `conversation_id` in the body or
the `X-Cognipeer-Session-Id` header (`sessionId`); naming two different ones is `400 session_conflict`, an unknown one
`404 session_not_found`. The reply carries it back in `conversation_id` and in the `X-Cognipeer-Session-Id` response
header. Other fields of an agent's reply: `output_files` (files the agent produced, with `file_path` annotations on
the message), and `stop_reason` / `stop_detail` when a limit or a cancel ended the run (`finish_reason: 'length'` for a
limit). A streamed reply carries `conversation_id` on its first and last chunk and `files` on the last.

A non-streaming agent call that outlives the Console's wait window (10 minutes by default) answers `202`: it does not
throw, `choices` is `[]` and `res.cognipeer` is `{ status: 'queued' | 'in_progress', run_id, session_id }`. The run
keeps going; follow it with `client.agents.runs.wait(res.cognipeer.run_id)`. An `idempotencyKey` makes a retry the same
run. `service_tier: 'flex'` runs the turn as a deferred run (not with `stream: true`); a stream whose reader goes away
stops the run.

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
