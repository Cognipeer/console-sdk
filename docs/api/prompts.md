# Prompts API

Manage reusable prompt templates and render them with data.

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
const response = await client.prompts.get('welcome-email');
console.log(response.prompt);
```

**Response:** `{ prompt: Prompt }`

## Render Prompt

```ts
const response = await client.prompts.render('welcome-email', {
  user: { name: 'Jane' },
  company: 'CognipeerAI',
});

console.log(response.rendered);
```

**Response:**

```ts
{
  prompt: { key: string; name: string; description?: string };
  rendered: string;
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
  createdAt?: string;
  updatedAt?: string;
}
```
