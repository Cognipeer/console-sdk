# Moderations API

OpenAI-compatible content classification backed by console guardrails. Use it to flag unsafe input or output before it reaches a model or a user.

## Overview

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });
```

## Classify content

```typescript
const moderation = await client.moderations.create({
  input: 'I want to hurt someone.',
});

if (moderation.results[0].flagged) {
  console.log(moderation.results[0].categories);
}
```

`input` may be a single string or an array of strings. Each entry produces one entry in `results`, with `flagged` plus a per-category breakdown.

## Selecting a guardrail

The optional `model` field selects which guardrail evaluates the request — pass any enabled guardrail key. When omitted, the tenant's first enabled guardrail with an active moderation policy is used.

```typescript
await client.moderations.create({
  input: ['first message', 'second message'],
  model: 'support-safety', // a guardrail key
});
```

## Methods

| Method | HTTP | Description |
| --- | --- | --- |
| `moderations.create(data)` | `POST /api/client/v1/moderations` | Classify one or more inputs |

See the console [Guardrails](/api/guardrails) resource for managing the policies that back moderation.
