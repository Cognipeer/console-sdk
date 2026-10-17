import { describe, it, expect } from 'vitest';
import { AgentRoutinesResource } from './agentRoutines';
import { createMockHttp } from '../test/mockHttp';
import type {
  AgentRoutine,
  AgentRoutineCreateRequest,
  AgentRoutineDeliveryList,
  AgentRoutineDryRun,
  AgentRoutineWebhookSecret,
  AgentRun,
} from '../types';

const routine: AgentRoutine = {
  id: '6720a1b2c3d4e5f607182930',
  object: 'agent.routine',
  agent: 'report-bot',
  name: 'Weekday digest',
  description: null,
  enabled: true,
  trigger: { type: 'schedule', cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
  prompt: 'Summarise yesterday',
  inputs: null,
  version: null,
  class: 'default',
  metadata: {},
  callback: null,
  response_format: null,
  next_fire_at: 1_800_000_000,
  last_fire_at: null,
  last_run_id: null,
  last_status: null,
  last_error: null,
  created_at: 1_790_000_000,
  updated_at: 1_790_000_000,
};

const run: AgentRun = {
  id: 'run_6720a1b2c3d4e5f607182931',
  object: 'agent.run',
  status: 'queued',
  routine_id: routine.id,
  trigger: 'manual',
  channel: 'routine',
  created_at: 1_790_000_000,
};

const base = '/api/client/v1/agents/report-bot/routines';

describe('AgentRoutinesResource', () => {
  it('lists the routines (list envelope)', async () => {
    const http = createMockHttp();
    const list = { object: 'list', data: [routine], has_more: false };
    http.request.mockResolvedValue(list);

    expect(await new AgentRoutinesResource(http).list('report-bot')).toBe(list);
    expect(http.request).toHaveBeenCalledWith('GET', base, { signal: undefined });
  });

  it('creates a routine via POST; a webhook trigger answers with the secret once', async () => {
    const http = createMockHttp();
    const created: AgentRoutine = {
      ...routine,
      trigger: {
        type: 'webhook',
        url: 'https://console.example.com/api/public/hooks/t1/wh_abc',
        preset: 'github',
        auth: 'github_signature',
        header_name: null,
        secret_hint: 'k9Qz',
        secret_source: 'generated',
        previous_secret_valid_until: null,
        events: ['pull_request'],
        filter: [{ path: 'payload.action', op: 'in', value: ['opened', 'synchronize'] }],
        include_payload: true,
      },
      next_fire_at: null,
      webhook: { url: 'https://console.example.com/api/public/hooks/t1/wh_abc', secret: 'whsec_secret' },
    };
    http.request.mockResolvedValue(created);
    const body: AgentRoutineCreateRequest = {
      name: 'Review PRs',
      trigger: {
        type: 'webhook',
        preset: 'github',
        events: ['pull_request'],
        filter: [{ path: 'payload.action', op: 'in', value: ['opened', 'synchronize'] }],
      },
      prompt: 'Review PR #{{payload.pull_request.number}}',
    };

    const out = await new AgentRoutinesResource(http).create('report-bot', body);

    expect(out.webhook?.secret).toBe('whsec_secret');
    expect(http.request).toHaveBeenCalledWith('POST', base, { body, signal: undefined });
  });

  it('gets, updates and deletes by routine id (encoded)', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce(routine)
      .mockResolvedValueOnce(routine)
      .mockResolvedValueOnce({ id: routine.id, object: 'agent.routine.deleted', deleted: true });
    const resource = new AgentRoutinesResource(http);

    await resource.get('report-bot', 'rtn/1');
    await resource.update('report-bot', routine.id, { enabled: false });
    const deleted = await resource.delete('report-bot', routine.id);

    expect(http.request).toHaveBeenNthCalledWith(1, 'GET', `${base}/rtn%2F1`, { signal: undefined });
    expect(http.request).toHaveBeenNthCalledWith(2, 'PATCH', `${base}/${routine.id}`, { body: { enabled: false }, signal: undefined });
    expect(http.request).toHaveBeenNthCalledWith(3, 'DELETE', `${base}/${routine.id}`, { signal: undefined });
    expect(deleted).toEqual({ id: routine.id, object: 'agent.routine.deleted', deleted: true });
  });

  describe('run()', () => {
    it('fires it with overrides, a generated Idempotency-Key, Prefer, and wait in the body', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue(run);

      const out = await new AgentRoutinesResource(http).run(
        'report-bot',
        routine.id,
        { inputs: { team: 'ops' }, metadata: { ticket: 'T-1' } },
        { wait: 10, prefer: { wait: 10 } },
      );

      expect(out).toBe(run);
      const [method, path, request] = http.request.mock.calls[0];
      expect(method).toBe('POST');
      expect(path).toBe(`${base}/${routine.id}/run`);
      expect(request.body).toEqual({ inputs: { team: 'ops' }, metadata: { ticket: 'T-1' }, wait: 10 });
      expect(request.headers.Prefer).toBe('wait=10');
      expect(request.headers['Idempotency-Key']).toMatch(/\S{8,}/);
    });

    it('sends the given idempotency key and no wait when none is asked for', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue(run);

      await new AgentRoutinesResource(http).run('report-bot', routine.id, {}, { idempotencyKey: 'job-7' });

      const request = http.request.mock.calls[0][2];
      expect(request.body).toEqual({});
      expect(request.headers).toEqual({ 'Idempotency-Key': 'job-7' });
    });

    it('sends a webhook routine a sample payload and headers, and types the dry run', async () => {
      const http = createMockHttp();
      const dry: AgentRoutineDryRun = {
        object: 'agent.routine.dry_run',
        matched: true,
        reason: null,
        event: 'pull_request',
        delivery_id: null,
        prompt: 'Review PR #7',
        inputs: null,
        errors: [],
      };
      http.request.mockResolvedValue(dry);

      const out = await new AgentRoutinesResource(http).run('report-bot', routine.id, {
        payload: { action: 'opened', pull_request: { number: 7 } },
        headers: { 'x-github-event': 'pull_request' },
        dry_run: true,
      });

      expect(out.matched).toBe(true);
      expect(out.prompt).toBe('Review PR #7');
      expect(http.request.mock.calls[0][2].body).toEqual({
        payload: { action: 'opened', pull_request: { number: 7 } },
        headers: { 'x-github-event': 'pull_request' },
        dry_run: true,
      });
    });
  });

  it('rotateWebhookSecret() posts the grace and the new secret, and returns the answer', async () => {
    const http = createMockHttp();
    const answer: AgentRoutineWebhookSecret = {
      object: 'agent.routine.webhook_secret',
      secret: 'whsec_new',
      secret_hint: '_new',
      previous_valid_until: 1_800_000_600,
    };
    http.request.mockResolvedValue(answer);
    const resource = new AgentRoutinesResource(http);

    expect(await resource.rotateWebhookSecret('report-bot', routine.id, { grace_seconds: 600 })).toBe(answer);
    await resource.rotateWebhookSecret('report-bot', routine.id);

    expect(http.request).toHaveBeenNthCalledWith(1, 'POST', `${base}/${routine.id}/webhook/rotate-secret`, {
      body: { grace_seconds: 600 },
      signal: undefined,
    });
    expect(http.request.mock.calls[1][2].body).toEqual({});
  });

  it('deliveries() reads the log with before / limit', async () => {
    const http = createMockHttp();
    const list: AgentRoutineDeliveryList = {
      object: 'list',
      data: [
        {
          id: 'd2',
          object: 'agent.routine.delivery',
          received_at: 1_800_000_100,
          outcome: 'filtered',
          http_status: 200,
          event: 'pull_request',
          delivery_id: 'abc-1',
          run_id: null,
          reason: 'rule 0 (payload.action in) did not match (value: string, 6 chars)',
          bytes: 512,
        },
      ],
      has_more: true,
    };
    http.request.mockResolvedValue(list);

    const out = await new AgentRoutinesResource(http).deliveries('report-bot', routine.id, { before: 'd3', limit: 50 });

    expect(out.has_more).toBe(true);
    expect(http.request).toHaveBeenCalledWith('GET', `${base}/${routine.id}/deliveries`, {
      query: { before: 'd3', limit: 50 },
      signal: undefined,
    });
  });
});
