# Prompts API

Manage reusable prompt templates with versioning and render them with data.

## Resource

```ts
const client = new CognipeerClient({ apiKey: 'your-api-key' });

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

// Get version resolved by environment label
const responseProd = await client.prompts.get('welcome-email', { environment: 'prod' });
console.log(responseProd.prompt);
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

// Render environment-active version
const responseStaging = await client.prompts.render('welcome-email', {
  environment: 'staging',
  data: {
    user: { name: 'Jane' },
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

## Deployment Flow (Manual Controlled Rollout)

Prompt deployments are environment-based (`dev` / `staging` / `prod`) and use a manual sequence:

1. `promote` a version to an environment
2. mark as `plan`
3. `activate`
4. `rollback` when needed

### Get Deployments

```ts
const deployments = await client.prompts.getDeployments('welcome-email');
console.log(deployments.deployments);
```

### Promote / Plan / Activate / Rollback

```ts
// 1) Promote a specific version to staging
await client.prompts.deploy('welcome-email', {
  action: 'promote',
  environment: 'staging',
  versionId: 'ver_123',
  note: 'Candidate for QA sign-off',
});

// 2) Mark deployment plan
await client.prompts.deploy('welcome-email', {
  action: 'plan',
  environment: 'staging',
  note: 'Planned release window: tonight',
});

// 3) Activate rollout
await client.prompts.deploy('welcome-email', {
  action: 'activate',
  environment: 'staging',
});

// 4) Fast rollback to previous active version
await client.prompts.deploy('welcome-email', {
  action: 'rollback',
  environment: 'staging',
  note: 'Regression detected in smoke test',
});
```

## Compare Versions

```ts
const compare = await client.prompts.compare(
  'welcome-email',
  'ver_123',
  'ver_124',
);

console.log(compare.comparison.templateDiff);
console.log(compare.comparison.deploymentHistory);
console.log(compare.comparison.comments);
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
  deployments?: Partial<Record<PromptEnvironment, PromptDeploymentState>>;
  deploymentHistory?: PromptDeploymentEvent[];
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
  environment?: PromptEnvironment;
}
```

### `RenderPromptOptions`

```ts
interface RenderPromptOptions {
  version?: number;
  environment?: PromptEnvironment;
  data?: Record<string, unknown>;
}

### `DeployPromptOptions`

```ts
interface DeployPromptOptions {
  action: 'promote' | 'plan' | 'activate' | 'rollback';
  environment: 'dev' | 'staging' | 'prod';
  versionId?: string;
  note?: string;
}
```
```
