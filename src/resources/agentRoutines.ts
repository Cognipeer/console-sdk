import { HttpClient } from '../http';
import { newIdempotencyKey, preferHeader } from './agentRuns';
import {
  AgentRoutine,
  AgentRoutineCreateRequest,
  AgentRoutineDeleted,
  AgentRoutineRunRequest,
  AgentRoutineUpdateRequest,
  AgentRun,
  AgentRunCreateOptions,
} from '../types';

function routinesPath(agentKey: string, suffix = ''): string {
  return `/api/client/v1/agents/${encodeURIComponent(agentKey)}/routines${suffix}`;
}

function routinePath(agentKey: string, routineId: string, suffix = ''): string {
  return routinesPath(agentKey, `/${encodeURIComponent(routineId)}${suffix}`);
}

/** A routine comes back as the object itself; tolerate a `{ routine }` wrapper. */
function unwrapRoutine(body: AgentRoutine | { routine: AgentRoutine }): AgentRoutine {
  return 'routine' in body && body.routine ? body.routine : (body as AgentRoutine);
}

/**
 * Routines of an agent: a prompt the agent runs on a cron schedule, once at a time, or
 * on demand. Every fire is a run (`agents.runs.list({ routine_id })` is the history).
 *
 * @example
 * ```typescript
 * const routine = await client.agents.routines.create('report-bot', {
 *   name: 'Weekday digest',
 *   trigger: { type: 'schedule', cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
 *   prompt: 'Summarise yesterday',
 *   class: 'deferred',
 * });
 * const run = await client.agents.routines.run('report-bot', routine.id); // fire it now
 * ```
 */
export class AgentRoutinesResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** The agent's routines. */
  async list(agentKey: string, options: { signal?: AbortSignal } = {}): Promise<AgentRoutine[]> {
    const body = await this.http.request<{ data?: AgentRoutine[]; routines?: AgentRoutine[] }>(
      'GET',
      routinesPath(agentKey),
      { signal: options.signal },
    );
    return body.data ?? body.routines ?? [];
  }

  /**
   * Create a routine. Rejects with `CognipeerAPIError` 400 for a bad cron / timezone, a
   * missing prompt (required unless the agent declares inputs and they are given) or bad
   * inputs, and 404 `agent_not_found`.
   */
  async create(agentKey: string, body: AgentRoutineCreateRequest, options: { signal?: AbortSignal } = {}): Promise<AgentRoutine> {
    return unwrapRoutine(
      await this.http.request<AgentRoutine>('POST', routinesPath(agentKey), { body, signal: options.signal }),
    );
  }

  async get(agentKey: string, routineId: string, options: { signal?: AbortSignal } = {}): Promise<AgentRoutine> {
    return unwrapRoutine(
      await this.http.request<AgentRoutine>('GET', routinePath(agentKey, routineId), { signal: options.signal }),
    );
  }

  /** Change a routine (any field of the create body; `enabled: false` pauses it). */
  async update(
    agentKey: string,
    routineId: string,
    body: AgentRoutineUpdateRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentRoutine> {
    return unwrapRoutine(
      await this.http.request<AgentRoutine>('PATCH', routinePath(agentKey, routineId), { body, signal: options.signal }),
    );
  }

  /** Delete a routine; its past runs stay. */
  async delete(agentKey: string, routineId: string, options: { signal?: AbortSignal } = {}): Promise<AgentRoutineDeleted> {
    return this.http.request<AgentRoutineDeleted>('DELETE', routinePath(agentKey, routineId), { signal: options.signal });
  }

  /**
   * Fire a routine now (any trigger type). `body` may override `inputs` / `metadata` for
   * this fire and `wait` for the answer; the returned {@link AgentRun} is `succeeded`
   * (HTTP 200) or still going (`202`, never an error). An `Idempotency-Key` is generated
   * unless given.
   */
  async run(
    agentKey: string,
    routineId: string,
    body: AgentRoutineRunRequest = {},
    options: AgentRunCreateOptions = {},
  ): Promise<AgentRun> {
    const prefer = preferHeader(options.prefer);
    return this.http.request<AgentRun>('POST', routinePath(agentKey, routineId, '/run'), {
      body,
      headers: {
        'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      signal: options.signal,
    });
  }
}
