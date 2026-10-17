import { HttpClient } from '../http';
import { AgentRoutinesResource } from './agentRoutines';
import { AgentRunsResource } from './agentRuns';
import { AgentSessionsResource } from './agentSessions';
import {
  Agent,
  AgentCreateRequest,
  AgentPublishRequest,
  AgentResponseCreateOptions,
  AgentResponseCreateRequest,
  AgentResponse,
  AgentResponseStreamEvent,
  AgentUpdateRequest,
  AgentVersion,
  ListAgentsQuery,
} from '../types';

export { AgentRunsResource } from './agentRuns';
export { AgentRoutinesResource } from './agentRoutines';

/**
 * Agents API resource
 *
 * Create, list and run AI agents: the OpenAI Responses API format for chat-style
 * calls, the runs API for jobs (async, scheduled, deferred) and routines for recurring work.
 *
 * @example
 * ```typescript
 * // List agents
 * const agents = await client.agents.list();
 *
 * // Get agent details
 * const agent = await client.agents.get('my-agent-key');
 *
 * // Chat using the Responses API (runs the published version)
 * const response = await client.agents.responses.create({
 *   model: 'my-agent-key',
 *   input: 'Hello!',
 * });
 * console.log(response.output_text);
 *
 * // Continue conversation
 * const followUp = await client.agents.responses.create({
 *   model: 'my-agent-key',
 *   input: 'Tell me more',
 *   previous_response_id: response.id,
 * });
 *
 * // A job: start a run, then wait for it
 * const run = await client.agents.runs.create('my-agent-key', { input: 'Report', class: 'deferred' });
 * const done = await client.agents.runs.wait(run.id);
 * ```
 */
export class AgentsResource {
  private http: HttpClient;
  public readonly responses: AgentResponsesResource;
  public readonly runs: AgentRunsResource;
  public readonly routines: AgentRoutinesResource;
  public readonly sessions: AgentSessionsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.responses = new AgentResponsesResource(http);
    this.runs = new AgentRunsResource(http);
    this.routines = new AgentRoutinesResource(http);
    this.sessions = new AgentSessionsResource(http);
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
   * Create an agent definition.
   * @param params - Agent creation parameters (name + config required)
   * @returns The created agent
   */
  async create(params: AgentCreateRequest): Promise<Agent> {
    const response = await this.http.request<{ agent: Agent }>(
      'POST',
      '/api/client/v1/agents',
      { body: params },
    );
    return response.agent;
  }

  /**
   * Update an agent definition.
   * @param agentKey - The agent key
   * @param params - Fields to update
   * @returns The updated agent
   */
  async update(agentKey: string, params: AgentUpdateRequest): Promise<Agent> {
    const response = await this.http.request<{ agent: Agent }>(
      'PATCH',
      `/api/client/v1/agents/${encodeURIComponent(agentKey)}`,
      { body: params },
    );
    return response.agent;
  }

  /**
   * Delete an agent definition.
   * @param agentKey - The agent key
   */
  async delete(agentKey: string): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(
      'DELETE',
      `/api/client/v1/agents/${encodeURIComponent(agentKey)}`,
    );
  }

  /**
   * Publish the agent's current config as a new immutable version.
   * @param agentKey - The agent key
   * @param params - Optional changelog note
   * @returns The newly-published version
   */
  async publish(agentKey: string, params?: AgentPublishRequest): Promise<AgentVersion> {
    const response = await this.http.request<{ version: AgentVersion }>(
      'POST',
      `/api/client/v1/agents/${encodeURIComponent(agentKey)}/publish`,
      { body: params ?? {} },
    );
    return response.version;
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
   * Follows the OpenAI Responses API standard. The agent is identified by the `model`
   * field and runs its PUBLISHED version unless `version` says otherwise (`version: 3`
   * pins one, `version: 'draft'` runs the draft). Pass `previous_response_id` to continue
   * a conversation.
   *
   * - `await create(...)` waits up to the Console's window. A turn that is still going
   *   then (or `background: true`) answers HTTP `202`: the call does NOT throw, it
   *   returns the {@link AgentResponse} with `status: 'queued'` or `'in_progress'`. The
   *   turn keeps running: follow it with `retrieve(res.id)` or
   *   `client.agents.runs.wait(res.cognipeer.run_id)`.
   * - `stream: true` returns an async iterator of typed `response.*` events.
   *
   * @example
   * ```typescript
   * const res = await client.agents.responses.create({ model: 'my-agent', input: 'What can you do?' });
   * if (res.status === 'completed') console.log(res.output_text);
   *
   * // Structured output
   * const typed = await client.agents.responses.create({
   *   model: 'my-agent',
   *   input: 'Extract the invoice',
   *   text: { format: { type: 'json_schema', name: 'invoice', schema: { type: 'object' } } },
   * });
   * console.log(typed.output_parsed);
   *
   * // Streaming
   * for await (const event of await client.agents.responses.create({ model: 'my-agent', input: 'Hi', stream: true })) {
   *   if (event.type === 'response.output_text.delta') process.stdout.write(event.delta);
   * }
   *
   * // Background
   * const queued = await client.agents.responses.create({ model: 'my-agent', input: 'Research', background: true });
   * const run = await client.agents.runs.wait(queued.cognipeer!.run_id!);
   * ```
   */
  async create(
    params: AgentResponseCreateRequest & { stream: true },
    options?: AgentResponseCreateOptions,
  ): Promise<AsyncGenerator<AgentResponseStreamEvent, void, undefined>>;
  async create(
    params: AgentResponseCreateRequest & { stream?: false },
    options?: AgentResponseCreateOptions,
  ): Promise<AgentResponse>;
  async create(
    params: AgentResponseCreateRequest,
    options?: AgentResponseCreateOptions,
  ): Promise<AgentResponse | AsyncGenerator<AgentResponseStreamEvent, void, undefined>>;
  async create(
    params: AgentResponseCreateRequest,
    options: AgentResponseCreateOptions = {},
  ): Promise<AgentResponse | AsyncGenerator<AgentResponseStreamEvent, void, undefined>> {
    const request = {
      body: params,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      signal: options.signal,
    };
    if (params.stream) {
      return this.http.stream<AgentResponseStreamEvent>('POST', '/api/client/v1/responses', request);
    }
    return this.http.request<AgentResponse>('POST', '/api/client/v1/responses', request);
  }

  /**
   * Read a response by id (`resp_<runId>`, as `create()` returned it): the current state of
   * its run, `queued` / `in_progress` while it goes, final afterwards. Rejects with
   * `CognipeerAPIError` 404 for an unknown id.
   */
  async retrieve(responseId: string, options: { signal?: AbortSignal } = {}): Promise<AgentResponse> {
    return this.http.request<AgentResponse>(
      'GET',
      `/api/client/v1/responses/${encodeURIComponent(responseId)}`,
      { signal: options.signal },
    );
  }

  /**
   * Stop the turn behind a response (`resp_<runId>`). Cooperative: the returned
   * response is `cancelled`, or still `in_progress` while the stop lands (`retrieve()` to
   * see it). A response that already finished is returned as it is. Rejects with
   * `CognipeerAPIError` 404 for an unknown id.
   *
   * @example
   * ```typescript
   * const res = await client.agents.responses.create({ model: 'my-agent', input: 'Hi', background: true });
   * const stopped = await client.agents.responses.cancel(res.id);
   * ```
   */
  async cancel(responseId: string, options: { signal?: AbortSignal } = {}): Promise<AgentResponse> {
    return this.http.request<AgentResponse>(
      'POST',
      `/api/client/v1/responses/${encodeURIComponent(responseId)}/cancel`,
      { body: {}, signal: options.signal },
    );
  }
}
