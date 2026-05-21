# MCP Console Example

Drive the built-in **Console MCP server** — the one that exposes Console
observability tools to any MCP-aware client.

## Run the example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com  # optional
export COGNIPEER_TRACING_SESSION_ID=sess_demo               # optional
npm run example:mcp-console
```

## Code

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const tools = await client.mcp.console.listTools();

// REST execute
const res = await client.mcp.console.execute({
  tool: tools[0].name,
  arguments: { sessionId: process.env.COGNIPEER_TRACING_SESSION_ID || 'sess_demo' },
});
console.log(res.result, res.metadata?.latencyMs);

// JSON-RPC initialize (what an MCP client would issue first)
const init = await client.mcp.console.initialize();
console.log(init.serverInfo, init.protocolVersion);

// Connection info for a native MCP client (SSE + message URL)
const info = client.mcp.console.getConnectionInfo(process.env.COGNIPEER_API_KEY!);
console.log(info.sseUrl);
console.log(info.messageUrlTemplate); // …?sessionId={sessionId}
```

## Tenant MCP servers

The same handle interface works for tenant-configured MCP servers:

```typescript
const handle = client.mcp.server('crm-bridge');
await handle.initialize();
const list = await handle.callJsonRpc<{ tools: { name: string }[] }>('tools/list');
const call = await handle.callTool(list.tools[0].name, { customerId: 'cus_42' });
```
