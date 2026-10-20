import { describe, it, expect, vi } from 'vitest';
import { BrowserFlowsResource, BrowserSessionsResource, BrowsersResource } from './browser';
import { createMockHttp } from '../test/mockHttp';
import { HttpClient } from '../http';
import { CognipeerAPIError } from '../types';
import type { BrowserAction, BrowserFlow, BrowserFlowRun } from '../types';

describe('BrowserSessionsResource', () => {
  it('creates a session', async () => {
    const http = createMockHttp();
    const session = { sessionKey: 'sess_1' };
    http.request.mockResolvedValue({ session });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.create({ browserId: 'b1', name: 'demo' });

    expect(result).toBe(session);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/sessions', {
      body: { browserId: 'b1', name: 'demo' },
    });
  });

  it('lists sessions without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BrowserSessionsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions');
  });

  it('lists sessions with status/browserId filters as a query string', async () => {
    const http = createMockHttp();
    const sessions = [{ sessionKey: 'sess_1' }];
    http.request.mockResolvedValue({ sessions });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.list({ status: 'active', browserId: 'b1' });

    expect(result).toBe(sessions);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/sessions?status=active&browserId=b1',
    );
  });

  it('gets a session by id', async () => {
    const http = createMockHttp();
    const session = { sessionKey: 'sess_1' };
    http.request.mockResolvedValue({ session });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.get('sess_1');

    expect(result).toBe(session);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions/sess_1');
  });

  it('lists session events with pagination', async () => {
    const http = createMockHttp();
    const events = [{ type: 'goto' }];
    http.request.mockResolvedValue({ events });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.listEvents('sess_1', { limit: 10, skip: 5 });

    expect(result).toBe(events);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/sessions/sess_1/events?limit=10&skip=5',
    );
  });

  it('sends an action to a session', async () => {
    const http = createMockHttp();
    const actionResult = { ok: true };
    http.request.mockResolvedValue({ result: actionResult });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.action('sess_1', { type: 'goto', url: 'https://example.com' } as never);

    expect(result).toBe(actionResult);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/actions',
      { body: { type: 'goto', url: 'https://example.com' } },
    );
  });

  it('extracts structured data from a session', async () => {
    const http = createMockHttp();
    const extractResult = { data: {} };
    http.request.mockResolvedValue({ result: extractResult });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.extract('sess_1', { schema: {} } as never);

    expect(result).toBe(extractResult);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/extract',
      { body: { schema: {} } },
    );
  });

  it('gets an aria snapshot', async () => {
    const http = createMockHttp();
    const snapshot = { tree: {} };
    http.request.mockResolvedValue(snapshot);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.snapshot('sess_1');

    expect(result).toBe(snapshot);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions/sess_1/snapshot');
  });

  it('persists a screenshot', async () => {
    const http = createMockHttp();
    const artifact = { url: 'https://files.example.com/shot.png' };
    http.request.mockResolvedValue(artifact);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.screenshot('sess_1', { fullPage: true } as never);

    expect(result).toBe(artifact);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/screenshot',
      { body: { fullPage: true } },
    );
  });

  it('requests an inline screenshot and returns the content blocks', async () => {
    const http = createMockHttp();
    const inline = {
      content: [
        { type: 'text', text: 'Screenshot of http://x/ (800x600)' },
        { type: 'image', mimeType: 'image/png', data: 'AAAA', width: 800, height: 600 },
      ],
      structured: { url: 'http://x/', width: 800, height: 600, fullPage: false },
    };
    http.request.mockResolvedValue(inline);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.screenshot('sess_1', { inline: true, persist: false });

    expect(result.content[1]).toMatchObject({ type: 'image', mimeType: 'image/png' });
    expect(result.structured.width).toBe(800);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/screenshot',
      { body: { inline: true, persist: false } },
    );
  });

  it('creates a PDF artifact', async () => {
    const http = createMockHttp();
    const artifact = { url: 'https://files.example.com/doc.pdf' };
    http.request.mockResolvedValue(artifact);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.pdf('sess_1');

    expect(result).toBe(artifact);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/sessions/sess_1/pdf', {
      body: {},
    });
  });

  it('closes a session', async () => {
    const http = createMockHttp();
    const response = { closed: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.close('sess_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/browser/sessions/sess_1');
  });

  it('deletes a session by id', async () => {
    const http = createMockHttp();
    const response = { deleted: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.delete('sess_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/browser/sessions/by-id/sess_1',
    );
  });

  it('sends durable targets and the newer action types untouched', async () => {
    const http = createMockHttp();
    const resolvedTarget = { role: 'button', name: 'Sign in' };
    http.request.mockResolvedValue({ result: { ok: true, resolvedTarget, targetStrategy: 'ref' } });
    const resource = new BrowserSessionsResource(http);

    const actions: BrowserAction[] = [
      { type: 'click', role: 'button', name: 'Sign in', clickCount: 2 },
      { type: 'type', label: 'Email', text: 'a@example.com', submit: true },
      { type: 'select', label: 'Country', labels: ['Turkey'] },
      { type: 'check', testId: 'terms', checked: false },
      { type: 'upload', label: 'Receipt', fileIds: ['file_1'] },
      { type: 'drag', from: { testId: 'card' }, to: { testId: 'done' } },
      { type: 'back', waitUntil: 'load' },
      { type: 'wait', text: 'Saved', state: 'visible' },
      { type: 'wait', loadState: 'networkidle' },
      { type: 'tab', op: 'switch', index: 1 },
    ];

    for (const action of actions) {
      const result = await resource.action('sess_1', action);
      expect(result.resolvedTarget).toBe(resolvedTarget);
      expect(http.request).toHaveBeenLastCalledWith(
        'POST',
        '/api/client/v1/browser/sessions/sess_1/actions',
        { body: action },
      );
    }
    expect(http.request).toHaveBeenCalledTimes(actions.length);
  });

  it('extracts and screenshots by durable target', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ result: { ok: true, values: ['42'] } });
    const resource = new BrowserSessionsResource(http);

    await resource.extract('sess_1', { label: 'Total', mode: 'value' });
    expect(http.request).toHaveBeenLastCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/extract',
      { body: { label: 'Total', mode: 'value' } },
    );

    http.request.mockResolvedValue({ artifact: {}, eventId: 'e1' });
    await resource.screenshot('sess_1', { role: 'img', name: 'Revenue chart' });
    expect(http.request).toHaveBeenLastCalledWith(
      'POST',
      '/api/client/v1/browser/sessions/sess_1/screenshot',
      { body: { role: 'img', name: 'Revenue chart' } },
    );
  });

  it('finds visible text and returns a durable target per hit', async () => {
    const http = createMockHttp();
    const found = {
      ok: true,
      matches: [
        { text: 'Look up', target: { text: 'Look up', nth: 0 } },
        { text: 'Look up again', target: { text: 'Look up', nth: 1 } },
      ],
    };
    http.request.mockResolvedValue(found);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.find('sess_1', 'Look up');

    expect(result).toBe(found);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/sessions/sess_1/find?text=Look+up',
    );
  });

  it('url-encodes the search text and forwards a limit to find', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ ok: true, matches: [] });
    const resource = new BrowserSessionsResource(http);

    await resource.find('sess/1', 'Total & tax = 5%', { limit: 3 });

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/sessions/sess%2F1/find?text=Total+%26+tax+%3D+5%25&limit=3',
    );
  });

  it('reads session diagnostics', async () => {
    const http = createMockHttp();
    const observations = {
      console: [{ type: 'error', text: 'boom', at: '2026-10-20T10:00:00.000Z' }],
      networkFailures: [{ url: 'https://x.test/a', method: 'GET', failure: 'net::ERR_FAILED', at: '2026-10-20T10:00:01.000Z' }],
      lastDialog: { type: 'confirm', message: 'Sure?', action: 'dismiss', at: '2026-10-20T10:00:02.000Z' },
    };
    http.request.mockResolvedValue(observations);
    const resource = new BrowserSessionsResource(http);

    const result = await resource.diagnostics('sess_1');

    expect(result).toBe(observations);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions/sess_1/diagnostics');
  });

  it('exports the session profile and unwraps the storageState', async () => {
    const http = createMockHttp();
    const storageState = { cookies: [{ name: 'sid', value: 'v', domain: 'example.com', path: '/' }], origins: [] };
    http.request.mockResolvedValue({ storageState });
    const resource = new BrowserSessionsResource(http);

    const result = await resource.exportProfile('sess_1');

    expect(result).toBe(storageState);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/sessions/sess_1/profile');
  });

  describe('screenshotLive', () => {
    it('fetches raw screenshot bytes directly, bypassing the JSON request path', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
      const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
      const resource = new BrowserSessionsResource(http);

      const result = await resource.screenshotLive('sess_1', { fullPage: true });

      expect(result).toEqual(bytes);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://api.test/api/client/v1/browser/sessions/sess_1/screenshot/live?fullPage=true',
      );
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer sk-test');
    });

    it('throws when the live screenshot endpoint returns a non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
      const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
      const resource = new BrowserSessionsResource(http);

      await expect(resource.screenshotLive('sess_1')).rejects.toThrow('screenshotLive failed (500)');
    });
  });
});

describe('BrowsersResource', () => {
  it('creates a browser', async () => {
    const http = createMockHttp();
    const browser = { id: 'b1', name: 'demo-browser' };
    http.request.mockResolvedValue({ browser });
    const resource = new BrowsersResource(http);

    const result = await resource.create({ name: 'demo-browser' });

    expect(result).toBe(browser);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/browsers', {
      body: { name: 'demo-browser' },
    });
  });

  it('lists browsers without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BrowsersResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/browsers');
  });

  it('lists browsers with a status filter', async () => {
    const http = createMockHttp();
    const browsers = [{ id: 'b1' }];
    http.request.mockResolvedValue({ browsers });
    const resource = new BrowsersResource(http);

    const result = await resource.list({ status: 'active' });

    expect(result).toBe(browsers);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/browsers?status=active');
  });

  it('gets a browser by id', async () => {
    const http = createMockHttp();
    const browser = { id: 'b1' };
    http.request.mockResolvedValue({ browser });
    const resource = new BrowsersResource(http);

    const result = await resource.get('b1');

    expect(result).toBe(browser);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/browsers/b1');
  });

  it('updates a browser', async () => {
    const http = createMockHttp();
    const browser = { id: 'b1', name: 'renamed' };
    http.request.mockResolvedValue({ browser });
    const resource = new BrowsersResource(http);

    const result = await resource.update('b1', { name: 'renamed' });

    expect(result).toBe(browser);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/browser/browsers/b1', {
      body: { name: 'renamed' },
    });
  });

  it('deletes a browser', async () => {
    const http = createMockHttp();
    const response = { deleted: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowsersResource(http);

    const result = await resource.delete('b1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/browser/browsers/b1');
  });

  describe('signed-in profile', () => {
    const storageState = {
      cookies: [{ name: 'sid', value: 'secret', domain: 'example.com', path: '/', expires: 1893456000 }],
      origins: [],
    };
    const summary = {
      uploadedAt: '2026-10-20T10:00:00.000Z',
      uploadedBy: 'me@example.com',
      cookieCount: 1,
      origins: ['example.com'],
      earliestExpiry: '2030-01-01T00:00:00.000Z',
      sourceFileName: 'profile.json',
    };

    it('attaches a profile and returns the summary', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ profile: summary });
      const resource = new BrowsersResource(http);

      const result = await resource.setProfile('b1', storageState, 'profile.json');

      expect(result).toBe(summary);
      expect(http.request).toHaveBeenCalledWith('PUT', '/api/client/v1/browser/browsers/b1/profile', {
        body: { storageState, fileName: 'profile.json' },
      });
    });

    it('url-encodes the browser id or key', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ profile: summary });
      const resource = new BrowsersResource(http);

      await resource.setProfile('my browser/1', storageState);

      expect(http.request).toHaveBeenCalledWith(
        'PUT',
        '/api/client/v1/browser/browsers/my%20browser%2F1/profile',
        { body: { storageState, fileName: undefined } },
      );
    });

    it('clears the profile', async () => {
      const http = createMockHttp();
      const response = { deleted: true };
      http.request.mockResolvedValue(response);
      const resource = new BrowsersResource(http);

      const result = await resource.clearProfile('b1');

      expect(result).toBe(response);
      expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/browser/browsers/b1/profile');
    });
  });
});

describe('BrowserFlowsResource', () => {
  const flow: BrowserFlow = {
    id: 'flow_1',
    tenantId: 't1',
    key: 'look-up-a-po',
    name: 'Look up a PO',
    status: 'active',
    browserId: 'b1',
    inputs: [{ name: 'purchase_order', label: 'textbox "Purchase order"', type: 'string', required: true }],
    outputs: [{ name: 'result', source: '{{step.result}}', type: 'string', required: true }],
    steps: [
      { id: 's1_ab12cd34', label: 'Go to http://127.0.0.1/', action: { type: 'goto', url: 'http://127.0.0.1/' } },
      {
        id: 's2_ef56ab78',
        action: { type: 'type', label: 'Purchase order', text: '{{input.purchase_order}}' },
      },
      {
        id: 's3_0a1b2c3d',
        action: { type: 'extract', selector: '#result' },
        captureAs: 'result',
        policy: { retries: 1, timeoutMs: 5_000 },
        when: '{{input.purchase_order}}',
      },
    ],
    recordedFromSessionId: 'sess_id_1',
    version: 2,
    lastRun: { runId: 'run_1', status: 'succeeded', startedAt: '2026-10-20T10:00:00.000Z', durationMs: 1200 },
  };

  const failedRun: BrowserFlowRun = {
    id: 'run_2',
    tenantId: 't1',
    flowId: 'flow_1',
    flowKey: 'look-up-a-po',
    flowVersion: 2,
    status: 'failed',
    trigger: 'api',
    sessionKey: 'bs_1',
    inputs: { purchase_order: 'PO-9001' },
    stepResults: [
      { stepId: 's1_ab12cd34', index: 0, status: 'succeeded', attempts: 1, url: 'http://127.0.0.1/' },
      {
        stepId: 's2_ef56ab78',
        index: 1,
        status: 'failed',
        attempts: 1,
        errorMessage: 'locator.fill: Timeout 5000ms exceeded.',
        artifact: { bucketKey: 'browser-artifacts', fileId: 'f1', objectKey: 'bs_1-1.png' },
      },
    ],
    outputs: {},
    captures: {},
    failedStepIndex: 1,
    errorMessage: 'locator.fill: Timeout 5000ms exceeded.',
  };

  it('creates a flow from steps written by hand', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ flow });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.create({
      name: 'Look up a PO',
      browserId: 'b1',
      status: 'active',
      inputs: [{ name: 'purchase_order', type: 'string', required: true }],
      outputs: [{ name: 'result', source: '{{step.result}}' }],
      steps: [{ action: { type: 'extract', selector: '#result' }, captureAs: 'result' }],
      sessionConfig: { actionTimeoutMs: 8_000, dialogPolicy: 'accept' },
    });

    expect(result).toBe(flow);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/flows', {
      body: {
        name: 'Look up a PO',
        browserId: 'b1',
        status: 'active',
        inputs: [{ name: 'purchase_order', type: 'string', required: true }],
        outputs: [{ name: 'result', source: '{{step.result}}' }],
        steps: [{ action: { type: 'extract', selector: '#result' }, captureAs: 'result' }],
        sessionConfig: { actionTimeoutMs: 8_000, dialogPolicy: 'accept' },
      },
    });
  });

  it('lists flows without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BrowserFlowsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/flows');
  });

  it('lists flows with status, browserId and search filters as a query string', async () => {
    const http = createMockHttp();
    const flows = [flow];
    http.request.mockResolvedValue({ flows });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.list({ status: 'active', browserId: 'b1', search: 'purchase order' });

    expect(result).toBe(flows);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/flows?status=active&browserId=b1&search=purchase+order',
    );
  });

  it('gets a flow by id or key', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ flow });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.get('look-up-a-po');

    expect(result).toBe(flow);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/flows/look-up-a-po');
  });

  it('updates a flow with a partial body', async () => {
    const http = createMockHttp();
    const updated = { ...flow, status: 'disabled' as const };
    http.request.mockResolvedValue({ flow: updated });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.update('look-up-a-po', { status: 'disabled' });

    expect(result).toBe(updated);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/browser/flows/look-up-a-po', {
      body: { status: 'disabled' },
    });
  });

  it('deletes a flow', async () => {
    const http = createMockHttp();
    const response = { deleted: true };
    http.request.mockResolvedValue(response);
    const resource = new BrowserFlowsResource(http);

    const result = await resource.delete('look-up-a-po');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/browser/flows/look-up-a-po');
  });

  it('records a driven session into a flow', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ flow });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.record({
      sessionId: 'sess_id_1',
      name: 'Look up a PO',
      status: 'active',
      excludeTypes: ['hover'],
    });

    expect(result).toBe(flow);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/flows/record', {
      body: { sessionId: 'sess_id_1', name: 'Look up a PO', status: 'active', excludeTypes: ['hover'] },
    });
  });

  it('runs a flow with inputs and returns the run', async () => {
    const http = createMockHttp();
    const run: BrowserFlowRun = {
      ...failedRun,
      id: 'run_3',
      status: 'succeeded',
      stepResults: [],
      outputs: { result: 'FOUND PO-9001' },
      captures: { result: 'FOUND PO-9001' },
      failedStepIndex: undefined,
      errorMessage: undefined,
    };
    http.request.mockResolvedValue({ run });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.run('look-up-a-po', { inputs: { purchase_order: 'PO-9001' }, maxSteps: 5 });

    expect(result).toBe(run);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/flows/look-up-a-po/run', {
      body: { inputs: { purchase_order: 'PO-9001' }, maxSteps: 5 },
    });
  });

  it('runs a flow with no input as an empty body', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ run: failedRun });
    const resource = new BrowserFlowsResource(http);

    await resource.run('look-up-a-po');

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/browser/flows/look-up-a-po/run', {
      body: {},
    });
  });

  it('resolves a failed run instead of throwing, so the failing step can be inspected', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ run: failedRun });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.run('look-up-a-po', { keepSessionOpen: true });

    expect(result.status).toBe('failed');
    expect(result.failedStepIndex).toBe(1);
    expect(result.stepResults?.[result.failedStepIndex ?? -1]?.errorMessage).toContain('Timeout');
  });

  it('lists runs without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new BrowserFlowsResource(http);

    const result = await resource.listRuns();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/flow-runs');
  });

  it('lists runs filtered by flow and status, with paging', async () => {
    const http = createMockHttp();
    const runs = [failedRun];
    http.request.mockResolvedValue({ runs });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.listRuns({ flowId: 'flow_1', status: 'failed', limit: 20, skip: 40 });

    expect(result).toBe(runs);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/browser/flow-runs?flowId=flow_1&status=failed&limit=20&skip=40',
    );
  });

  it('keeps a zero skip when paging runs', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ runs: [] });
    const resource = new BrowserFlowsResource(http);

    await resource.listRuns({ limit: 5, skip: 0 });

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/flow-runs?limit=5&skip=0');
  });

  it('gets one run', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ run: failedRun });
    const resource = new BrowserFlowsResource(http);

    const result = await resource.getRun('run_2');

    expect(result).toBe(failedRun);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/browser/flow-runs/run_2');
  });
});

describe('browser flows over the wire', () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  it('sends the profile as a JSON PUT and leaves out an unset fileName', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ profile: { cookieCount: 1, origins: ['example.com'], uploadedAt: 'now' } }));
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);
    const state = { cookies: [{ name: 'sid', value: 'v', domain: 'example.com', path: '/' }], origins: [] };

    const summary = await new BrowsersResource(http).setProfile('b1', state);

    expect(summary.cookieCount).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/client/v1/browser/browsers/b1/profile');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body)).toEqual({ storageState: state });
  });

  it('sends find as a GET with the text in the query string', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true, matches: [] }));
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);

    await new BrowserSessionsResource(http).find('bs_1', 'Look up', { limit: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/client/v1/browser/sessions/bs_1/find?text=Look+up&limit=2');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('unwraps { run } from a 200 and POSTs the inputs as JSON', async () => {
    const run = { id: 'run_1', status: 'succeeded', outputs: { result: 'FOUND PO-1' } };
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ run }));
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);

    const result = await new BrowserFlowsResource(http).run('look-up-a-po', { inputs: { purchase_order: 'PO-1' } });

    expect(result).toEqual(run);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/client/v1/browser/flows/look-up-a-po/run');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ inputs: { purchase_order: 'PO-1' } });
  });

  it('surfaces the API error string when the flow does not exist', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ error: 'Browser flow not found: nope' }, 404));
    const http = new HttpClient('https://api.test', 'sk-test', 5000, 0, fetchMock);

    const error = await new BrowserFlowsResource(http).get('nope').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CognipeerAPIError);
    expect((error as CognipeerAPIError).statusCode).toBe(404);
    expect((error as CognipeerAPIError).message).toBe('Browser flow not found: nope');
  });
});
