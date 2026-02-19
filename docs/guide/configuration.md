# Client Configuration

Learn how to configure the Cognipeer Console SDK client for different environments and use cases.

## Basic Configuration

```typescript
import { CognipeerClient } from '@cognipeer/console-sdk';

const client = new CognipeerClient({
  apiKey: 'your-api-key',
});
```

## Configuration Options

### API Key (Required)

Your Cognipeer Console API token:

```typescript
const client = new CognipeerClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});
```

::: tip Security Best Practice
Always use environment variables for API keys. Never commit API keys to version control.
:::

### Base URL (Optional)

Override the default API endpoint:

```typescript
const client = new CognipeerClient({
  apiKey: 'your-api-key',
  baseURL: 'https://custom.api.example.com',
});
```

**Default**: `https://api.cognipeer.com/api/client/v1`

### Timeout (Optional)

Request timeout in milliseconds:

```typescript
const client = new CognipeerClient({
  apiKey: 'your-api-key',
  timeout: 30000, // 30 seconds
});
```

**Default**: `60000` (60 seconds)

### Max Retries (Optional)

Maximum number of retry attempts for failed requests:

```typescript
const client = new CognipeerClient({
  apiKey: 'your-api-key',
  maxRetries: 5,
});
```

**Default**: `3`

### Custom Fetch (Optional)

Provide a custom fetch implementation:

```typescript
import fetch from 'node-fetch';

const client = new CognipeerClient({
  apiKey: 'your-api-key',
  fetch: fetch as any,
});
```

## Environment-Specific Configurations

### Development

```typescript
const client = new CognipeerClient({
  apiKey: process.env.DEV_API_KEY!,
  baseURL: 'http://localhost:3000/api/client/v1',
  timeout: 120000, // Longer timeout for debugging
});
```

### Production

```typescript
const client = new CognipeerClient({
  apiKey: process.env.PROD_API_KEY!,
  baseURL: 'https://api.cognipeer.com/api/client/v1',
  timeout: 60000,
  maxRetries: 3,
});
```

### Testing

```typescript
const client = new CognipeerClient({
  apiKey: 'test-api-key',
  baseURL: 'http://localhost:3000/api/client/v1',
  maxRetries: 0, // No retries in tests
});
```

## Configuration Patterns

### Singleton Pattern

Create a single client instance for your application:

```typescript
// config/client.ts
let clientInstance: CognipeerClient | null = null;

export function getClient(): CognipeerClient {
  if (!clientInstance) {
    clientInstance = new CognipeerClient({
      apiKey: process.env.COGNIPEER_API_KEY!,
    });
  }
  return clientInstance;
}

// usage.ts
import { getClient } from './config/client';

const client = getClient();
```

### Factory Pattern

Create clients dynamically:

```typescript
function createClient(options: {
  environment: 'development' | 'production';
  apiKey: string;
}): CognipeerClient {
  const baseURLs = {
    development: 'http://localhost:3000/api/client/v1',
    production: 'https://api.cognipeer.com/api/client/v1',
  };

  return new CognipeerClient({
    apiKey: options.apiKey,
    baseURL: baseURLs[options.environment],
  });
}

const client = createClient({
  environment: 'production',
  apiKey: process.env.COGNIPEER_API_KEY!,
});
```

### Multi-Tenant Pattern

Manage multiple clients for different tenants:

```typescript
class ClientManager {
  private clients: Map<string, CognipeerClient> = new Map();

  getClient(tenantId: string, apiKey: string): CognipeerClient {
    if (!this.clients.has(tenantId)) {
      this.clients.set(
        tenantId,
        new CognipeerClient({ apiKey })
      );
    }
    return this.clients.get(tenantId)!;
  }
}

const manager = new ClientManager();
const clientA = manager.getClient('tenant-a', 'key-a');
const clientB = manager.getClient('tenant-b', 'key-b');
```

## Error Handling Configuration

Configure error handling globally:

```typescript
import { CognipeerAPIError } from '@cognipeer/console-sdk';

const client = new CognipeerClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

async function safeRequest<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CognipeerAPIError) {
      console.error('API Error:', error.message);
      console.error('Status:', error.statusCode);
    }
    return null;
  }
}

// Usage
const response = await safeRequest(() =>
  client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  })
);
```

## Logging Configuration

Add request/response logging:

```typescript
class LoggingClient extends CognipeerClient {
  async chat.completions.create(params: any) {
    console.log('[Request]', JSON.stringify(params, null, 2));
    const response = await super.chat.completions.create(params);
    console.log('[Response]', JSON.stringify(response, null, 2));
    return response;
  }
}
```

## Environment Variables

Recommended environment variables:

```bash
# .env.example
COGNIPEER_API_KEY=your-api-key
COGNIPEER_BASE_URL=https://api.cognipeer.com/api/client/v1
COGNIPEER_TIMEOUT=60000
COGNIPEER_MAX_RETRIES=3
```

Load configuration from environment:

```typescript
const client = new CognipeerClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
  timeout: parseInt(process.env.COGNIPEER_TIMEOUT || '60000'),
  maxRetries: parseInt(process.env.COGNIPEER_MAX_RETRIES || '3'),
});
```

## Best Practices

1. **Use Environment Variables**: Never hardcode API keys
2. **Singleton Pattern**: Reuse client instances
3. **Error Handling**: Always wrap requests in try/catch
4. **Timeouts**: Set appropriate timeouts for your use case
5. **Retries**: Configure retries based on your requirements
6. **Logging**: Add logging for debugging in development

## See Also

- [Authentication](/guide/authentication)
- [Error Handling](/guide/error-handling)
- [Getting Started](/guide/getting-started)
