# Agents API

List, retrieve, and invoke AI agents via the Console SDK. Agents are invoked through the OpenAI Responses API format.

## Quick Start

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Invoke an agent
const response = await client.agents.responses.create({
  model: 'support-bot',
  input: 'How do I reset my password?',
});

console.log(response.output);
```

## List Agents

Fetch all agents available to the current API token.

```typescript
const agents = await client.agents.list();
console.log(agents);

// Filter by status
const activeAgents = await client.agents.list({ status: 'active' });
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | string | No | Filter: `active`, `inactive`, `draft` |

### Return Type

```typescript
interface AgentListItem {
  key: string;
  name: string;
  description?: string;
  config: {
    modelKey: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
}
```

## Get Agent

Retrieve details for a specific agent.

```typescript
const agent = await client.agents.get('support-bot');
console.log(agent.name, agent.config.modelKey);
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentKey` | string | Yes | Unique agent key |

## Invoke Agent (Responses API)

Use `client.agents.responses.create()` to invoke an agent. The request format follows the OpenAI Responses API.

```typescript
const response = await client.agents.responses.create({
  model: 'support-bot',
  input: 'What are your business hours?',
});

console.log(response.id);     // "resp_64a1b2c3d4e5f6"
console.log(response.output); // Assistant response
console.log(response.usage);  // Token usage
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | string | Yes | Agent key |
| `input` | string \| InputItem[] | Yes | User message |
| `previous_response_id` | string | No | Continue a conversation |
| `version` | number | No | Specific published version |

### Multi-Turn Conversations

Pass `previous_response_id` to continue a conversation:

```typescript
const first = await client.agents.responses.create({
  model: 'support-bot',
  input: 'I have a billing question',
});

const followUp = await client.agents.responses.create({
  model: 'support-bot',
  input: 'Can you show me the pricing page?',
  previous_response_id: first.id,
});
```

### Response Type

```typescript
interface AgentResponse {
  id: string;
  object: 'response';
  model: string;
  output: ResponseOutput[];
  status: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  created_at: number;
  previous_response_id: string | null;
}

interface ResponseOutput {
  type: 'message';
  role: 'assistant';
  content: ResponseContent[];
}

interface ResponseContent {
  type: 'output_text';
  text: string;
}
```

## Legacy Chat Method

::: warning Deprecated
`client.agents.chat()` is deprecated. Use `client.agents.responses.create()` instead.
:::

```typescript
// Deprecated — avoid in new code
const result = await client.agents.chat('support-bot', {
  message: 'Hello',
});
```

## See Also

- [Agents API (Gateway)](https://cognipeer.github.io/cognipeer-console/api/agents)
- [Tools API](/api/tools) — Tools that can be bound to agents
- [Client Reference](/api/client)
