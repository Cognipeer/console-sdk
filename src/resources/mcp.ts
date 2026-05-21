import { HttpClient } from '../http';
import {
  McpConnectionInfo,
  McpConsoleListToolsResponse,
  McpExecuteRequest,
  McpExecuteResponse,
  McpInitializeResult,
  McpToolDescriptor,
  McpToolsListResult,
} from '../types';

const JSONRPC_VERSION = '2.0';
const DEFAULT_PROTOCOL_VERSION = '2024-11-05';

interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id: string | number | null;
  result?: T;
  error?: { code: number; message: string };
}

/**
 * MCP (Model Context Protocol) API resource.
 *
 * Two surfaces are exposed:
 *   - `client.mcp.server('my-server-key')`   — talk to a tenant-configured MCP
 *     server.
 *   - `client.mcp.console`                   — talk to the built-in Console MCP
 *     server (`/client/v1/mcp/console/*`) which exposes Console observability
 *     tools.
 *
 * Both surfaces share the same set of helpers (`listTools`, `execute`,
 * `initialize`, `callTool`, plus SSE/message URL builders) so they can be
 * driven uniformly by an MCP client.
 *
 * @example
 * ```typescript
 * const tools = await client.mcp.console.listTools();
 * const result = await client.mcp.console.execute({
 *   tool: tools[0].name,
 *   arguments: { sessionId: 'sess_123' },
 * });
 * ```
 */
export class McpResource {
  private http: HttpClient;
  public readonly console: McpServerHandle;

  constructor(http: HttpClient) {
    this.http = http;
    this.console = new McpServerHandle(http, 'console', '/api/client/v1/mcp/console');
  }

  /** Get a handle to a tenant-configured MCP server identified by `serverKey`. */
  server(serverKey: string): McpServerHandle {
    return new McpServerHandle(
      this.http,
      serverKey,
      `/api/client/v1/mcp/${encodeURIComponent(serverKey)}`,
    );
  }
}

export class McpServerHandle {
  private http: HttpClient;
  private basePath: string;
  public readonly serverKey: string;

  constructor(http: HttpClient, serverKey: string, basePath: string) {
    this.http = http;
    this.serverKey = serverKey;
    this.basePath = basePath;
  }

  /** REST: list the tools the server advertises. */
  async listTools(): Promise<McpToolDescriptor[]> {
    if (this.serverKey === 'console') {
      const res = await this.http.request<McpConsoleListToolsResponse>(
        'GET',
        `${this.basePath}/execute`,
      );
      return res.tools ?? [];
    }
    // Tenant MCP servers don't expose GET-list; use JSON-RPC tools/list.
    const res = await this.callJsonRpc<McpToolsListResult>('tools/list');
    return res.tools ?? [];
  }

  /** REST: execute a single tool via the tenant-friendly wrapper. */
  async execute(params: McpExecuteRequest): Promise<McpExecuteResponse> {
    return this.http.request<McpExecuteResponse>(
      'POST',
      `${this.basePath}/execute`,
      { body: params },
    );
  }

  /** JSON-RPC: initialize the MCP server (returns capabilities + server info). */
  async initialize(): Promise<McpInitializeResult> {
    return this.callJsonRpc<McpInitializeResult>('initialize', {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'cognipeer-console-sdk', version: '1.0.0' },
    });
  }

  /** JSON-RPC: call a tool by name. */
  async callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ content: Array<{ text: string; type: string }>; isError: boolean }> {
    return this.callJsonRpc('tools/call', {
      name,
      arguments: args ?? {},
    });
  }

  /** Raw JSON-RPC dispatch. */
  async callJsonRpc<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options: { sessionId?: string; id?: string | number } = {},
  ): Promise<T> {
    const id = options.id ?? Math.floor(Math.random() * 1e9);
    const body: JsonRpcRequest = {
      jsonrpc: JSONRPC_VERSION,
      id,
      method,
      ...(params ? { params } : {}),
    };

    const res = await this.http.request<JsonRpcResponse<T>>(
      'POST',
      `${this.basePath}/message`,
      {
        body,
        query: options.sessionId ? { sessionId: options.sessionId } : undefined,
      },
    );

    if (res.error) {
      throw new Error(`MCP RPC error ${res.error.code}: ${res.error.message}`);
    }
    return res.result as T;
  }

  /** Absolute SSE URL for streaming events from the MCP server. */
  getSseUrl(): string {
    return this.http.resolveURL(`${this.basePath}/sse`);
  }

  /** Absolute message URL for a particular SSE session. */
  getMessageUrl(sessionId: string): string {
    return this.http.resolveURL(`${this.basePath}/message`, { sessionId });
  }

  /** Convenience: bundle the SSE + message + auth header info for an MCP client. */
  getConnectionInfo(apiKey: string): McpConnectionInfo {
    return {
      serverKey: this.serverKey,
      sseUrl: this.getSseUrl(),
      messageUrlTemplate: `${this.http.resolveURL(`${this.basePath}/message`)}?sessionId={sessionId}`,
      authHeader: `Bearer ${apiKey}`,
    };
  }
}
