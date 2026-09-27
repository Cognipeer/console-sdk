import { describe, it, expect } from 'vitest';
import { AegisResource, AegisShieldsResource } from './aegis';
import { CognipeerError } from '../types';
import type { AegisEvaluateRequest } from '../types';

// The Aegis enforcement plane has been removed from the Console
// (/api/client/v1/aegis/* no longer exists) and replaced by the guardrail
// hook plane. Every method here now rejects with a migration message instead
// of issuing a request that would 404 — see `src/__tests__/guardrails.test.ts`
// for the `client.guardrails` replacement surface these messages point to.

const call: AegisEvaluateRequest = {
  stage: 'tool.pre',
  actor: { id: 'user_1', roles: ['member'] },
  resource: { type: 'tool', name: 'search', arguments: { query: 'weather' } },
};

describe('AegisResource (deprecated)', () => {
  it('evaluate() rejects instead of calling POST /api/client/v1/aegis/evaluate', async () => {
    const resource = new AegisResource();

    await expect(resource.evaluate(call)).rejects.toBeInstanceOf(CognipeerError);
  });

  it('names the guardrails.hooks.evaluate() replacement, the field renames, and the removal version', async () => {
    const resource = new AegisResource();

    await expect(resource.evaluate(call)).rejects.toThrow(/guardrails\.hooks\.evaluate/);
    await expect(resource.evaluate(call)).rejects.toThrow(/guardrail_key/);
    await expect(resource.evaluate(call)).rejects.toThrow(/tool_name/);
    await expect(resource.evaluate(call)).rejects.toThrow(/shouldBlock/);
    await expect(resource.evaluate(call)).rejects.toThrow(/next major/);
  });

  it('still constructs from an HttpClient, for 1.x callers that pass one', () => {
    // Accepted and ignored — the resource issues no requests to use it with.
    expect(() => new AegisResource(undefined)).not.toThrow();
  });
});

describe('AegisShieldsResource (deprecated)', () => {
  it('list() rejects instead of calling GET /api/client/v1/aegis/shields', async () => {
    const resource = new AegisResource().shields;

    await expect(resource.list()).rejects.toBeInstanceOf(CognipeerError);
    await expect(resource.list()).rejects.toThrow(/client\.guardrails\.list\(\)/);
    await expect(resource.list()).rejects.toThrow(/next major/);
  });

  it('audit() rejects for every shield id, with no client-API replacement', async () => {
    const resource = new AegisShieldsResource();

    await expect(resource.audit('default')).rejects.toBeInstanceOf(CognipeerError);
    await expect(resource.audit('shield/with space', { limit: 10, decision: 'allow' }))
      .rejects.toThrow(/no client-API equivalent/);
  });
});
