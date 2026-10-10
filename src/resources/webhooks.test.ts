import { describe, it, expect } from 'vitest';
import { WebhooksResource } from './webhooks';
import { ConsoleClient } from '../client';
import { createMockHttp } from '../test/mockHttp';
import type { WebhookDelivery, WebhookEndpoint, WebhookEndpointWithSecret } from '../types';

const endpoint: WebhookEndpoint = {
  id: 'whk_1',
  url: 'https://example.com/hook',
  events: ['action.required', 'agent_run.*'],
  projectId: 'proj_1',
  status: 'active',
};

const delivery: WebhookDelivery = {
  id: 'whd_1',
  endpointId: 'whk_1',
  eventId: 'evt_1',
  eventType: 'webhook.test',
  status: 'delivered',
  attempts: 1,
  lastStatusCode: 204,
};

describe('WebhooksResource', () => {
  it('is exposed as client.webhooks', () => {
    const client = new ConsoleClient({ apiKey: 'sk-test' });
    expect(client.webhooks).toBeInstanceOf(WebhooksResource);
  });

  it('creates an endpoint via POST /api/client/v1/webhooks and returns the one-time secret', async () => {
    const http = createMockHttp();
    const created: WebhookEndpointWithSecret = { ...endpoint, secret: 'whsec_abc' };
    http.request.mockResolvedValue(created);
    const body = { url: endpoint.url, events: endpoint.events, description: 'ops', projectId: null };

    const result = await new WebhooksResource(http).create(body);

    expect(result.secret).toBe('whsec_abc');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks', { body });
  });

  it('lists endpoints from a bare array, { data } or { webhooks }', async () => {
    const http = createMockHttp();
    const resource = new WebhooksResource(http);
    http.request
      .mockResolvedValueOnce([endpoint])
      .mockResolvedValueOnce({ object: 'list', data: [endpoint] })
      .mockResolvedValueOnce({ webhooks: [endpoint] })
      .mockResolvedValueOnce({});

    expect(await resource.list()).toEqual([endpoint]);
    expect(await resource.list()).toEqual([endpoint]);
    expect(await resource.list()).toEqual([endpoint]);
    expect(await resource.list()).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks');
  });

  it('gets an endpoint by id, bare or wrapped', async () => {
    const http = createMockHttp();
    const resource = new WebhooksResource(http);
    http.request.mockResolvedValueOnce(endpoint).mockResolvedValueOnce({ webhook: endpoint });

    expect(await resource.get('whk_1')).toEqual(endpoint);
    expect(await resource.get('whk_1')).toEqual(endpoint);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/whk_1');
  });

  it('encodes the webhook id', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(endpoint);

    await new WebhooksResource(http).get('whk/1');

    expect(http.request).toHaveBeenCalledWith('GET', `/api/client/v1/webhooks/${encodeURIComponent('whk/1')}`);
  });

  it('updates an endpoint via PATCH, including re-enabling it', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ ...endpoint, status: 'active' });

    const result = await new WebhooksResource(http).update('whk_1', { status: 'active', events: ['session.idled'] });

    expect(result.status).toBe('active');
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/webhooks/whk_1', {
      body: { status: 'active', events: ['session.idled'] },
    });
  });

  it('deletes an endpoint via DELETE', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'whk_1', deleted: true });

    const result = await new WebhooksResource(http).delete('whk_1');

    expect(result).toEqual({ id: 'whk_1', deleted: true });
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/webhooks/whk_1');
  });

  it('rotates the secret via POST .../rotate-secret with an empty JSON body', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ ...endpoint, secret: 'whsec_new' });

    const result = await new WebhooksResource(http).rotateSecret('whk_1');

    expect(result.secret).toBe('whsec_new');
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks/whk_1/rotate-secret', { body: {} });
  });

  it('sends a test event via POST .../test', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(delivery);

    const result = await new WebhooksResource(http).test('whk_1');

    expect(result).toBe(delivery);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/webhooks/whk_1/test', { body: {} });
  });

  it('lists deliveries with status and limit filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ object: 'list', data: [delivery] });

    const result = await new WebhooksResource(http).deliveries('whk_1', { status: 'failed', limit: 20 });

    expect(result).toEqual([delivery]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/whk_1/deliveries', {
      query: { status: 'failed', limit: 20 },
    });
  });

  it('lists deliveries without filters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue([delivery]);

    await new WebhooksResource(http).deliveries('whk_1');

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/webhooks/whk_1/deliveries', {
      query: { status: undefined, limit: undefined },
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
