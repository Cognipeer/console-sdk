# Tools API

Manage and execute tools from the unified tool system via the Console SDK.

## Overview

Tools are registered in Cognipeer Console backed by OpenAPI specs or MCP servers. Each tool exposes discrete **actions** that can be listed, executed directly, or converted into Agent SDK-compatible tool objects.

## list

Fetch all tools available to the current API token.

```ts
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });

const tools = await client.tools.list();
console.log(tools);

// Filter by status and type
const activeTools = await client.tools.list({ status: 'active', type: 'openapi' });
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | string | No | `active` or `disabled` |
| `type` | string | No | `openapi` or `mcp` |

## get

Get a specific tool by key.

```ts
const tool = await client.tools.get('weather-api');
console.log(tool.name, tool.actions);
```

## listActions

List all actions for a tool.

```ts
const actions = await client.tools.listActions('weather-api');
actions.forEach(a => console.log(a.key, a.description));
```

## execute

Execute a specific action on a tool.

```ts
const result = await client.tools.execute('weather-api', 'get-current-weather', {
  location: 'Istanbul',
});

console.log(result);
// { result: { temperature: 22, ... }, latencyMs: 234, toolKey: 'weather-api', actionKey: 'get-current-weather' }
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolKey` | string | Yes | Tool key |
| `actionKey` | string | Yes | Action key within the tool |
| `args` | object | No | Arguments for the action |

## toAgentTools

Convert a tool's actions into Agent SDK-compatible `ToolInterface` objects. This lets you bind Console-managed tools directly into an agent-sdk agent.

```ts
import { createSmartAgent, fromLangchainModel } from '@cognipeer/agent-sdk';
import { ChatOpenAI } from '@langchain/openai';

const model = fromLangchainModel(new ChatOpenAI({ model: 'gpt-4o-mini' }));
const agentTools = await client.tools.toAgentTools('weather-api');

const agent = createSmartAgent({
  name: 'Weather Assistant',
  model,
  tools: agentTools,
});
```

## Legacy Methods

::: warning Deprecated
The following methods are deprecated. Use the new methods above instead.
:::

### listAgentTools

```ts
// Deprecated — use client.tools.list() or client.tools.listActions()
const tools = await client.tools.listAgentTools('support-bot');
```

### executeAgentTool

```ts
// Deprecated — use client.tools.execute()
const result = await client.tools.executeAgentTool('support-bot', 'search_docs', {
  query: 'billing plans',
});
```

## Types

```ts
interface ToolListItem {
  key: string;
  name: string;
  description?: string;
  type: 'openapi' | 'mcp';
  status: 'active' | 'disabled';
  actions: ToolAction[];
  createdAt: string;
}

interface ToolAction {
  key: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolExecuteResult {
  result: unknown;
  latencyMs: number;
  toolKey: string;
  actionKey: string;
}

interface ToolActionAdapter {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  invoke: (args: Record<string, unknown>) => Promise<unknown>;
}
```

## See Also

- [Tools API (Gateway)](https://cognipeer.github.io/cognipeer-console/api/tools)
- [Agents API](/api/agents) — Agents can bind tools
- [Client Reference](/api/client)
