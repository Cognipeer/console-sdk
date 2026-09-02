import { describe, expect, it } from 'vitest';

import { HttpClient } from '../http';
import { AegisResource, AegisShieldsResource } from '../resources/aegis';
import { GuardrailsResource, shouldBlock } from '../resources/guardrails';
import { CognipeerError } from '../types';
import type {
  AegisEvaluateRequest,
  GuardrailHookEvaluateParams,
  GuardrailHookEvaluateResponse,
  HookId,
  HookVerdict,
} from '../types';

// ── Test doubles ──────────────────────────────────────────────────────────

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

/**
 * A real `HttpClient` over a recording fetch, so the tests exercise the URL and
 * body the SDK actually puts on the wire rather than a mocked-out method.
 */
function stubClient(responseBody: unknown): { http: HttpClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: unknown, init: unknown) => {
    const request = (init ?? {}) as { method?: string; body?: string };
    calls.push({
      url: String(input),
      method: request.method ?? 'GET',
      body: request.body ? JSON.parse(request.body) : undefined,
    });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => responseBody,
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return {
    http: new HttpClient('https://console.example.com', 'test-key', 5000, 0, fetchImpl),
    calls,
  };
}

function verdict(overrides: Partial<HookVerdict> = {}): HookVerdict {
  return {
    contractVersion: 2,
    hook: 'input.pre',
    mode: 'enforce',
    decision: 'block',
    wouldBeDecision: 'block',
    enforced: true,
    disabled: false,
    findings: [],
    mutations: [],
    riskScore: 90,
    codes: ['secret_detected'],
    guardrailKeys: ['secrets'],
    guardrailKey: 'secrets',
    guardrailName: 'Secrets',
    policyVersion: 'secrets@2026-09-01T00:00:00.000Z',
    traceId: 'trace-1',
    latencyMs: 4,
    ...overrides,
  };
}

// ── shouldBlock ───────────────────────────────────────────────────────────

describe('shouldBlock', () => {
  it('blocks an enforced block decision', () => {
    expect(shouldBlock(verdict())).toBe(true);
  });

  it('does NOT block in monitor mode, where the decision is neutralised', () => {
    // What a monitoring guardrail actually returns: the effective decision is
    // already 'allow', and `wouldBeDecision` carries what it would have done.
    const monitoring = verdict({
      mode: 'monitor',
      decision: 'allow',
      wouldBeDecision: 'block',
      enforced: false,
    });

    expect(shouldBlock(monitoring)).toBe(false);
    expect(monitoring.wouldBeDecision).toBe('block');
  });

  it('does NOT block an unenforced block decision', () => {
    // The mistake the helper exists to prevent: `decision === 'block'` alone.
    const dryRun = verdict({ mode: 'monitor', decision: 'block', enforced: false });

    expect(dryRun.decision).toBe('block');
    expect(shouldBlock(dryRun)).toBe(false);
  });

  it('does not block a non-block decision, enforced or not', () => {
    expect(shouldBlock(verdict({ decision: 'redact' }))).toBe(false);
    expect(shouldBlock(verdict({ decision: 'warn' }))).toBe(false);
    expect(shouldBlock(verdict({ decision: 'allow' }))).toBe(false);
  });

  it('does not block a vacuous verdict, or none at all', () => {
    expect(shouldBlock(verdict({ decision: 'allow', enforced: false, disabled: true }))).toBe(false);
    expect(shouldBlock(null)).toBe(false);
    expect(shouldBlock(undefined)).toBe(false);
  });

  it('reads the snake_case hook response too', () => {
    // `decision` and `enforced` are spelled the same on both shapes.
    const blocked = { decision: 'block', enforced: true } as GuardrailHookEvaluateResponse;
    const monitored = { decision: 'block', enforced: false } as GuardrailHookEvaluateResponse;

    expect(shouldBlock(blocked)).toBe(true);
    expect(shouldBlock(monitored)).toBe(false);
  });

  it('diverges from `passed`, which only reports whether a blocking finding exists', () => {
    const monitoring: Pick<GuardrailHookEvaluateResponse, 'passed' | 'decision' | 'enforced'> = {
      passed: false,
      decision: 'allow',
      enforced: false,
    };

    expect(monitoring.passed).toBe(false);
    expect(shouldBlock(monitoring)).toBe(false);
  });
});

// ── Hook params: the discriminated union ──────────────────────────────────

describe('GuardrailHookEvaluateParams (type level)', () => {
  /** Compiles iff the argument is a legal hook-evaluate body. */
  function accepts(_params: GuardrailHookEvaluateParams): void {
    /* type-level only */
  }

  it('requires the subject each hook actually needs', () => {
    // Valid calls.
    accepts({ hook: 'prompt.pre', guardrail_key: 'k', text: 'hello' });
    accepts({ hook: 'input.pre', guardrail_key: 'k', text: 'hello' });
    accepts({ hook: 'output.pre', guardrail_keys: ['a', 'b'], text: 'hello' });
    accepts({ hook: 'output.stream.delta', guardrail_key: 'k', buffer: 'hello', released_to: 2 });
    accepts({ hook: 'tool.pre', guardrail_key: 'k', tool_name: 'files/delete' });
    accepts({ hook: 'tool.post', guardrail_key: 'k', tool_name: 'files/read', tool_result: null });

    // @ts-expect-error `tool.pre` requires `tool_name`
    accepts({ hook: 'tool.pre', guardrail_key: 'k' });

    // @ts-expect-error `tool.post` requires `tool_result`
    accepts({ hook: 'tool.post', guardrail_key: 'k', tool_name: 'files/read' });

    // @ts-expect-error `input.pre` requires `text`
    accepts({ hook: 'input.pre', guardrail_key: 'k' });

    // @ts-expect-error `output.stream.delta` requires `buffer`
    accepts({ hook: 'output.stream.delta', guardrail_key: 'k', text: 'hello' });

    // @ts-expect-error one of `guardrail_key` / `guardrail_keys` is required
    accepts({ hook: 'input.pre', text: 'hello' });

    // @ts-expect-error `prompt.pre` requires `text`
    accepts({ hook: 'prompt.pre', guardrail_key: 'k' });

    // @ts-expect-error `hook` must be one of the six hook ids
    accepts({ hook: 'retrieval.post', guardrail_key: 'k', text: 'hello' });

    expect(true).toBe(true);
  });

  /**
   * THE HOOK LIST ITSELF.
   *
   * `HookId` fell a hook behind the Console once already: `prompt.pre` shipped
   * server-side and the SDK's union still named five, so the one hook that
   * exists specifically FOR a remote enforcement point was the one this client
   * could not ask for. Nothing failed — the id simply did not typecheck, and
   * the gap was invisible from in here.
   *
   * The exhaustive map is the guard: adding an id to `HookId` without adding it
   * below is a compile error, so the union cannot quietly grow or shrink.
   */
  it('names every hook the Console serves, and only those', () => {
    const SUBJECT: Readonly<Record<HookId, 'text' | 'stream_delta' | 'tool_call' | 'tool_result'>> =
      {
        'prompt.pre': 'text',
        'input.pre': 'text',
        'output.pre': 'text',
        'output.stream.delta': 'stream_delta',
        'tool.pre': 'tool_call',
        'tool.post': 'tool_result',
      };
    expect(Object.keys(SUBJECT)).toEqual([
      'prompt.pre',
      'input.pre',
      'output.pre',
      'output.stream.delta',
      'tool.pre',
      'tool.post',
    ]);
  });
});

// ── Requests ──────────────────────────────────────────────────────────────

describe('GuardrailsResource', () => {
  it('lists guardrails, unwrapping the envelope and forwarding the filters', async () => {
    const { http, calls } = stubClient({ guardrails: [{ key: 'secrets', name: 'Secrets' }] });
    const resource = new GuardrailsResource(http);

    const guardrails = await resource.list({ enabled: true, type: 'preset', search: 'pii' });

    expect(guardrails).toHaveLength(1);
    expect(guardrails[0].key).toBe('secrets');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(
      'https://console.example.com/api/client/v1/guardrails?enabled=true&type=preset&search=pii',
    );
  });

  it('lists with no filters', async () => {
    const { http, calls } = stubClient({ guardrails: [] });

    await new GuardrailsResource(http).list();

    expect(calls[0].url).toBe('https://console.example.com/api/client/v1/guardrails');
  });

  it('posts a hook evaluation to the hooks endpoint, body verbatim', async () => {
    const { http, calls } = stubClient({ hook: 'tool.pre', decision: 'block', enforced: true });
    const resource = new GuardrailsResource(http);

    const response = await resource.hooks.evaluate({
      hook: 'tool.pre',
      guardrail_key: 'tool-policy',
      tool_name: 'files/delete',
      tool_args: { path: '/etc/passwd' },
      only: ['tool_access'],
      shadow: true,
    });

    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(
      'https://console.example.com/api/client/v1/guardrails/hooks/evaluate',
    );
    expect(calls[0].body).toEqual({
      hook: 'tool.pre',
      guardrail_key: 'tool-policy',
      tool_name: 'files/delete',
      tool_args: { path: '/etc/passwd' },
      only: ['tool_access'],
      shadow: true,
    });
    expect(shouldBlock(response)).toBe(true);
  });

  it('leaves evaluate() on its legacy path and shape', async () => {
    const { http, calls } = stubClient({ passed: true, verdict: null });

    await new GuardrailsResource(http).evaluate({ guardrail_key: 'secrets', text: 'hi' });

    expect(calls[0].url).toBe('https://console.example.com/api/client/v1/guardrails/evaluate');
    expect(calls[0].body).toEqual({ guardrail_key: 'secrets', text: 'hi' });
  });
});

// ── Aegis removal ─────────────────────────────────────────────────────────

describe('AegisResource (deprecated)', () => {
  const call: AegisEvaluateRequest = {
    stage: 'tool.pre',
    actor: { id: 'user-1' },
    resource: { type: 'tool', name: 'files/delete' },
  };

  it('rejects instead of issuing a request that would 404', async () => {
    const { http, calls } = stubClient({});
    const aegis = new AegisResource(http);

    await expect(aegis.evaluate(call)).rejects.toBeInstanceOf(CognipeerError);
    expect(calls).toHaveLength(0);
  });

  it('names the replacement in the message', async () => {
    const aegis = new AegisResource();

    await expect(aegis.evaluate(call)).rejects.toThrow(/guardrails\.hooks\.evaluate/);
    await expect(aegis.evaluate(call)).rejects.toThrow(/guardrail_key/);
    await expect(aegis.evaluate(call)).rejects.toThrow(/next major/);
  });

  it('rejects from the shields sub-resource too', async () => {
    const { http, calls } = stubClient({});
    const shields = new AegisShieldsResource(http);

    await expect(shields.list()).rejects.toThrow(/client\.guardrails\.list\(\)/);
    await expect(shields.audit('default')).rejects.toBeInstanceOf(CognipeerError);
    expect(calls).toHaveLength(0);
  });
});
