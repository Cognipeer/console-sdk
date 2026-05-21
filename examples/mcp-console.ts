import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  if (!apiKey) throw new Error('COGNIPEER_API_KEY is required');

  const client = new ConsoleClient({
    apiKey,
    ...(process.env.COGNIPEER_BASE_URL ? { baseURL: process.env.COGNIPEER_BASE_URL } : {}),
  });

  console.log('Built-in Console MCP server\n');

  const tools = await client.mcp.console.listTools();
  console.log(`Server advertises ${tools.length} tools:`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description?.slice(0, 80) ?? ''}`);
  }

  if (tools.length === 0) {
    return;
  }

  // Run the first tool through the REST surface.
  const first = tools[0];
  const args = first.name.includes('session')
    ? { sessionId: process.env.COGNIPEER_TRACING_SESSION_ID || 'sess_demo' }
    : {};

  console.log(`\nExecuting ${first.name}…`);
  const res = await client.mcp.console.execute({
    tool: first.name,
    arguments: args,
  });
  console.log('Result    :', res.result);
  console.log('LatencyMs :', res.metadata?.latencyMs);

  // JSON-RPC dispatch (what an MCP client would do under the hood).
  const init = await client.mcp.console.initialize();
  console.log('\nMCP server info:', init.serverInfo, 'protocol', init.protocolVersion);

  // Print connection info for native MCP clients
  const info = client.mcp.console.getConnectionInfo(apiKey);
  console.log('\nSSE endpoint   :', info.sseUrl);
  console.log('Message URL    :', info.messageUrlTemplate);
  console.log('Auth header    :', info.authHeader.slice(0, 20) + '…');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
