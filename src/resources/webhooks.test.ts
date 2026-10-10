import { describe, it, expect } from 'vitest';
import { WebhooksResource } from './webhooks';
import { ConsoleClient } from '../client';
import { createMockHttp } from '../test/mockHttp';
import type { WebhookDelivery, WebhookEndpoint, WebhookEndpointWithSecret } from '../types';

const endpoint: WebhookEndpoint = {
  id: 'whk_1',
  url: 'https://example.com/hook',
  description: null,
  events: ['action.required', 'agent_run.*'],
  projectId: 'proj_1',
  status: 'active',
  disabledReason: null,
  failingSince: null,
  createdBy: 'user_1',
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
};

const delivery: WebhookDelivery = {
  id: 'whd_1',
  endpointId: 'whk_1',
  eventId: 'evt_1',
  eventType: 'webhook.test',
  status: 'delivered',
  attempts: 1,
  nextAttemptAt: null,
  lastStatusCode: 204,
  lastError: null,
  lastDurationMs: 31,
  createdAt: '2026-10-10T10:00:00.000Z',
  deliveredAt: '2026-10-10T10:00:00.031Z',
  payload: { id: 'evt_1', type: 'webhook.test', createdAt: '2026-10-10T10:00:00.000Z', projectId: 'proj_1', data: {} },
};

describe('WebhooksResource', () => {
  it('is exposed as client.webhooks', () => {
    const client = new ConsoleClient({ apiKey: 'sk-test' });
    expect(client.webhooks).toBeInstanceOf(WebhooksResource);
  });

  it('creates an endpoint via POST /api/client/v1/webhooks and returns the one-time secret', async () => {
    const http = createMockHttp();
    const created: WebhookEndpointWithSecret = { ...endpoint, secret: 'whsec_abc' };
    http.request.mockResolvedValue({ endpoint: created });
    const body = { url: endpoint.url, events: endpoint.events, description: 'ops', projectId: null };

    const result = await new WebhooksResource(http).create(body);

    expect(result.secret).toBe('whsec_abc');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks', { body });
  });

  it('lists endpoints from the { endpoints } envelope', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ endpoints: [endpoint] });

    expect(await new WebhooksResource(http).list()).toEqual([endpoint]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks');
  });

  it('lists the event types from GET .../events', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ events: [{ type: 'session.idled', group: 'session' }] });

    expect(await new WebhooksResource(http).eventTypes()).toEqual([{ type: 'session.idled', group: 'session' }]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/events');
  });

  it('gets an endpoint by id from the { endpoint } envelope', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ endpoint });

    expect(await new WebhooksResource(http).get('whk_1')).toEqual(endpoint);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/whk_1');
  });

  it('encodes the webhook id', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ endpoint });

    await new WebhooksResource(http).get('whk/1');

    expect(http.request).toHaveBeenCalledWith('GET', `/api/client/v1/webhooks/${encodeURIComponent('whk/1')}`);
  });

  it('updates an endpoint via PATCH, including re-enabling it', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ endpoint: { ...endpoint, status: 'active' } });

    const result = await new WebhooksResource(http).update('whk_1', { status: 'active', events: ['session.idled'] });

    expect(result.status).toBe('active');
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/webhooks/whk_1', {
      body: { status: 'active', events: ['session.idled'] },
    });
  });

  it('deletes an endpoint via DELETE', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ deleted: true });

    const result = await new WebhooksResource(http).delete('whk_1');

    expect(result).toEqual({ deleted: true });
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/webhooks/whk_1');
  });

  it('rotates the secret via POST .../rotate-secret with an empty JSON body', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ endpoint: { ...endpoint, secret: 'whsec_new' } });

    const result = await new WebhooksResource(http).rotateSecret('whk_1');

    expect(result.secret).toBe('whsec_new');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks/whk_1/rotate-secret', { body: {} });
  });

  it('sends a test event via POST .../test', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ delivery });

    const result = await new WebhooksResource(http).test('whk_1');

    expect(result).toBe(delivery);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks/whk_1/test', { body: {} });
  });

  it('lists deliveries with status, limit and skip, keeping hasMore', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ deliveries: [delivery], hasMore: true });

    const result = await new WebhooksResource(http).deliveries('whk_1', { status: 'failed', limit: 20, skip: 40 });

    expect(result).toEqual({ deliveries: [delivery], hasMore: true });
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/whk_1/deliveries', {
      query: { status: 'failed', limit: 20, skip: 40 },
    });
  });

  it('lists deliveries without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ deliveries: [], hasMore: false });

    await new WebhooksResource(http).deliveries('whk_1');

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/whk_1/deliveries', {
      query: { status: undefined, limit: undefined, skip: undefined },
    });
  });

  it('redelivers a delivery via POST /webhooks/deliveries/{id}/redeliver', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ delivery: { ...delivery, status: 'pending' } });

    const result = await new WebhooksResource(http).redeliver('whd_1');

    expect(result.status).toBe('pending');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks/deliveries/whd_1/redeliver', {
      body: {},
    });
  });
});
