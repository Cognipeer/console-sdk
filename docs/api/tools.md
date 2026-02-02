# Tools API

Manage agent-bound tools and execute them via API tokens.

## Overview

Tools are defined in CognipeerAI Gateway and can be attached to agents. Use the SDK to list tools for an agent, execute a tool, or convert definitions to Agent SDK-compatible tool objects.

## listAgentTools

Fetch all tools assigned to an agent (including toolsets).

```ts
import { CGateClient } from '@cognipeer/cgate-sdk';

const client = new CGateClient({ apiKey: process.env.CGATE_API_KEY! });

const tools = await client.tools.listAgentTools('support-bot');
console.log(tools);
```

## executeAgentTool

Execute a tool by key with arguments.

```ts
const result = await client.tools.executeAgentTool('support-bot', 'search_docs', {
  query: 'billing plans',
});

console.log(result);
```

## toAgentTools

Convert the agent tool list into Agent SDK-compatible tool objects (`ToolInterface`).

```ts
import { createSmartAgent, fromLangchainModel } from '@cognipeer/agent-sdk';
import { ChatOpenAI } from '@langchain/openai';

const model = fromLangchainModel(new ChatOpenAI({ model: 'gpt-4o-mini' }));
const agentTools = await client.tools.toAgentTools('support-bot');

const agent = createSmartAgent({
  name: 'Support',
  model,
  tools: agentTools,
});
```

## Types

```ts
interface AgentToolDefinition {
  key: string;
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  toolsetKey?: string | null;
  executionType?: string;
}

interface AgentToolAdapter {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  invoke: (args: Record<string, unknown>) => Promise<unknown>;
}
```
