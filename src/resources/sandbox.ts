import { HttpClient } from '../http';
import {
  SandboxCodeRunRequest,
  SandboxCreateRequest,
  SandboxExecRequest,
  SandboxExecResult,
  SandboxFileEntry,
  SandboxFileInfo,
  SandboxFindMatch,
  SandboxGitLogEntry,
  SandboxGitStatus,
  SandboxReadFileResult,
  SandboxReplaceResult,
  SandboxSessionCommandLogs,
  SandboxSnapshotSummary,
  SandboxSummary,
} from '../types';

const BASE = '/api/client/v1/sandbox/sandboxes';

/**
 * Agent Sandbox API resource — remote, API-driven runtime sandboxes.
 * Spin up an isolated container, run commands/code, manage files and git,
 * stream long-running command output. Designed for AI-agent callers.
 *
 * @example
 * ```typescript
 * const sbx = await client.sandbox.create({ template: 'node-20' });
 * await client.sandbox.waitUntilRunning(sbx.id);
 * const res = await client.sandbox.exec(sbx.id, { command: 'node --version' });
 * console.log(res.stdout);
 * ```
 */
export class SandboxResource {
  private http: HttpClient;
  public fs: SandboxFsResource;
  public git: SandboxGitResource;
  public sessions: SandboxSessionsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.fs = new SandboxFsResource(http);
    this.git = new SandboxGitResource(http);
    this.sessions = new SandboxSessionsResource(http);
  }

  /** Create a sandbox. It starts automatically; poll `get()`/`waitUntilRunning()`. */
  async create(data: SandboxCreateRequest = {}): Promise<SandboxSummary> {
    return this.http.request<SandboxSummary>('POST', BASE, { body: data });
  }

  /** List sandboxes visible to the API token. */
  async list(): Promise<SandboxSummary[]> {
    const res = await this.http.request<{ sandboxes: SandboxSummary[] }>('GET', BASE);
    return res.sandboxes ?? [];
  }

  /** Get a sandbox's current status. */
  async get(id: string): Promise<SandboxSummary> {
    return this.http.request<SandboxSummary>('GET', `${BASE}/${encodeURIComponent(id)}`);
  }

  /** Delete a sandbox (stops and removes its container). */
  async delete(id: string): Promise<{ ok: boolean }> {
    return this.http.request<{ ok: boolean }>('DELETE', `${BASE}/${encodeURIComponent(id)}`);
  }

  /** Run a shell command synchronously and return exitCode/stdout/stderr. */
  async exec(id: string, data: SandboxExecRequest): Promise<SandboxExecResult> {
    return this.http.request<SandboxExecResult>(
      'POST',
      `${BASE}/${encodeURIComponent(id)}/exec`,
      { body: data },
    );
  }

  /** Run a code snippet with the appropriate interpreter. */
  async code(id: string, data: SandboxCodeRunRequest): Promise<SandboxExecResult> {
    return this.http.request<SandboxExecResult>(
      'POST',
      `${BASE}/${encodeURIComponent(id)}/code`,
      { body: data },
    );
  }

  /** Start a stopped (persistent) sandbox. */
  async start(id: string): Promise<SandboxSummary> {
    return this.http.request<SandboxSummary>('POST', `${BASE}/${encodeURIComponent(id)}/start`);
  }

  /** Stop a running sandbox (keeps it around if persistent). */
  async stop(id: string): Promise<SandboxSummary> {
    return this.http.request<SandboxSummary>('POST', `${BASE}/${encodeURIComponent(id)}/stop`);
  }

  /**
   * Bulk-upload files to the sandbox's attached volume (object storage). Each
   * file's `data` is base64 (or a data-URL). Works whether or not the container
   * is running. The sandbox must have a volume attached.
   */
  async uploadFiles(
    id: string,
    files: Array<{ path: string; data: string; contentType?: string }>,
  ): Promise<{ uploaded: Array<{ path: string; name: string; size: number }> }> {
    return this.http.request('POST', `${BASE}/${encodeURIComponent(id)}/files`, { body: { files } });
  }

  /** List files in the sandbox's attached volume (paths are volume-relative). */
  async listFiles(
    id: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: Array<{ path: string; name: string; size: number; contentType?: string }>; nextCursor?: string }> {
    return this.http.request('GET', `${BASE}/${encodeURIComponent(id)}/files`, {
      query: { cursor: options.cursor, limit: options.limit },
    });
  }

  /** Download a file from the sandbox's attached volume by its volume-relative path. */
  async downloadFile(id: string, path: string): Promise<{ data: Uint8Array; contentType: string }> {
    return this.http.requestBinary('GET', `${BASE}/${encodeURIComponent(id)}/files/download`, {
      query: { path },
    });
  }

  /** Capture a snapshot of the sandbox's state (optionally export it). */
  async snapshot(
    id: string,
    data: { name?: string; export?: boolean } = {},
  ): Promise<SandboxSnapshotSummary> {
    return this.http.request<SandboxSnapshotSummary>(
      'POST',
      `${BASE}/${encodeURIComponent(id)}/snapshot`,
      { body: data },
    );
  }

  /** Fork a sandbox into a new independent copy. */
  async fork(
    id: string,
    data: { name?: string; persist?: boolean } = {},
  ): Promise<SandboxSummary> {
    return this.http.request<SandboxSummary>(
      'POST',
      `${BASE}/${encodeURIComponent(id)}/fork`,
      { body: data },
    );
  }

  /** List snapshots visible to the API token. */
  async listSnapshots(): Promise<SandboxSnapshotSummary[]> {
    const res = await this.http.request<{ snapshots: SandboxSnapshotSummary[] }>(
      'GET',
      '/api/client/v1/sandbox/snapshots',
    );
    return res.snapshots ?? [];
  }

  /** Resume a new sandbox from a snapshot. */
  async restoreSnapshot(
    snapshotId: string,
    data: { name?: string; persist?: boolean; blockNetwork?: boolean } = {},
  ): Promise<SandboxSummary> {
    return this.http.request<SandboxSummary>(
      'POST',
      `/api/client/v1/sandbox/snapshots/${encodeURIComponent(snapshotId)}/restore`,
      { body: data },
    );
  }

  /**
   * Poll until the sandbox reports `running`. Throws on `failed`/`deleted`
   * or when the timeout elapses (a runner must be online to schedule it).
   */
  async waitUntilRunning(
    id: string,
    options: { timeoutMs?: number; pollMs?: number } = {},
  ): Promise<SandboxSummary> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollMs = options.pollMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const sandbox = await this.get(id);
      if (sandbox.status === 'running') return sandbox;
      if (sandbox.status === 'failed' || sandbox.status === 'deleted') {
        throw new Error(`sandbox ${id} entered terminal state "${sandbox.status}"`);
      }
      if (Date.now() >= deadline) {
        throw new Error(`sandbox ${id} did not reach "running" within ${timeoutMs}ms (status: ${sandbox.status})`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

/** File-system operations inside a running sandbox. All paths are absolute container paths. */
export class SandboxFsResource {
  private http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  private post<T>(id: string, sub: string, body: unknown): Promise<T> {
    return this.http.request<T>('POST', `${BASE}/${encodeURIComponent(id)}/fs/${sub}`, { body });
  }

  /** List directory entries. */
  async list(id: string, path: string): Promise<SandboxFileEntry[]> {
    const res = await this.post<{ files: SandboxFileEntry[] }>(id, 'list', { path });
    return res.files ?? [];
  }

  /** Stat a file or directory. */
  async info(id: string, path: string): Promise<SandboxFileInfo> {
    return this.post<SandboxFileInfo>(id, 'info', { path });
  }

  /** Read a file (utf8 by default; binary content falls back to base64). */
  async read(id: string, path: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<SandboxReadFileResult> {
    return this.post<SandboxReadFileResult>(id, 'read', { path, encoding });
  }

  /** Create or overwrite a file. Parent directories are created automatically. */
  async write(
    id: string,
    path: string,
    content: string,
    encoding: 'utf8' | 'base64' = 'utf8',
  ): Promise<{ bytesWritten: number }> {
    return this.post<{ bytesWritten: number }>(id, 'write', { path, content, encoding });
  }

  /** Create a directory (recursive). */
  async mkdir(id: string, path: string, mode?: string): Promise<{ ok: true }> {
    return this.post<{ ok: true }>(id, 'mkdir', { path, mode });
  }

  /** Delete a file (or a directory with `recursive: true`). */
  async delete(id: string, path: string, recursive = false): Promise<{ ok: true }> {
    return this.post<{ ok: true }>(id, 'delete', { path, recursive });
  }

  /** Move/rename a file or directory. */
  async move(id: string, source: string, destination: string): Promise<{ ok: true }> {
    return this.post<{ ok: true }>(id, 'move', { source, destination });
  }

  /** Recursively search file contents for a fixed string. */
  async find(id: string, path: string, pattern: string): Promise<SandboxFindMatch[]> {
    const res = await this.post<{ matches: SandboxFindMatch[] }>(id, 'find', { path, pattern });
    return res.matches ?? [];
  }

  /** Replace a fixed string across the given files. */
  async replace(
    id: string,
    files: string[],
    pattern: string,
    newValue: string,
  ): Promise<SandboxReplaceResult[]> {
    const res = await this.post<{ results: SandboxReplaceResult[] }>(id, 'replace', { files, pattern, newValue });
    return res.results ?? [];
  }
}

/** Git operations inside a running sandbox. `path` is the repo root (absolute). */
export class SandboxGitResource {
  private http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  private post<T>(id: string, sub: string, body: unknown): Promise<T> {
    return this.http.request<T>('POST', `${BASE}/${encodeURIComponent(id)}/git/${sub}`, { body });
  }

  async clone(
    id: string,
    args: { url: string; path: string; branch?: string; username?: string; password?: string },
  ): Promise<{ ok: true; path: string }> {
    return this.post(id, 'clone', args);
  }

  async status(id: string, path: string): Promise<SandboxGitStatus> {
    return this.post(id, 'status', { path });
  }

  async branches(id: string, path: string): Promise<string[]> {
    const res = await this.post<{ branches: string[] }>(id, 'branches', { path });
    return res.branches ?? [];
  }

  async createBranch(id: string, path: string, name: string): Promise<{ ok: true }> {
    return this.post(id, 'branch', { path, name });
  }

  async deleteBranch(id: string, path: string, name: string): Promise<{ ok: true }> {
    return this.post(id, 'branch/delete', { path, name });
  }

  async checkout(id: string, path: string, branch: string): Promise<{ ok: true }> {
    return this.post(id, 'checkout', { path, branch });
  }

  async add(id: string, path: string, files: string[] = []): Promise<{ ok: true }> {
    return this.post(id, 'add', { path, files });
  }

  async commit(
    id: string,
    args: { path: string; message: string; author: string; email: string; allowEmpty?: boolean },
  ): Promise<{ hash: string }> {
    return this.post(id, 'commit', args);
  }

  async push(
    id: string,
    args: { path: string; username?: string; password?: string },
  ): Promise<{ ok: true }> {
    return this.post(id, 'push', args);
  }

  async pull(
    id: string,
    args: { path: string; username?: string; password?: string },
  ): Promise<{ ok: true }> {
    return this.post(id, 'pull', args);
  }

  async log(id: string, path: string, limit = 30): Promise<SandboxGitLogEntry[]> {
    const res = await this.post<{ commits: SandboxGitLogEntry[] }>(id, 'log', { path, limit });
    return res.commits ?? [];
  }
}

/** Async command sessions — run detached commands and poll their logs. */
export class SandboxSessionsResource {
  private http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Create a command session (groups background commands). */
  async create(id: string, sessionId?: string): Promise<{ sessionId: string }> {
    return this.http.request('POST', `${BASE}/${encodeURIComponent(id)}/sessions`, {
      body: sessionId ? { sessionId } : {},
    });
  }

  /** List session ids. */
  async list(id: string): Promise<string[]> {
    const res = await this.http.request<{ sessions: string[] }>(
      'GET',
      `${BASE}/${encodeURIComponent(id)}/sessions`,
    );
    return res.sessions ?? [];
  }

  /** Delete a session and its command logs. */
  async delete(id: string, sessionId: string): Promise<{ ok: true }> {
    return this.http.request(
      'DELETE',
      `${BASE}/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  /** Start a detached command in a session. Returns a commandId to poll logs with. */
  async exec(
    id: string,
    sessionId: string,
    command: string,
    cwd?: string,
  ): Promise<{ commandId: string }> {
    return this.http.request(
      'POST',
      `${BASE}/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/exec`,
      { body: { command, cwd } },
    );
  }

  /** Snapshot the logs (stdout/stderr/exit) of a session command. */
  async logs(id: string, sessionId: string, commandId: string): Promise<SandboxSessionCommandLogs> {
    return this.http.request(
      'GET',
      `${BASE}/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/commands/${encodeURIComponent(commandId)}/logs`,
    );
  }
}
