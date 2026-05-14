import { HttpClient } from '../http';
import {
  Browser,
  BrowserAction,
  BrowserActionResult,
  BrowserArtifactResult,
  BrowserCreateInput,
  BrowserCreateSessionInput,
  BrowserMcpConnectionInfo,
  BrowserMcpInitializeResult,
  BrowserMcpToolDescriptor,
  BrowserSessionEvent,
  BrowserExtractInput,
  BrowserExtractResult,
  BrowserPdfInput,
  BrowserScreenshotInput,
  BrowserSession,
  BrowserSnapshotResult,
  BrowserUpdateInput,
} from '../types';
import { CognipeerError } from '../types';

const BASE = '/api/client/v1/browser';
const JSONRPC_VERSION = '2.0';

interface JsonRpcSuccess<T> {
  id: number | string | null;
  jsonrpc: string;
  result: T;
}

interface JsonRpcFailure {
  error: {
    code: number;
    message: string;
  };
  id: number | string | null;
  jsonrpc: string;
}

function unwrapJsonRpc<T>(payload: JsonRpcFailure | JsonRpcSuccess<T>): T {
  if ('error' in payload) {
    throw new CognipeerError(payload.error.message);
  }

  return payload.result;
}

/**
 * Browser sessions API
 *
 * Programmatic Playwright-backed browser sessions. Use this resource to
 * launch headless sessions, drive them with discrete actions (`goto`, `click`,
 * `type`, `scroll`, …), capture artifacts, and inspect aria snapshots.
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

  /** Persist a screenshot to the configured files bucket. */
  async screenshot(sessionKey: string, input: BrowserScreenshotInput = {}): Promise<BrowserArtifactResult> {
    return this.http.request<BrowserArtifactResult>(
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
 * Browser MCP helper API
 *
 * Each browser profile exposes a dedicated MCP endpoint. Use this helper to
 * build connection URLs and discover the exposed Browser Use toolset.
 *
 * @example
 * ```ts
 * const info = client.browserMcp.getConnectionInfo('research-browser');
 * const meta = await client.browserMcp.initialize('research-browser');
 * const tools = await client.browserMcp.listTools('research-browser');
 * console.log(info.sseUrl, meta.protocolVersion, tools.map((tool) => tool.name));
 * ```
 */
export class BrowserMcpResource {
  constructor(private http: HttpClient) {}

  getSseUrl(browserKey: string): string {
    return this.http.resolveURL(`${BASE}/${encodeURIComponent(browserKey)}/mcp/sse`);
  }

  getMessageUrl(browserKey: string, sessionId: string): string {
    return this.http.resolveURL(`${BASE}/${encodeURIComponent(browserKey)}/mcp/message`, { sessionId });
  }

  getConnectionInfo(browserKey: string): BrowserMcpConnectionInfo {
    const messageBase = this.http.resolveURL(`${BASE}/${encodeURIComponent(browserKey)}/mcp/message`);
    return {
      authHeader: 'Authorization: Bearer <API_TOKEN>',
      browserKey,
      messageUrlTemplate: `${messageBase}?sessionId=<sessionId>`,
      sseUrl: this.getSseUrl(browserKey),
    };
  }

  async initialize(browserKey: string): Promise<BrowserMcpInitializeResult> {
    const payload = await this.http.request<JsonRpcFailure | JsonRpcSuccess<BrowserMcpInitializeResult>>(
      'POST',
      `${BASE}/${encodeURIComponent(browserKey)}/mcp/message`,
      {
        body: {
          id: 1,
          jsonrpc: JSONRPC_VERSION,
          method: 'initialize',
          params: {},
        },
      },
    );
    return unwrapJsonRpc(payload);
  }

  async listTools(browserKey: string): Promise<BrowserMcpToolDescriptor[]> {
    const payload = await this.http.request<JsonRpcFailure | JsonRpcSuccess<{ tools: BrowserMcpToolDescriptor[] }>>(
      'POST',
      `${BASE}/${encodeURIComponent(browserKey)}/mcp/message`,
      {
        body: {
          id: 2,
          jsonrpc: JSONRPC_VERSION,
          method: 'tools/list',
        },
      },
    );
    return unwrapJsonRpc(payload).tools ?? [];
  }
}

/**
 * Browsers (parent profiles for sessions, Browser Use, and per-browser MCP endpoints).
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
}
