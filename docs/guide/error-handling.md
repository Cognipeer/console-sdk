# Error Handling

Learn how to properly handle errors in your Cognipeer Console SDK applications.

## Error Types

The SDK uses a custom `CognipeerError` class that extends the native `Error` class with additional properties.

### CognipeerError

```typescript
class CognipeerError extends Error {
  status?: number;      // HTTP status code
  code?: string;        // Error code
  type?: string;        // Error type
  message: string;      // Error message
}
```

## Basic Error Handling

Always wrap SDK calls in try-catch blocks:

```typescript
import { ConsoleClient, CognipeerError } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: 'your-api-key' });

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });
  
  console.log(response.choices[0].message.content);
} catch (error) {
  if (error instanceof CognipeerError) {
    console.error('Cognipeer Console SDK Error:', error.message);
    console.error('Status:', error.status);
    console.error('Code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Common Error Codes

### Authentication Errors (401)

```typescript
try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof CognipeerError && error.status === 401) {
    console.error('Invalid API key. Please check your credentials.');
    // Handle authentication error
  }
}
```

### Rate Limiting (429)

```typescript
try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof CognipeerError && error.status === 429) {
    console.error('Rate limit exceeded. Please retry after some time.');
    // Implement exponential backoff
  }
}
```

### Invalid Request (400)

```typescript
try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof CognipeerError && error.status === 400) {
    console.error('Invalid request:', error.message);
    // Check request parameters
  }
}
```

### Model Not Found (404)

```typescript
try {
  const response = await client.chat.completions.create({
    model: 'non-existent-model',
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  if (error instanceof CognipeerError && error.status === 404) {
    console.error('Model not found:', error.message);
    // Use a different model
  }
}
```

### Server Errors (500+)

```typescript
try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof CognipeerError && error.status && error.status >= 500) {
    console.error('Server error. Please try again later.');
    // Implement retry logic
  }
}
```

## Retry Logic

Implement exponential backoff for transient errors:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof CognipeerError) {
        // Retry on rate limits and server errors
        if (error.status === 429 || (error.status && error.status >= 500)) {
          if (i < maxRetries - 1) {
            const waitTime = delay * Math.pow(2, i);
            console.log(`Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}

// Usage
try {
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }],
    })
  );
  console.log(response);
} catch (error) {
  console.error('Failed after retries:', error);
}
```

## Timeout Handling

Set custom timeouts for requests:

```typescript
const client = new ConsoleClient({
  apiKey: 'your-api-key',
  timeout: 30000, // 30 seconds
});

try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof CognipeerError && error.code === 'ETIMEDOUT') {
    console.error('Request timed out');
    // Handle timeout
  }
}
```

## Validation Errors

Validate input before making API calls:

```typescript
function validateMessages(messages: ChatMessage[]) {
  if (!messages || messages.length === 0) {
    throw new Error('Messages array cannot be empty');
  }
  
  for (const message of messages) {
    if (!message.role || !message.content) {
      throw new Error('Each message must have role and content');
    }
  }
}

try {
  validateMessages(messages);
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  });
} catch (error) {
  console.error('Validation error:', error);
}
```

## Streaming Errors

Handle errors in streaming responses:

```typescript
try {
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
} catch (error) {
  if (error instanceof CognipeerError) {
    console.error('Streaming error:', error.message);
  }
}
```

## Error Recovery

Implement graceful degradation:

```typescript
async function getChatResponse(prompt: string) {
  const models = ['gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];
  
  for (const model of models) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      if (error instanceof CognipeerError) {
        if (error.status === 404) {
          console.log(`Model ${model} not available, trying next...`);
          continue;
        }
      }
      throw error;
    }
  }
  
  throw new Error('All models failed');
}
```

## Best Practices

1. **Always catch errors**: Never leave SDK calls unhandled
2. **Check error types**: Use `instanceof CognipeerError` to identify SDK errors
3. **Log errors**: Include status codes and error messages in logs
4. **Implement retries**: Use exponential backoff for transient errors
5. **Validate input**: Check parameters before making API calls
6. **Set timeouts**: Configure appropriate timeouts for your use case
7. **Graceful degradation**: Have fallback strategies for failures
8. **Monitor errors**: Track error rates in production

## Error Response Format

The API returns errors in the following format:

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

## Network Errors

Handle network-related issues:

```typescript
try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    console.error('Network error. Check your internet connection.');
  } else if (error instanceof CognipeerError) {
    console.error('API error:', error.message);
  }
}
```

## Related

- [Configuration](/guide/configuration) - Configure timeouts and retries
- [Client API](/api/client) - Client initialization options
- [Type Safety](/guide/type-safety) - Type-safe error handling
