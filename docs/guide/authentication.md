# Authentication

Learn how to authenticate with the Cognipeer Console API.

## API Keys

The Cognipeer Console SDK uses API keys for authentication. All API requests must include a valid API key.

## Getting Your API Key

1. Sign up at [Cognipeer Console](https://cognipeer.com)
2. Navigate to your dashboard
3. Go to **Settings** → **API Tokens**
4. Click **Create New Token**
5. Give your token a name and set permissions
6. Copy the token (it will only be shown once!)

## Using Your API Key

### Basic Usage

Pass your API key when creating the client:

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: 'cg_1234567890abcdef',
});
```

### Environment Variables (Recommended)

Store your API key in an environment variable:

```bash
export COGNIPEER_API_KEY=cg_1234567890abcdef
```

Then use it in your code:

```typescript
const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});
```

### .env Files

For local development, use a `.env` file:

```bash
# .env
COGNIPEER_API_KEY=cg_1234567890abcdef
```

With dotenv:

```typescript
import 'dotenv/config';
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});
```

## Security Best Practices

### ✅ DO

- Store API keys in environment variables
- Use different keys for development and production
- Rotate keys regularly
- Restrict key permissions to minimum required
- Use `.env` files for local development (add to `.gitignore`)

### ❌ DON'T

- Hardcode API keys in source code
- Commit API keys to version control
- Share API keys in public channels
- Use production keys in development
- Log API keys in application logs

## Token Management

### Creating Tokens

In your Cognipeer Console dashboard:

1. Navigate to **API Tokens**
2. Click **Create Token**
3. Configure:
   - Name: Descriptive name (e.g., "Production API", "Dev Testing")
   - Permissions: Select required permissions
   - Expiration: Set expiration date (optional)

### Revoking Tokens

If a token is compromised:

1. Go to **API Tokens** in your dashboard
2. Find the compromised token
3. Click **Revoke**
4. Create a new token
5. Update your application with the new token

### Token Rotation

Rotate tokens regularly for security:

```typescript
// config.ts
export function getClient() {
  const apiKey = process.env.COGNIPEER_API_KEY || process.env.COGNIPEER_API_KEY_BACKUP;
  
  if (!apiKey) {
    throw new Error('No API key found');
  }
  
  return new ConsoleClient({ apiKey });
}
```

## Multi-Environment Setup

### Development

```typescript
// config/development.ts
export const client = new ConsoleClient({
  apiKey: process.env.DEV_COGNIPEER_API_KEY!,
  baseURL: 'http://localhost:3000/api/client/v1',
});
```

### Staging

```typescript
// config/staging.ts
export const client = new ConsoleClient({
  apiKey: process.env.STAGING_COGNIPEER_API_KEY!,
  baseURL: 'https://staging-api.cognipeer.com/api/client/v1',
});
```

### Production

```typescript
// config/production.ts
export const client = new ConsoleClient({
  apiKey: process.env.PROD_COGNIPEER_API_KEY!,
  // Uses default production URL
});
```

### Environment Selector

```typescript
// config/index.ts
const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    apiKey: process.env.DEV_COGNIPEER_API_KEY!,
    baseURL: 'http://localhost:3000/api/client/v1',
  },
  staging: {
    apiKey: process.env.STAGING_COGNIPEER_API_KEY!,
    baseURL: 'https://staging-api.cognipeer.com/api/client/v1',
  },
  production: {
    apiKey: process.env.PROD_COGNIPEER_API_KEY!,
  },
};

export const client = new ConsoleClient(configs[env]);
```

## Error Handling

### Invalid API Key

```typescript
import { CognipeerAPIError } from '@cognipeer/console-sdk';

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  if (error instanceof CognipeerAPIError && error.statusCode === 401) {
    console.error('Invalid API key. Please check your credentials.');
    // Handle authentication error
  }
}
```

### Expired Token

```typescript
if (error instanceof CognipeerAPIError && error.errorType === 'token_expired') {
  console.error('Token expired. Please refresh your API key.');
  // Notify user to refresh token
}
```

## Testing with Mock Keys

For testing, use mock API keys:

```typescript
// test/setup.ts
import { ConsoleClient } from '@cognipeer/console-sdk';

export function createTestClient() {
  return new ConsoleClient({
    apiKey: 'test_mock_key_12345',
    baseURL: 'http://localhost:3000/api/client/v1',
  });
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
        env:
          COGNIPEER_API_KEY: ${{ secrets.COGNIPEER_API_KEY }}
```

### Environment Secrets

Store API keys in CI/CD secrets:

- GitHub: Settings → Secrets → Actions
- GitLab: Settings → CI/CD → Variables
- CircleCI: Project Settings → Environment Variables

## Compliance

### GDPR

- API keys are personal data
- Users can request key deletion
- Log key usage for audit trails

### SOC 2

- Rotate keys quarterly
- Use separate keys per environment
- Implement key access logging
- Revoke keys when employees leave

## Troubleshooting

### "Invalid API Token" Error

Check:
1. Key is correctly copied (no extra spaces)
2. Key hasn't been revoked
3. Key hasn't expired
4. Using correct environment key

### "Forbidden" Error

Check:
1. Token has required permissions
2. Token is active
3. Feature is available in your plan

## See Also

- [Configuration Guide](/guide/configuration)
- [Error Handling](/guide/error-handling)
- [Getting Started](/guide/getting-started)
