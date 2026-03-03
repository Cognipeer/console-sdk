import { HttpClient } from '../http';
import {
  Agent,
  AgentChatRequest,
  AgentChatResponse,
  AgentResponseCreateRequest,
  AgentResponse,
  ListAgentsQuery,
} from '../types';

/**
 * Agents API resource
 *
 * Create, list, and chat with AI agents using the OpenAI Responses API format.
 *
 * @example
 * ```typescript
 * // List agents
 * const agents = await client.agents.list();
 *
 * // Get agent details
 * const agent = await client.agents.get('my-agent-key');
 *
 * // Chat using Responses API (recommended)
 * const response = await client.agents.responses.create({
 *   model: 'my-agent-key',
 *   input: 'Hello!',
 * });
 * console.log(response.output[0].content[0].text);
 *
 * // Continue conversation
 * const followUp = await client.agents.responses.create({
 *   model: 'my-agent-key',
 *   input: 'Tell me more',
 *   previous_response_id: response.id,
 * });
 *
 * // Legacy chat (deprecated – use responses.create instead)
 * const legacy = await client.agents.chat('my-agent-key', {
 *   message: 'Hello!',
 * });
 * ```
 */
export class AgentsResource {
  private http: HttpClient;
  public readonly responses: AgentResponsesResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.responses = new AgentResponsesResource(http);
  }

  /**
   * List all agents
   * @param query - Optional filters
   * @returns Array of agents
   */
  async list(query?: ListAgentsQuery): Promise<Agent[]> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);

    const qs = params.toString();
    const path = `/api/client/v1/agents${qs ? `?${qs}` : ''}`;

    const response = await this.http.request<{ agents: Agent[] }>('GET', path);
    return response.agents ?? [];
  }

  /**
   * Get agent details by key
   * @param agentKey - The agent key
   * @returns Agent details
   */
  async get(agentKey: string): Promise<Agent> {
    const response = await this.http.request<{ agent: Agent }>(
      'GET',
      `/api/client/v1/agents/${encodeURIComponent(agentKey)}`,
    );
    return response.agent;
  }

  /**
   * Chat with an agent (legacy format)
   * @deprecated Use `client.agents.responses.create()` instead for OpenAI Responses API compatibility
   * @param agentKey - The agent key
   * @param params - Chat request parameters
   * @returns Chat response with content and conversation ID
   */
  async chat(agentKey: string, params: AgentChatRequest): Promise<AgentChatResponse> {
    // Translate legacy format to Responses API format
    const responsesReq: AgentResponseCreateRequest = {
      model: agentKey,
      input: params.message,
      ...(params.conversationId
        ? { previous_response_id: `resp_${params.conversationId}` }
        : {}),
    };

    const res = await this.http.request<AgentResponse>(
      'POST',
      `/api/client/v1/responses`,
      { body: responsesReq },
    );

    // Map back to legacy shape
    const text = res.output?.[0]?.content?.[0]?.text ?? '';
    const convId = res.id?.startsWith('resp_') ? res.id.slice(5) : res.id;
    return {
      content: text,
      conversationId: convId,
      agentKey,
    };
  }
}

/**
 * Sub-resource for OpenAI Responses API–compatible agent invocation
 */
export class AgentResponsesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a response (invoke the agent)
   *
   * Follows the OpenAI Responses API standard.
   * The agent is identified by the `model` field in the request body.
   * Pass `previous_response_id` to continue a multi-turn conversation.
   *
   * @param params - Responses API request body (must include `model` with the agent key)
   * @returns OpenAI Responses API–shaped response
   *
   * @example
   * ```typescript
   * // First turn
   * const res = await client.agents.responses.create({
   *   model: 'my-agent',
   *   input: 'What can you do?',
   * });
   *
   * // Follow-up turn
   * const res2 = await client.agents.responses.create({
   *   model: 'my-agent',
   *   input: 'Tell me more about the first option',
   *   previous_response_id: res.id,
   * });
   * ```
   */
  async create(params: AgentResponseCreateRequest): Promise<AgentResponse> {
    return this.http.request<AgentResponse>(
      'POST',
      `/api/client/v1/responses`,
      { body: params },
    );
  }
}
