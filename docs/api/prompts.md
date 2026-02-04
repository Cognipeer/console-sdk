# Prompts API

Manage reusable prompt templates with versioning and render them with data.

## Resource

```ts
const client = new CGateClient({ apiKey: 'your-api-key' });

// Access prompts resource
const prompts = client.prompts;
```

## List Prompts

```ts
const response = await client.prompts.list({ search: 'onboarding' });
console.log(response.prompts);
```

**Response:** `{ prompts: Prompt[] }`

## Get Prompt by Key

```ts
// Get latest version
const response = await client.prompts.get('welcome-email');
console.log(response.prompt);

// Get specific version
const responseV2 = await client.prompts.get('welcome-email', { version: 2 });
console.log(responseV2.prompt);
```

**Response:** `{ prompt: Prompt }`

## Render Prompt

```ts
// Render latest version
const response = await client.prompts.render('welcome-email', {
  data: {
    user: { name: 'Jane' },
    company: 'CognipeerAI',
  },
});
console.log(response.rendered);

// Render specific version
const responseV1 = await client.prompts.render('welcome-email', {
  version: 1,
  data: {
    user: { name: 'Jane' },
    company: 'CognipeerAI',
  },
});
```

**Response:**

```ts
{
  prompt: { key: string; name: string; description?: string; version?: number };
  rendered: string;
}
```

## List Prompt Versions

```ts
const response = await client.prompts.listVersions('welcome-email');
console.log(response.versions);
```

**Response:**

```ts
{
  prompt: { key: string; name: string };
  versions: PromptVersion[];
}
```

## Types

### `Prompt`

```ts
interface Prompt {
  id: string;
  key: string;
  name: string;
  description?: string;
  template: string;
  metadata?: Record<string, unknown>;
  currentVersion?: number;
  latestVersionId?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### `PromptVersion`

```ts
interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  name: string;
  description?: string;
  template?: string;
  isLatest: boolean;
  createdBy: string;
  createdAt?: string;
}
```

### `GetPromptOptions`

```ts
interface GetPromptOptions {
  version?: number;
}
```

### `RenderPromptOptions`

```ts
interface RenderPromptOptions {
  version?: number;
  data?: Record<string, unknown>;
}
```
