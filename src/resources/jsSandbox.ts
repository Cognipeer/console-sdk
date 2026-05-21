import { HttpClient } from '../http';
import {
  JsSandboxExecuteRequest,
  JsSandboxExecutionResult,
  JsSandboxRuntime,
} from '../types';

/**
 * JS Sandbox API resource — execute JavaScript snippets inside a managed
 * isolate. Useful as a tool target for agents or for ad-hoc data shaping.
 *
 * @example
 * ```typescript
 * const exec = await client.jsSandbox.execute({
 *   code: 'return variables.numbers.reduce((a, b) => a + b, 0);',
 *   variables: { numbers: [1, 2, 3] },
 * });
 * console.log(exec.result); // 6
 * ```
 */
export class JsSandboxResource {
  private http: HttpClient;
  public runtimes: JsSandboxRuntimesResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.runtimes = new JsSandboxRuntimesResource(http);
  }

  /** Execute a snippet of JavaScript. */
  async execute(data: JsSandboxExecuteRequest): Promise<JsSandboxExecutionResult> {
    return this.http.request<JsSandboxExecutionResult>(
      'POST',
      '/api/client/v1/js-sandbox/execute',
      { body: data },
    );
  }
}

export class JsSandboxRuntimesResource {
  private http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List available JS runtimes. */
  async list(query?: { status?: string; search?: string }): Promise<JsSandboxRuntime[]> {
    const res = await this.http.request<{ runtimes: JsSandboxRuntime[] }>(
      'GET',
      '/api/client/v1/js-sandbox/runtimes',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.runtimes ?? [];
  }

  /** Get a JS runtime by id or key. */
  async get(idOrKey: string): Promise<JsSandboxRuntime> {
    const res = await this.http.request<{ runtime: JsSandboxRuntime }>(
      'GET',
      `/api/client/v1/js-sandbox/runtimes/${encodeURIComponent(idOrKey)}`,
    );
    return res.runtime;
  }
}
