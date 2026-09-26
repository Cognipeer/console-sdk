import { HttpClient } from '../http';
import {
  Agent,
  AgentBackgroundResponseCreateRequest,
  AgentChatRequest,
  AgentChatResponse,
  AgentCreateRequest,
  AgentPublishRequest,
  AgentResponseCreateOptions,
  AgentResponseCreateRequest,
  AgentResponse,
  AgentRun,
  AgentRunWaitOptions,
  AgentRunWaitTimeoutError,
  AgentUpdateRequest,
  AgentVersion,
  isAgentRunTerminal,
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
  public readonly runs: AgentRunsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.responses = new AgentResponsesResource(http);
    this.runs = new AgentRunsResource(http);
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

  /**
   * Chat with an agent (legacy format)
   * @deprecated Use `client.agents.responses.create()` instead for OpenAI Responses API compatibility
   * @param agentKey - The agent key
   * @param params - Chat request parameters
   * @returns Chat response with content and conversation ID
   */
  async chat(agentKey: string, params: AgentChatRequest): Promise<AgentChatResponse> {
    // Translate legacy format to Responses API format
    const res = await this.responses.create({
      model: agentKey,
      input: params.message,
      ...(params.conversationId
        ? { previous_response_id: `resp_${params.conversationId}` }
        : {}),
    });

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
   *
   * With `background: true` the turn is queued and an {@link AgentRun}
   * (`status: 'queued'`) is returned right away — poll it with
   * `client.agents.runs.wait(run.id)` or receive it at `callback_url`.
   *
   * @example
   * ```typescript
   * const run = await client.agents.responses.create(
   *   { model: 'my-agent', input: 'Research this topic', background: true },
   *   { idempotencyKey: 'job-42' },
   * );
   * const done = await client.agents.runs.wait(run.id, { timeoutMs: 10 * 60_000 });
   * if (done.status === 'succeeded') console.log(done.result?.output[0]?.content[0]?.text);
   * ```
   */
  async create(
    params: AgentBackgroundResponseCreateRequest,
    options?: AgentResponseCreateOptions,
  ): Promise<AgentRun>;
  async create(
    params: AgentResponseCreateRequest & { background?: false },
    options?: AgentResponseCreateOptions,
  ): Promise<AgentResponse>;
  async create(
    params: AgentResponseCreateRequest,
    options?: AgentResponseCreateOptions,
  ): Promise<AgentResponse | AgentRun>;
  async create(
    params: AgentResponseCreateRequest,
    options: AgentResponseCreateOptions = {},
  ): Promise<AgentResponse | AgentRun> {
    return this.http.request<AgentResponse | AgentRun>('POST', '/api/client/v1/responses', {
      body: params,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      signal: options.signal,
    });
  }
}

/**
 * Sub-resource for background agent runs (`responses.create({ background: true })`).
 *
 * @example
 * ```typescript
 * const run = await client.agents.responses.create({ model: 'my-agent', input: 'Hi', background: true });
 * const status = await client.agents.runs.get(run.id);
 * await client.agents.runs.cancel(run.id);
 * ```
 */
export class AgentRunsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Get a run's status; includes `result` once `succeeded` and `error` once
   * `failed`/`canceled`.
   * @param runId - The run id exactly as returned (`run_<id>`)
   */
  async get(runId: string, options: { signal?: AbortSignal } = {}): Promise<AgentRun> {
    return this.http.request<AgentRun>(
      'GET',
      `/api/client/v1/agents/runs/${encodeURIComponent(runId)}`,
      { signal: options.signal },
    );
  }

  /**
   * Request cancellation of a `queued` or `running` run. Cancellation is
   * cooperative: the returned run may still read `running` until the worker
   * observes the request (typically within ~1s) — use `wait()` to see it land
   * on `canceled`.
   *
   * Throws `CognipeerAPIError` with `errorCode === 'agent_run_already_terminal'`
   * (409) if the run already finished, and a 404 if it does not exist.
   */
  async cancel(runId: string): Promise<AgentRun> {
    return this.http.request<AgentRun>(
      'POST',
      `/api/client/v1/agents/runs/${encodeURIComponent(runId)}/cancel`,
      { body: {} },
    );
  }

  /**
   * Poll until the run reaches `succeeded`, `failed` or `canceled` and return
   * it. Does not throw on `failed`/`canceled` — check `run.status`.
   *
   * Throws `AgentRunWaitTimeoutError` when `timeoutMs` elapses, and the
   * signal's abort reason when `signal` aborts. Neither stops the run itself.
   */
  async wait(runId: string, options: AgentRunWaitOptions = {}): Promise<AgentRun> {
    const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? 1000);
    const { timeoutMs, signal } = options;
    const deadline = timeoutMs !== undefined ? Date.now() + timeoutMs : undefined;

    for (;;) {
      if (signal?.aborted) throw abortReason(signal);
      const run = await this.get(runId, { signal });
      if (isAgentRunTerminal(run.status)) return run;

      const now = Date.now();
      if (deadline !== undefined && now >= deadline) {
        throw new AgentRunWaitTimeoutError(runId, timeoutMs as number, run);
      }
      const delay = deadline !== undefined ? Math.min(pollIntervalMs, deadline - now) : pollIntervalMs;
      await sleep(delay, signal);
    }
  }
}

function abortReason(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
