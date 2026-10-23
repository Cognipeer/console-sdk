import { HttpClient } from '../http';
import {
  Browser,
  BrowserAction,
  BrowserActionResult,
  BrowserArtifactResult,
  BrowserCreateInput,
  BrowserCreateSessionInput,
  BrowserSessionEvent,
  BrowserExtractInput,
  BrowserExtractResult,
  BrowserFindResult,
  BrowserFlow,
  BrowserFlowCreateInput,
  BrowserFlowRecordInput,
  BrowserFlowRun,
  BrowserFlowRunInput,
  BrowserFlowRunStatus,
  BrowserFlowStatus,
  BrowserFlowUpdateInput,
  BrowserObservations,
  BrowserPdfInput,
  BrowserProfileSummary,
  BrowserScreenshotInlineResult,
  BrowserScreenshotInput,
  BrowserSession,
  BrowserSnapshotResult,
  BrowserUpdateInput,
} from '../types';

const BASE = '/api/client/v1/browser';
/**
 * Browser sessions API
 *
 * Programmatic Playwright-backed browser sessions. Use this resource to
 * launch headless sessions, drive them with discrete actions (`goto`, `click`,
 * `type`, `scroll`, …), capture artifacts, and inspect aria snapshots.
 *
 * An action names its element either with a `ref` from the latest snapshot
 * (valid for that snapshot only) or with a durable `BrowserTarget` (`role` +
 * `name`, `testId`, `label`, …). Every action result carries `resolvedTarget`,
 * the durable form of whatever it hit, which is what to save.
 *
 * @example
 * ```ts
 * const browser = await client.browsers.create({ name: 'demo-browser' });
 * const session = await client.browserSessions.create({ browserId: browser.id, name: 'demo' });
 * await client.browserSessions.action(session.sessionKey, { type: 'goto', url: 'https://example.com' });
 * const snap = await client.browserSessions.snapshot(session.sessionKey);
 * await client.browserSessions.close(session.sessionKey);
 * ```
 */
export class BrowserSessionsResource {
  constructor(private http: HttpClient) {}

  async create(input: BrowserCreateSessionInput): Promise<BrowserSession> {
    const res = await this.http.request<{ session: BrowserSession }>('POST', `${BASE}/sessions`, { body: input });
    return res.session;
  }

  async list(query: { status?: string; browserId?: string } = {}): Promise<BrowserSession[]> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.browserId) params.set('browserId', query.browserId);
    const qs = params.toString();
    const res = await this.http.request<{ sessions: BrowserSession[] }>('GET', `${BASE}/sessions${qs ? `?${qs}` : ''}`);
    return res.sessions ?? [];
  }

  async get(sessionId: string): Promise<BrowserSession> {
    const res = await this.http.request<{ session: BrowserSession }>('GET', `${BASE}/sessions/${encodeURIComponent(sessionId)}`);
    return res.session;
  }

  async listEvents(sessionId: string, query: { limit?: number; skip?: number } = {}): Promise<BrowserSessionEvent[]> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.skip) params.set('skip', String(query.skip));
    const qs = params.toString();
    const res = await this.http.request<{ events: BrowserSessionEvent[] }>(
      'GET',
      `${BASE}/sessions/${encodeURIComponent(sessionId)}/events${qs ? `?${qs}` : ''}`,
    );
    return res.events ?? [];
  }

  async action(sessionKey: string, action: BrowserAction): Promise<BrowserActionResult> {
    const res = await this.http.request<{ result: BrowserActionResult }>(
      'POST',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/actions`,
      { body: action },
    );
    return res.result;
  }

  async extract(sessionKey: string, input: BrowserExtractInput): Promise<BrowserExtractResult> {
    const res = await this.http.request<{ result: BrowserExtractResult }>(
      'POST',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/extract`,
      { body: input },
    );
    return res.result;
  }

  async snapshot(sessionKey: string): Promise<BrowserSnapshotResult> {
    return this.http.request<BrowserSnapshotResult>(
      'GET',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/snapshot`,
    );
  }

  /**
   * Persist a screenshot to the configured files bucket. With `{ inline: true }`
   * the image also comes back as a base64 content block (and `persist: false`
   * skips saving it).
   */
  async screenshot(
    sessionKey: string,
    input: BrowserScreenshotInput & { inline: true },
  ): Promise<BrowserScreenshotInlineResult>;
  async screenshot(sessionKey: string, input?: BrowserScreenshotInput): Promise<BrowserArtifactResult>;
  async screenshot(
    sessionKey: string,
    input: BrowserScreenshotInput = {},
  ): Promise<BrowserArtifactResult | BrowserScreenshotInlineResult> {
    return this.http.request<BrowserArtifactResult | BrowserScreenshotInlineResult>(
      'POST',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/screenshot`,
      { body: input },
    );
  }

  /**
   * Returns the raw screenshot bytes for the current viewport, without
   * persisting it. Useful for live UI previews. Note: requires a fetch
   * implementation that supports binary responses (default `globalThis.fetch`).
   */
  async screenshotLive(sessionKey: string, opts: { fullPage?: boolean } = {}): Promise<Uint8Array> {
    const url = `${BASE}/sessions/${encodeURIComponent(sessionKey)}/screenshot/live${opts.fullPage ? '?fullPage=true' : ''}`;
    // Use raw HTTP via a tiny escape hatch on the underlying http client.
    const internal = this.http as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchImpl: typeof fetch; baseURL: string; apiKey: string; timeout: number;
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), internal.timeout);
    try {
      const res = await internal.fetchImpl(new URL(url.startsWith('/') ? url.slice(1) : url, internal.baseURL).toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${internal.apiKey}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`screenshotLive failed (${res.status}): ${text}`);
      }
      const buffer = await res.arrayBuffer();
      return new Uint8Array(buffer);
    } finally {
      clearTimeout(timer);
    }
  }

  async pdf(sessionKey: string, input: BrowserPdfInput = {}): Promise<BrowserArtifactResult> {
    return this.http.request<BrowserArtifactResult>(
      'POST',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/pdf`,
      { body: input },
    );
  }

  /**
   * Find visible text on the page and get a DURABLE target for each hit.
   *
   * Cheaper than another snapshot when you already know what you are looking
   * for. Each `target` can be spread straight into an action or saved into a
   * flow step. A search that fails is `ok: false` with `errorMessage`, not a
   * rejected promise.
   *
   * @example
   * ```ts
   * const { matches } = await client.browserSessions.find(session.sessionKey, 'Sign in');
   * await client.browserSessions.action(session.sessionKey, { type: 'click', ...matches[0].target });
   * ```
   */
  async find(
    sessionKey: string,
    text: string,
    options: { limit?: number } = {},
  ): Promise<BrowserFindResult> {
    const params = new URLSearchParams({ text });
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    return this.http.request<BrowserFindResult>(
      'GET',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/find?${params.toString()}`,
    );
  }

  /**
   * Console messages, failed requests and the last dialog this session saw.
   * Use it when an action succeeded but the page did not do what you expected.
   */
  async diagnostics(sessionKey: string): Promise<BrowserObservations> {
    return this.http.request<BrowserObservations>(
      'GET',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/diagnostics`,
    );
  }

  /**
   * Export this session's cookies and origin storage as a Playwright
   * `storageState`.
   *
   * Drive a login once, export here, then attach the result with
   * `browsers.setProfile()` so every later session starts signed in instead of
   * replaying credentials through a form. The export holds live session
   * cookies: treat it like a password.
   */
  async exportProfile(sessionKey: string): Promise<Record<string, unknown>> {
    const res = await this.http.request<{ storageState: Record<string, unknown> }>(
      'GET',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}/profile`,
    );
    return res.storageState;
  }

  async close(sessionKey: string): Promise<{ closed: boolean }> {
    return this.http.request<{ closed: boolean }>(
      'DELETE',
      `${BASE}/sessions/${encodeURIComponent(sessionKey)}`,
    );
  }

  async delete(sessionId: string): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>(
      'DELETE',
      `${BASE}/sessions/by-id/${encodeURIComponent(sessionId)}`,
    );
  }
}

/**
 * Browsers (parent profiles for sessions and Browser Use).
 */
export class BrowsersResource {
  constructor(private http: HttpClient) {}

  async create(input: BrowserCreateInput): Promise<Browser> {
    const res = await this.http.request<{ browser: Browser }>('POST', `${BASE}/browsers`, { body: input });
    return res.browser;
  }

  async list(query: { status?: string } = {}): Promise<Browser[]> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    const res = await this.http.request<{ browsers: Browser[] }>('GET', `${BASE}/browsers${qs ? `?${qs}` : ''}`);
    return res.browsers ?? [];
  }

  async get(idOrKey: string): Promise<Browser> {
    const res = await this.http.request<{ browser: Browser }>('GET', `${BASE}/browsers/${encodeURIComponent(idOrKey)}`);
    return res.browser;
  }

  async update(idOrKey: string, input: BrowserUpdateInput): Promise<Browser> {
    const res = await this.http.request<{ browser: Browser }>(
      'PATCH',
      `${BASE}/browsers/${encodeURIComponent(idOrKey)}`,
      { body: input },
    );
    return res.browser;
  }

  async delete(idOrKey: string): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>(
      'DELETE',
      `${BASE}/browsers/${encodeURIComponent(idOrKey)}`,
    );
  }

  /**
   * Attach a signed-in profile so every session starts authenticated.
   *
   * Pass a Playwright `storageState` export: the object `context.storageState()`
   * writes, or what `browserSessions.exportProfile()` returns after you drive a
   * login once. It must carry cookies and/or origin storage. It is encrypted on
   * the server and never readable back; only the summary returned here (and on
   * `browser.storageStateMeta`) is. `fileName` is recorded on the summary as
   * `sourceFileName`.
   *
   * @example
   * ```ts
   * const state = JSON.parse(await fs.readFile('profile.json', 'utf8'));
   * await client.browsers.setProfile('my-browser', state, 'profile.json');
   * ```
   */
  async setProfile(
    idOrKey: string,
    storageState: Record<string, unknown>,
    fileName?: string,
  ): Promise<BrowserProfileSummary> {
    const res = await this.http.request<{ profile: BrowserProfileSummary }>(
      'PUT',
      `${BASE}/browsers/${encodeURIComponent(idOrKey)}/profile`,
      { body: { storageState, fileName } },
    );
    return res.profile;
  }

  /** Remove the signed-in profile. New sessions start signed out. */
  async clearProfile(idOrKey: string): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>(
      'DELETE',
      `${BASE}/browsers/${encodeURIComponent(idOrKey)}/profile`,
    );
  }
}

/**
 * Browser flows: record a task once, replay it without a model.
 *
 * Driving a browser with a model is DISCOVERY: it reads the page, guesses,
 * backtracks and bills tokens for every step. Replaying a flow is EXECUTION: no
 * model, no guessing, the same steps every time. Record the discovery once,
 * then run the flow.
 *
 * @example
 * ```ts
 * // 1. Drive a session however you like (an agent, or by hand).
 * const session = await client.browserSessions.create({ browserId: browser.id });
 * await client.browserSessions.action(session.sessionKey, { type: 'goto', url });
 * // …
 *
 * // 2. Freeze it into a flow. Typed values become declared inputs.
 * const flow = await client.browserFlows.record({
 *   sessionId: session.id,
 *   name: 'Submit expense',
 *   status: 'active',
 * });
 *
 * // 3. Replay it with different values, any number of times.
 * const run = await client.browserFlows.run(flow.key, {
 *   inputs: { reference: 'EXP-2002', amount: '999' },
 * });
 * console.log(run.status, run.outputs);
 * ```
 */
export class BrowserFlowsResource {
  constructor(private http: HttpClient) {}

  /** Create a flow from steps you write yourself. `record()` builds one from a session instead. */
  async create(input: BrowserFlowCreateInput): Promise<BrowserFlow> {
    const res = await this.http.request<{ flow: BrowserFlow }>('POST', `${BASE}/flows`, { body: input });
    return res.flow;
  }

  /**
   * List flows, most recently updated first.
   *
   * `browserId` is the browser's id (not its key). `search` is a case-insensitive
   * filter on the flow name (some database backends also match the key and description).
   */
  async list(
    query: { status?: BrowserFlowStatus; browserId?: string; search?: string } = {},
  ): Promise<BrowserFlow[]> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.browserId) params.set('browserId', query.browserId);
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    const res = await this.http.request<{ flows: BrowserFlow[] }>('GET', `${BASE}/flows${qs ? `?${qs}` : ''}`);
    return res.flows ?? [];
  }

  /** Fetch one flow by id or key. */
  async get(idOrKey: string): Promise<BrowserFlow> {
    const res = await this.http.request<{ flow: BrowserFlow }>(
      'GET',
      `${BASE}/flows/${encodeURIComponent(idOrKey)}`,
    );
    return res.flow;
  }

  /**
   * Update a flow by id or key. Pass only the fields to change; `steps`,
   * `inputs` and `outputs` replace the stored list wholesale. Changing `steps`
   * or `outputs` bumps `version`.
   */
  async update(idOrKey: string, input: BrowserFlowUpdateInput): Promise<BrowserFlow> {
    const res = await this.http.request<{ flow: BrowserFlow }>(
      'PATCH',
      `${BASE}/flows/${encodeURIComponent(idOrKey)}`,
      { body: input },
    );
    return res.flow;
  }

  /** Delete a flow and its run history. */
  async delete(idOrKey: string): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>(
      'DELETE',
      `${BASE}/flows/${encodeURIComponent(idOrKey)}`,
    );
  }

  /**
   * Turn a driven session's action log into a replayable flow.
   *
   * Volatile element references are replaced by durable ones, and every typed
   * value becomes a declared input rather than a literal: the recorder cannot
   * tell a search term from a password. Failed actions and read-only events are
   * left out, and `upload` and `drag` are not recorded (add them with
   * `update()`). The flow lands as a `draft` unless you ask for `active`.
   * Rejects when the session holds nothing replayable.
   */
  async record(input: BrowserFlowRecordInput): Promise<BrowserFlow> {
    const res = await this.http.request<{ flow: BrowserFlow }>('POST', `${BASE}/flows/record`, { body: input });
    return res.flow;
  }

  /**
   * Run a flow and wait for the result.
   *
   * A failed RUN still resolves: inspect `run.status`, `run.failedStepIndex` and
   * `run.stepResults` to see which step broke and why. The call itself rejects
   * when the flow does not exist, is `disabled`, has no steps, or a required
   * input is missing.
   *
   * The call waits for the run to finish, so it is bounded by the client's
   * `timeout` (60 seconds by default): raise it for a long flow.
   */
  async run(idOrKey: string, input: BrowserFlowRunInput = {}): Promise<BrowserFlowRun> {
    const res = await this.http.request<{ run: BrowserFlowRun }>(
      'POST',
      `${BASE}/flows/${encodeURIComponent(idOrKey)}/run`,
      { body: input },
    );
    return res.run;
  }

  /**
   * Run history, newest first (100 runs unless you pass `limit`).
   *
   * `flowId` is the flow's id, not its key.
   */
  async listRuns(
    query: { flowId?: string; status?: BrowserFlowRunStatus; limit?: number; skip?: number } = {},
  ): Promise<BrowserFlowRun[]> {
    const params = new URLSearchParams();
    if (query.flowId) params.set('flowId', query.flowId);
    if (query.status) params.set('status', query.status);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.skip !== undefined) params.set('skip', String(query.skip));
    const qs = params.toString();
    const res = await this.http.request<{ runs: BrowserFlowRun[] }>(
      'GET',
      `${BASE}/flow-runs${qs ? `?${qs}` : ''}`,
    );
    return res.runs ?? [];
  }

  /** Fetch one run, with its per-step results, captures and outputs. */
  async getRun(runId: string): Promise<BrowserFlowRun> {
    const res = await this.http.request<{ run: BrowserFlowRun }>(
      'GET',
      `${BASE}/flow-runs/${encodeURIComponent(runId)}`,
    );
    return res.run;
  }
}
