import { describe, it, expect } from 'vitest';
import { AgentTriggersResource } from './agentTriggers';
import { createMockHttp } from '../test/mockHttp';
import type {
  AgentRun,
  AgentTrigger,
  AgentTriggerCreateRequest,
  AgentTriggerDeliveryList,
  AgentTriggerDryRun,
  AgentTriggerUpdateRequest,
  AgentTriggerWebhookSecret,
  AgentTriggerWithSecret,
} from '../types';

const trigger: AgentTrigger = {
  id: '6720a1b2c3d4e5f607182930',
  object: 'agent.trigger',
  agent: 'report-bot',
  name: 'Weekday digest',
  description: null,
  enabled: true,
  type: 'schedule',
  schedule: { cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
  prompt: 'Summarise yesterday',
  variables: null,
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
  trigger_id: trigger.id,
  trigger: 'manual',
  channel: 'trigger',
  created_at: 1_790_000_000,
};

const base = '/api/client/v1/agents/report-bot/triggers';

describe('AgentTriggersResource', () => {
  it('lists the triggers (list envelope)', async () => {
    const http = createMockHttp();
    const list = { object: 'list', data: [trigger], has_more: false };
    http.request.mockResolvedValue(list);

    expect(await new AgentTriggersResource(http).list('report-bot')).toBe(list);
    expect(http.request).toHaveBeenCalledWith('GET', base, { signal: undefined });
  });

  it('creates a schedule trigger: `type` plus the `schedule` sub-object, nothing nested under `trigger`', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(trigger);
    const body: AgentTriggerCreateRequest = {
      name: 'Weekday digest',
      type: 'schedule',
      schedule: { cron: '0 9 * * 1-5', timezone: 'Europe/Istanbul' },
      prompt: 'Summarise yesterday',
      variables: { team: 'ops' },
      class: 'deferred',
    };

    const out = await new AgentTriggersResource(http).create('report-bot', body);

    expect(out).toBe(trigger);
    expect(http.request).toHaveBeenCalledWith('POST', base, { body, signal: undefined });
    // the type and its settings sit at the top level of the body
    expect(Object.keys(http.request.mock.calls[0][2].body).sort()).toEqual(['class', 'name', 'prompt', 'schedule', 'type', 'variables']);
  });

  it('creates once and manual triggers with their own sub-object (manual has none)', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(trigger);
    const resource = new AgentTriggersResource(http);
    const once: AgentTriggerCreateRequest = { name: 'Launch', type: 'once', once: { run_at: '2026-12-01T09:00:00Z' }, prompt: 'Announce' };
    const later: AgentTriggerCreateRequest = { name: 'Later', type: 'once', once: { delay_seconds: 3600 }, prompt: 'Announce' };
    const manual: AgentTriggerCreateRequest = { name: 'On demand', type: 'manual', prompt: 'Summarise' };

    await resource.create('report-bot', once);
    await resource.create('report-bot', later);
    await resource.create('report-bot', manual);

    expect(http.request.mock.calls.map((call) => call[2].body)).toEqual([once, later, manual]);
  });

  it('creates a webhook trigger; the answer carries webhook.secret once', async () => {
    const http = createMockHttp();
    const created: AgentTriggerWithSecret = {
      id: trigger.id,
      object: 'agent.trigger',
      agent: 'report-bot',
      name: 'Review PRs',
      description: null,
      enabled: true,
      type: 'webhook',
      webhook: {
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
        secret: 'whsec_secret',
      },
      prompt: 'Review PR #{{payload.pull_request.number}}',
      variables: null,
      version: null,
      class: 'default',
      metadata: {},
      callback: null,
      response_format: null,
      next_fire_at: null,
      last_fire_at: null,
      last_run_id: null,
      last_status: null,
      last_error: null,
      created_at: 1_790_000_000,
      updated_at: 1_790_000_000,
    };
    http.request.mockResolvedValue(created);
    const body: AgentTriggerCreateRequest = {
      name: 'Review PRs',
      type: 'webhook',
      webhook: {
        preset: 'github',
        events: ['pull_request'],
        filter: [{ path: 'payload.action', op: 'in', value: ['opened', 'synchronize'] }],
      },
      prompt: 'Review PR #{{payload.pull_request.number}}',
    };

    const out = await new AgentTriggersResource(http).create('report-bot', body);

    expect(out.type).toBe('webhook');
    if (out.type === 'webhook') {
      expect(out.webhook.secret).toBe('whsec_secret');
      expect(out.webhook.url).toMatch(/\/api\/public\/hooks\//);
    }
    expect(http.request).toHaveBeenCalledWith('POST', base, { body, signal: undefined });
  });

  it('a trigger has one type and only the sub-object named after it (the type checker enforces the pairing)', () => {
    // @ts-expect-error a schedule trigger needs its `schedule`
    const noSettings: AgentTriggerCreateRequest = { name: 'x', type: 'schedule', prompt: 'p' };
    // @ts-expect-error `webhook` settings do not belong to a schedule trigger
    const wrongSettings: AgentTriggerCreateRequest = { name: 'x', type: 'schedule', webhook: { preset: 'github' }, prompt: 'p' };
    // @ts-expect-error a new trigger always says its type
    const noType: AgentTriggerCreateRequest = { name: 'x', schedule: { cron: '* * * * *' }, prompt: 'p' };
    // @ts-expect-error a type change sends the sub-object with it
    const typeAlone: AgentTriggerUpdateRequest = { type: 'once' };
    const fieldsAlone: AgentTriggerUpdateRequest = { enabled: false, variables: { team: 'ops' } };

    expect([noSettings, wrongSettings, noType, typeAlone, fieldsAlone]).toHaveLength(5);

    const answer: AgentTrigger = trigger;
    if (answer.type === 'schedule') expect(answer.schedule.cron).toBe('0 9 * * 1-5');
    // @ts-expect-error a schedule trigger has no webhook
    expect(answer.webhook).toBeUndefined();
  });

  it('gets, updates and deletes by trigger id (encoded)', async () => {
    const http = createMockHttp();
    http.request
      .mockResolvedValueOnce(trigger)
      .mockResolvedValueOnce(trigger)
      .mockResolvedValueOnce({ id: trigger.id, object: 'agent.trigger.deleted', deleted: true });
    const resource = new AgentTriggersResource(http);

    await resource.get('report-bot', 'trg/1');
    await resource.update('report-bot', trigger.id, { enabled: false });
    const deleted = await resource.delete('report-bot', trigger.id);

    expect(http.request).toHaveBeenNthCalledWith(1, 'GET', `${base}/trg%2F1`, { signal: undefined });
    expect(http.request).toHaveBeenNthCalledWith(2, 'PATCH', `${base}/${trigger.id}`, { body: { enabled: false }, signal: undefined });
    expect(http.request).toHaveBeenNthCalledWith(3, 'DELETE', `${base}/${trigger.id}`, { signal: undefined });
    expect(deleted).toEqual({ id: trigger.id, object: 'agent.trigger.deleted', deleted: true });
  });

  it('update() sends a changed type together with its sub-object', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(trigger);
    const body: AgentTriggerUpdateRequest = {
      type: 'webhook',
      webhook: { preset: 'generic', auth: 'standard_webhooks', secret: 'whsec_theirs' },
      variables: { number: '{{payload.number}}' },
    };

    await new AgentTriggersResource(http).update('report-bot', trigger.id, body);

    expect(http.request).toHaveBeenCalledWith('PATCH', `${base}/${trigger.id}`, { body, signal: undefined });
  });

  describe('run()', () => {
    it('fires it with overrides, a generated Idempotency-Key, Prefer, and wait in the body', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue(run);

      const out = await new AgentTriggersResource(http).run(
        'report-bot',
        trigger.id,
        { variables: { team: 'ops' }, metadata: { ticket: 'T-1' } },
        { wait: 10, prefer: { wait: 10 } },
      );

      expect(out).toBe(run);
      const [method, path, request] = http.request.mock.calls[0];
      expect(method).toBe('POST');
      expect(path).toBe(`${base}/${trigger.id}/run`);
      expect(request.body).toEqual({ variables: { team: 'ops' }, metadata: { ticket: 'T-1' }, wait: 10 });
      expect(request.headers.Prefer).toBe('wait=10');
      expect(request.headers['Idempotency-Key']).toMatch(/\S{8,}/);
    });

    it('sends the given idempotency key and no wait when none is asked for', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue(run);

      await new AgentTriggersResource(http).run('report-bot', trigger.id, {}, { idempotencyKey: 'job-7' });

      const request = http.request.mock.calls[0][2];
      expect(request.body).toEqual({});
      expect(request.headers).toEqual({ 'Idempotency-Key': 'job-7' });
    });

    it('sends a webhook trigger a sample payload and headers, and types the dry run', async () => {
      const http = createMockHttp();
      const dry: AgentTriggerDryRun = {
        object: 'agent.trigger.dry_run',
        matched: true,
        reason: null,
        event: 'pull_request',
        delivery_id: null,
        prompt: 'Review PR #7',
        variables: { number: 7 },
        errors: [],
      };
      http.request.mockResolvedValue(dry);

      const out = await new AgentTriggersResource(http).run('report-bot', trigger.id, {
        payload: { action: 'opened', pull_request: { number: 7 } },
        headers: { 'x-github-event': 'pull_request' },
        dry_run: true,
      });

      expect(out.matched).toBe(true);
      expect(out.prompt).toBe('Review PR #7');
      expect(out.variables).toEqual({ number: 7 });
      expect(http.request.mock.calls[0][2].body).toEqual({
        payload: { action: 'opened', pull_request: { number: 7 } },
        headers: { 'x-github-event': 'pull_request' },
        dry_run: true,
      });
    });
  });

  it('rotateWebhookSecret() posts the grace and the new secret, and returns the answer', async () => {
    const http = createMockHttp();
    const answer: AgentTriggerWebhookSecret = {
      object: 'agent.trigger.webhook_secret',
      secret: 'whsec_new',
      secret_hint: '_new',
      previous_valid_until: 1_800_000_600,
    };
    http.request.mockResolvedValue(answer);
    const resource = new AgentTriggersResource(http);

    expect(await resource.rotateWebhookSecret('report-bot', trigger.id, { grace_seconds: 600 })).toBe(answer);
    await resource.rotateWebhookSecret('report-bot', trigger.id);

    expect(http.request).toHaveBeenNthCalledWith(1, 'POST', `${base}/${trigger.id}/webhook/rotate-secret`, {
      body: { grace_seconds: 600 },
      signal: undefined,
    });
    expect(http.request.mock.calls[1][2].body).toEqual({});
  });

  it('deliveries() reads the log with before / limit', async () => {
    const http = createMockHttp();
    const list: AgentTriggerDeliveryList = {
      object: 'list',
      data: [
        {
          id: 'd2',
          object: 'agent.trigger.delivery',
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

    const out = await new AgentTriggersResource(http).deliveries('report-bot', trigger.id, { before: 'd3', limit: 50 });

    expect(out.has_more).toBe(true);
    expect(http.request).toHaveBeenCalledWith('GET', `${base}/${trigger.id}/deliveries`, {
      query: { before: 'd3', limit: 50 },
      signal: undefined,
    });
  });
});
