import { HttpClient } from '../http';
import { unwrapList, unwrapOne } from '../unwrap';
import {
  CreateWebhookRequest,
  ListWebhookDeliveriesQuery,
  UpdateWebhookRequest,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
} from '../types';

const WEBHOOKS_PATH = '/api/client/v1/webhooks';

function webhookPath(webhookId: string, suffix = ''): string {
  return `${WEBHOOKS_PATH}/${encodeURIComponent(webhookId)}${suffix}`;
}

/**
 * Webhook subscriptions API — the Console POSTs the events you subscribe to
 * (`session.idled`, `action.required`, `agent_run.*`...) to your URL, signed
 * with the endpoint's secret. Verify them with `verifyWebhook` from
 * `@cognipeer/console-sdk/webhooks`, and dedupe on the `webhook-id` header: a
 * delivery is retried until your endpoint answers 2xx.
 *
 * Needs a Console with agent runtime phase 1 (webhooks). Managing endpoints
 * takes a project admin/owner token; an endpoint for every project of the
 * tenant (`projectId: null`) takes a tenant admin/owner.
 *
 * @example
 * ```typescript
 * const hook = await client.webhooks.create({
 *   url: 'https://example.com/hooks/cognipeer',
 *   events: ['action.required', 'agent_run.*'],
 * });
 * saveSecret(hook.secret); // shown only now
 * await client.webhooks.test(hook.id);
 * ```
 */
export class WebhooksResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Subscribe a URL to events. The URL is checked against the SSRF guard
   * (public hosts only). The returned `secret` is shown once.
   */
  async create(body: CreateWebhookRequest): Promise<WebhookEndpointWithSecret> {
    const response = await this.http.request<unknown>('POST', WEBHOOKS_PATH, { body });
    return unwrapOne<WebhookEndpointWithSecret>(response, 'webhook');
  }

  /** The subscriptions visible to the token. */
  async list(): Promise<WebhookEndpoint[]> {
    const response = await this.http.request<unknown>('GET', WEBHOOKS_PATH);
    return unwrapList<WebhookEndpoint>(response, 'webhooks');
  }

  /** One subscription (never includes the secret). */
  async get(webhookId: string): Promise<WebhookEndpoint> {
    const response = await this.http.request<unknown>('GET', webhookPath(webhookId));
    return unwrapOne<WebhookEndpoint>(response, 'webhook');
  }

  /** Change the URL, events or description, or re-enable a disabled endpoint with `status: 'active'`. */
  async update(webhookId: string, body: UpdateWebhookRequest): Promise<WebhookEndpoint> {
    const response = await this.http.request<unknown>('PATCH', webhookPath(webhookId), { body });
    return unwrapOne<WebhookEndpoint>(response, 'webhook');
  }

  /** Delete a subscription and stop its pending deliveries. */
  async delete(webhookId: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.request<{ id: string; deleted: boolean }>('DELETE', webhookPath(webhookId));
  }

  /** Issue a new signing secret (shown once); the old one stops working. */
  async rotateSecret(webhookId: string): Promise<WebhookEndpointWithSecret> {
    const response = await this.http.request<unknown>('POST', webhookPath(webhookId, '/rotate-secret'), {
      body: {},
    });
    return unwrapOne<WebhookEndpointWithSecret>(response, 'webhook');
  }

  /** Send a `webhook.test` event to the endpoint; returns the delivery to inspect. */
  async test(webhookId: string): Promise<WebhookDelivery> {
    const response = await this.http.request<unknown>('POST', webhookPath(webhookId, '/test'), { body: {} });
    return unwrapOne<WebhookDelivery>(response, 'delivery');
  }

  /** Delivery attempts of an endpoint, newest first. */
  async deliveries(webhookId: string, query: ListWebhookDeliveriesQuery = {}): Promise<WebhookDelivery[]> {
    const response = await this.http.request<unknown>('GET', webhookPath(webhookId, '/deliveries'), {
      query: { status: query.status, limit: query.limit },
    });
    return unwrapList<WebhookDelivery>(response, 'deliveries');
  }

  /** Send a delivery again (the same event id), e.g. after fixing the receiver. */
  async redeliver(deliveryId: string): Promise<WebhookDelivery> {
    const response = await this.http.request<unknown>(
      'POST',
      `${WEBHOOKS_PATH}/deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
      { body: {} },
    );
    return unwrapOne<WebhookDelivery>(response, 'delivery');
  }
}
