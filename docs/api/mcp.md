# MCP API

Talk to the **built-in Console MCP server** (agent observability tools) or to
**tenant-configured MCP servers**. The same handle interface is used for both,
so a generic MCP client can be pointed at either surface.

## Surfaces

```typescript
client.mcp.console                  // built-in /client/v1/mcp/console
client.mcp.server('my-server-key')  // tenant /client/v1/mcp/:serverKey
```

Both return an `McpServerHandle` with these methods:

- `listTools()` — list advertised tools.
- `execute({ tool, arguments })` — REST-style "call one tool" wrapper.
- `initialize()` — JSON-RPC `initialize`.
- `callTool(name, args?)` — JSON-RPC `tools/call`.
- `callJsonRpc(method, params?, options?)` — raw dispatch.
- `getSseUrl()` / `getMessageUrl(sessionId)` — endpoint URL helpers for native
  MCP clients.
- `getConnectionInfo(apiKey)` — bundle SSE + message URL + Bearer header.

## Console MCP example

```typescript
const tools = await client.mcp.console.listTools();
console.log(tools.map((t) => t.name));

const result = await client.mcp.console.execute({
  tool: tools[0].name,
  arguments: { sessionId: 'sess_123' },
});

console.log(result.result, result.metadata?.latencyMs);
```

## Tenant MCP example (JSON-RPC)

```typescript
const handle = client.mcp.server('crm-bridge');

await handle.initialize();
const list = await handle.callJsonRpc<{ tools: { name: string }[] }>('tools/list');
const call = await handle.callTool(list.tools[0].name, { customerId: 'cus_42' });
console.log(call.isError ? 'failed' : call.content[0].text);
```

## Plugging a native MCP client into the SSE transport

```typescript
const info = client.mcp.console.getConnectionInfo(process.env.COGNIPEER_API_KEY!);

// Hand off to an MCP client library:
// info.sseUrl, info.messageUrlTemplate ("?sessionId={sessionId}"), info.authHeader
```

## Types

```typescript
interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface McpExecuteRequest {
  tool: string;
  arguments?: Record<string, unknown>;
}

interface McpExecuteResponse {
  result: unknown;
  metadata?: {
    latencyMs?: number;
    server?: string;
    tool?: string;
    [key: string]: unknown;
  };
}

interface McpConnectionInfo {
  serverKey: string;
  sseUrl: string;
  messageUrlTemplate: string; // ends with ?sessionId={sessionId}
  authHeader: string;
}
```
