import { HttpClient } from '../http';
import type {
  AgentToolDefinition,
  ToolCreateRequest,
  ToolDefinition,
  ToolAction,
  ToolExecutionResult,
  ToolActionAdapter,
  ToolUpdateRequest,
} from '../types';

/**
 * @deprecated The `/api/client/v1/tools*` endpoints this resource calls are
 * no longer served by the Console runtime — the server-side route was
 * retired and every method here now fails with a 404, regardless of what
 * this class's own source suggests. This file's continued presence in the
 * SDK is exactly the trap: it type-checks and looks supported, but nothing
 * on the other end answers it.
 *
 * For tool execution and management against a current server, use:
 *   - `client.mcp` for MCP server/tool registration and execution
 *     (`createServer`, `refreshTools`, `listTools`, `execute`, `callTool`).
 *   - `client.agents` for binding tools to an agent's own config
 *     (`toolBindings` on the agent definition).
 *
 * This class is kept only so existing `client.tools.*` call sites fail with
 * a clear warning instead of silently returning `undefined` after a build
 * error; it will be removed in a future major version.
 */
export class ToolsResource {
  private warned = false;

  constructor(private http: HttpClient) {}

  /** Emitted once per instance, on first use, not from the constructor —
   * most SDK consumers never touch `client.tools` at all, and warning
   * unconditionally on every Client construction would warn at every one
   * of them regardless. */
  private warnDeprecated(method: string): void {
    if (this.warned) return;
    this.warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[console-sdk] client.tools.${method}() calls /api/client/v1/tools, which the Console server no longer serves ` +
      '(the endpoint was retired; this call will 404). Use client.mcp for tool execution/management, or ' +
      'client.agents for an agent\'s own toolBindings. ToolsResource is deprecated and will be removed in a future major version.',
    );
  }

  // ── Unified Tool System ────────────────────────────────────────────

  /**
   * List all tools for the current tenant.
   * @param options Optional filters: status, type
   */
  async list(options?: { status?: string; type?: string }): Promise<ToolDefinition[]> {
    this.warnDeprecated('list');
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.type) params.set('type', options.type);
    const qs = params.toString();
    const url = `/api/client/v1/tools${qs ? `?${qs}` : ''}`;
    const response = await this.http.request<{ tools: ToolDefinition[] }>('GET', url);
    return response.tools || [];
  }

  /**
   * Get a single tool by its key.
   */
  async get(toolKey: string): Promise<ToolDefinition> {
    this.warnDeprecated('get');
    const response = await this.http.request<{ tool: ToolDefinition }>('GET', `/api/client/v1/tools/${toolKey}`);
    return response.tool;
  }

  /**
   * Create a tool definition. Actions are discovered from the source
   * (OpenAPI spec or MCP endpoint) on creation.
   * @param params Tool creation parameters (name + type required)
   */
  async create(params: ToolCreateRequest): Promise<ToolDefinition> {
    this.warnDeprecated('create');
    const response = await this.http.request<{ tool: ToolDefinition }>(
      'POST',
      '/api/client/v1/tools',
      { body: params },
    );
    return response.tool;
  }

  /**
   * Update a tool definition.
   * @param toolKey The tool key
   * @param params Fields to update
   */
  async update(toolKey: string, params: ToolUpdateRequest): Promise<ToolDefinition> {
    this.warnDeprecated('update');
    const response = await this.http.request<{ tool: ToolDefinition }>(
      'PATCH',
      `/api/client/v1/tools/${encodeURIComponent(toolKey)}`,
      { body: params },
    );
    return response.tool;
  }

  /**
   * Re-discover the tool's actions from its source (OpenAPI spec / MCP endpoint).
   * @param toolKey The tool key
   */
  async syncActions(toolKey: string): Promise<ToolDefinition> {
    this.warnDeprecated('syncActions');
    const response = await this.http.request<{ tool: ToolDefinition }>(
      'POST',
      `/api/client/v1/tools/${encodeURIComponent(toolKey)}/sync`,
    );
    return response.tool;
  }

  /**
   * Delete a tool definition.
   * @param toolKey The tool key
   */
  async delete(toolKey: string): Promise<{ success: boolean }> {
    this.warnDeprecated('delete');
    return this.http.request<{ success: boolean }>(
      'DELETE',
      `/api/client/v1/tools/${encodeURIComponent(toolKey)}`,
    );
  }

  /**
   * List actions for a specific tool.
   */
  async listActions(toolKey: string): Promise<ToolAction[]> {
    this.warnDeprecated('listActions');
    const tool = await this.get(toolKey);
    return tool.actions || [];
  }

  /**
   * Execute a specific action on a tool.
   * @param toolKey The tool key
   * @param actionKey The action key within the tool
   * @param args Arguments to pass to the action
   */
  async execute(
    toolKey: string,
    actionKey: string,
    args?: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    this.warnDeprecated('execute');
    return this.http.request<ToolExecutionResult>(
      'POST',
      `/api/client/v1/tools/${toolKey}/actions/${actionKey}/execute`,
      { body: { arguments: args ?? {} } },
    );
  }

  /**
   * Convert all actions of a tool into ToolActionAdapter[] compatible with agent-sdk.
   * Each adapter can be directly passed to createTool().
   */
  async toAgentTools(toolKey: string): Promise<ToolActionAdapter[]> {
    this.warnDeprecated('toAgentTools');
    const tool = await this.get(toolKey);
    return (tool.actions || []).map((action) => ({
      name: action.name,
      description: action.description || action.name,
      schema: action.inputSchema,
      invoke: async (args: Record<string, unknown>) => {
        const result = await this.execute(toolKey, action.key, args);
        return result.result;
      },
    }));
  }

  // ── Legacy Agent Tool Methods ──────────────────────────────────────
  // Kept for backward compatibility with existing integrations.

  /**
   * @deprecated Use `list()` and `toAgentTools()` instead
   */
  async listAgentTools(agentKey: string): Promise<AgentToolDefinition[]> {
    this.warnDeprecated('listAgentTools');
    const response = await this.http.request<{ tools: AgentToolDefinition[] }>('GET', `/api/client/v1/agents/${agentKey}/tools`);
    return response.tools || [];
  }

  /**
   * @deprecated Use `execute()` instead
   */
  async executeAgentTool(agentKey: string, toolKey: string, args?: Record<string, unknown>) {
    this.warnDeprecated('executeAgentTool');
    const response = await this.http.request<{ result: unknown }>(
      'POST',
      `/api/client/v1/agents/${agentKey}/tools/${toolKey}/execute`,
      { body: { arguments: args ?? {} } },
    );
    return response.result;
  }
}
