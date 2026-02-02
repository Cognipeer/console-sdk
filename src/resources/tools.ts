import { HttpClient } from '../http';
import type { AgentToolDefinition, AgentToolAdapter } from '../types';

export class ToolsResource {
  constructor(private http: HttpClient) {}

  async listAgentTools(agentKey: string): Promise<AgentToolDefinition[]> {
    const response = await this.http.request<{ tools: AgentToolDefinition[] }>('GET', `/agents/${agentKey}/tools`);
    return response.tools || [];
  }

  async executeAgentTool(agentKey: string, toolKey: string, args?: Record<string, unknown>) {
    const response = await this.http.request<{ result: unknown }>(
      'POST',
      `/agents/${agentKey}/tools/${toolKey}/execute`,
      { body: { arguments: args ?? {} } },
    );
    return response.result;
  }

  async toAgentTools(agentKey: string): Promise<AgentToolAdapter[]> {
    const tools = await this.listAgentTools(agentKey);
    return tools.map((tool) => ({
      name: tool.key,
      description: tool.description || tool.name,
      schema: tool.schema,
      invoke: async (args: Record<string, unknown>) =>
        this.executeAgentTool(agentKey, tool.key, args),
    }));
  }
}
