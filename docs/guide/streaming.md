# Streaming

Learn how to use streaming for real-time chat responses.

## What is Streaming?

Streaming allows you to receive chat completions progressively as they are generated, rather than waiting for the entire response. This creates a better user experience by showing responses as they appear.

## Basic Streaming

Enable streaming by setting `stream: true`:

```typescript
import { CognipeerClient } from '@cognipeer/console-sdk';

const client = new CognipeerClient({ apiKey: 'your-api-key' });

const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  process.stdout.write(content);
}
```

## Response Format

### Non-Streaming Response

```typescript
{
  id: "chatcmpl-123",
  object: "chat.completion",
  created: 1677652288,
  model: "gpt-4",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: "Hello! How can I help you today?"
    },
    finish_reason: "stop"
  }]
}
```

### Streaming Response

Each chunk contains a delta:

```typescript
{
  id: "chatcmpl-123",
  object: "chat.completion.chunk",
  created: 1677652288,
  model: "gpt-4",
  choices: [{
    index: 0,
    delta: {
      content: "Hello"  // Partial content
    },
    finish_reason: null
  }]
}
```

## Complete Example

```typescript
import { CognipeerClient } from '@cognipeer/console-sdk';

const client = new CognipeerClient({ apiKey: 'your-api-key' });

async function streamChat(prompt: string) {
  console.log('User:', prompt);
  console.log('Assistant: ');

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullContent += content;
      process.stdout.write(content);
    }

    console.log('\n');
    return fullContent;
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

// Usage
await streamChat('Write a haiku about coding');
```

## Browser Example

Streaming in the browser:

```typescript
import { CognipeerClient } from '@cognipeer/console-sdk';

const client = new CognipeerClient({ apiKey: 'your-api-key' });

async function displayStreamingResponse(prompt: string) {
  const outputElement = document.getElementById('output');
  outputElement.textContent = '';

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      outputElement.textContent += content;
    }
  } catch (error) {
    console.error('Error:', error);
    outputElement.textContent = 'Error: ' + error.message;
  }
}

// Usage
document.getElementById('submitBtn').addEventListener('click', () => {
  const input = document.getElementById('input').value;
  displayStreamingResponse(input);
});
```

## Handling Finish Reasons

Check when the stream completes:

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: prompt }],
  stream: true,
});

for await (const chunk of stream) {
  const choice = chunk.choices[0];
  
  if (choice?.delta?.content) {
    process.stdout.write(choice.delta.content);
  }
  
  if (choice?.finish_reason) {
    console.log('\nFinish reason:', choice.finish_reason);
    // 'stop' - natural completion
    // 'length' - max_tokens reached
    // 'content_filter' - content filtered
    // 'tool_calls' - tool call made
  }
}
```

## Streaming with Tool Calls

Stream responses that include tool calls:

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is the weather?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather information',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
      },
    },
  }],
  stream: true,
});

let toolCalls: any[] = [];

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  
  if (delta?.content) {
    process.stdout.write(delta.content);
  }
  
  if (delta?.tool_calls) {
    // Accumulate tool call deltas
    delta.tool_calls.forEach((tc: any) => {
      if (!toolCalls[tc.index]) {
        toolCalls[tc.index] = tc;
      } else {
        // Merge deltas
        if (tc.function?.arguments) {
          toolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    });
  }
  
  if (chunk.choices[0]?.finish_reason === 'tool_calls') {
    console.log('\nTool calls:', toolCalls);
  }
}
```

## Error Handling

Handle errors during streaming:

```typescript
import { CognipeerError } from '@cognipeer/console-sdk';

try {
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
} catch (error) {
  if (error instanceof CognipeerError) {
    console.error('Stream error:', error.message);
    console.error('Status:', error.status);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Cancelling Streams

Use AbortController to cancel streaming:

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const stream = await client.chat.completions.create(
    {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Write a long story' }],
      stream: true,
    },
    {
      signal: controller.signal,
    }
  );

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('\nStream cancelled');
  }
}
```

## Performance Tips

1. **Buffer Output**: Accumulate chunks before updating UI to reduce redraws
2. **Handle Backpressure**: Don't update UI faster than it can render
3. **Error Recovery**: Implement retry logic for network issues
4. **Timeouts**: Set reasonable timeouts to prevent hanging requests

## Buffering Example

```typescript
async function streamWithBuffering(prompt: string) {
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  let buffer = '';
  let lastUpdate = Date.now();
  const UPDATE_INTERVAL = 100; // Update UI every 100ms

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    buffer += content;

    // Update UI periodically, not on every chunk
    if (Date.now() - lastUpdate > UPDATE_INTERVAL) {
      console.log(buffer);
      buffer = '';
      lastUpdate = Date.now();
    }
  }

  // Flush remaining buffer
  if (buffer) {
    console.log(buffer);
  }
}
```

## React Example

Using streaming with React:

```typescript
import { useState } from 'react';
import { CognipeerClient } from '@cognipeer/console-sdk';

function ChatComponent() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  
  const client = new CognipeerClient({ apiKey: 'your-api-key' });

  async function handleSubmit(prompt: string) {
    setLoading(true);
    setResponse('');

    try {
      const stream = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        setResponse(prev => prev + content);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div>{response}</div>
      {loading && <div>Loading...</div>}
    </div>
  );
}
```

## Best Practices

1. **Always use streaming for chat**: Better UX for conversational interfaces
2. **Handle completion states**: Check finish_reason to know why stream ended
3. **Implement cancellation**: Allow users to stop long-running requests
4. **Buffer updates**: Don't update UI on every tiny chunk
5. **Error handling**: Gracefully handle network errors and stream interruptions
6. **Show loading states**: Indicate when stream is starting/ending

## Related

- [Chat API](/api/chat) - Complete chat API reference
- [Streaming Example](/examples/streaming) - Full streaming example
- [Error Handling](/guide/error-handling) - Handle streaming errors
