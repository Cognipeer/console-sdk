import { HttpClient } from '../http';
import type {
  AgentToolDefinition,
  ToolDefinition,
  ToolAction,
  ToolExecutionResult,
  ToolActionAdapter,
} from '../types';

export class ToolsResource {
  constructor(private http: HttpClient) {}

  // ── Unified Tool System ────────────────────────────────────────────

  /**
   * List all tools for the current tenant.
   * @param options Optional filters: status, type
   */
  async list(options?: { status?: string; type?: string }): Promise<ToolDefinition[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.type) params.set('type', options.type);
    const qs = params.toString();
    const url = `/tools${qs ? `?${qs}` : ''}`;
    const response = await this.http.request<{ tools: ToolDefinition[] }>('GET', url);
    return response.tools || [];
  }

  /**
   * Get a single tool by its key.
   */
  async get(toolKey: string): Promise<ToolDefinition> {
    const response = await this.http.request<{ tool: ToolDefinition }>('GET', `/tools/${toolKey}`);
    return response.tool;
  }

  /**
   * List actions for a specific tool.
   */
  async listActions(toolKey: string): Promise<ToolAction[]> {
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
    return this.http.request<ToolExecutionResult>(
      'POST',
      `/tools/${toolKey}/actions/${actionKey}/execute`,
      { body: { arguments: args ?? {} } },
    );
  }

  /**
   * Convert all actions of a tool into ToolActionAdapter[] compatible with agent-sdk.
   * Each adapter can be directly passed to createTool().
   */
  async toAgentTools(toolKey: string): Promise<ToolActionAdapter[]> {
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
    const response = await this.http.request<{ tools: AgentToolDefinition[] }>('GET', `/agents/${agentKey}/tools`);
    return response.tools || [];
  }

  /**
   * @deprecated Use `execute()` instead
   */
  async executeAgentTool(agentKey: string, toolKey: string, args?: Record<string, unknown>) {
    const response = await this.http.request<{ result: unknown }>(
      'POST',
      `/agents/${agentKey}/tools/${toolKey}/execute`,
      { body: { arguments: args ?? {} } },
    );
    return response.result;
  }
}
