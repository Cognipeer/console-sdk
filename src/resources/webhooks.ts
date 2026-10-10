import { HttpClient } from '../http';
import {
  CreateWebhookRequest,
  ListWebhookDeliveriesQuery,
  UpdateWebhookRequest,
  WebhookDelivery,
  WebhookDeliveryList,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
  WebhookEventTypeInfo,
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
 * Unlike the rest of the agent API, the webhook objects keep camelCase field
 * names (`projectId`, `createdAt`, `endpointId`...), as on the other
 * resource-management routes. Errors come as `{ error: '<message>', code }`
 * (`code`: `forbidden`, `not_found`, `limit_reached`, `endpoint_disabled`,
 * `delivery_pending`, ...); the message is on `CognipeerAPIError.message` and
 * the code on `CognipeerAPIError.errorCode`.
 *
 * Managing endpoints takes a token whose owner is a project admin (or a tenant
 * owner/admin); everyone else gets 403. A token only manages its own project's
 * endpoints, never tenant-wide ones or those of other projects. Up to 50
 * endpoints per tenant.
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

  /** The event types a subscription can ask for (`GET /webhooks/events`). */
  async eventTypes(): Promise<WebhookEventTypeInfo[]> {
    const response = await this.http.request<{ events: WebhookEventTypeInfo[] }>('GET', `${WEBHOOKS_PATH}/events`);
    return response.events;
  }

  /**
   * Subscribe a URL to events (201). The URL is checked against the SSRF guard
   * (public hosts only). The returned `secret` is shown once.
   */
  async create(body: CreateWebhookRequest): Promise<WebhookEndpointWithSecret> {
    const response = await this.http.request<{ endpoint: WebhookEndpointWithSecret }>('POST', WEBHOOKS_PATH, { body });
    return response.endpoint;
  }

  /** The project's subscriptions (a token never sees other projects' or tenant-wide ones). */
  async list(): Promise<WebhookEndpoint[]> {
    const response = await this.http.request<{ endpoints: WebhookEndpoint[] }>('GET', WEBHOOKS_PATH);
    return response.endpoints;
  }

  /** One subscription (never includes the secret). */
  async get(webhookId: string): Promise<WebhookEndpoint> {
    const response = await this.http.request<{ endpoint: WebhookEndpoint }>('GET', webhookPath(webhookId));
    return response.endpoint;
  }

  /** Change the URL, events or description, or re-enable a disabled endpoint with `status: 'active'`. */
  async update(webhookId: string, body: UpdateWebhookRequest): Promise<WebhookEndpoint> {
    const response = await this.http.request<{ endpoint: WebhookEndpoint }>('PATCH', webhookPath(webhookId), { body });
    return response.endpoint;
  }

  /** Delete a subscription. The Console answers `{ deleted: true }` (no id). */
  async delete(webhookId: string): Promise<{ deleted: true }> {
    return this.http.request<{ deleted: true }>('DELETE', webhookPath(webhookId));
  }

  /** Issue a new signing secret (shown once); the old one stops working. */
  async rotateSecret(webhookId: string): Promise<WebhookEndpointWithSecret> {
    const response = await this.http.request<{ endpoint: WebhookEndpointWithSecret }>(
      'POST',
      webhookPath(webhookId, '/rotate-secret'),
      { body: {} },
    );
    return response.endpoint;
  }

  /**
   * Send a `webhook.test` event to the endpoint now. The call waits for the
   * receiver and returns the delivery with what it answered (`status`,
   * `lastStatusCode`, `lastError`).
   */
  async test(webhookId: string): Promise<WebhookDelivery> {
    const response = await this.http.request<{ delivery: WebhookDelivery }>('POST', webhookPath(webhookId, '/test'), {
      body: {},
    });
    return response.delivery;
  }

  /** Delivery attempts of an endpoint, newest first; `hasMore` says whether to page on with `skip`. */
  async deliveries(webhookId: string, query: ListWebhookDeliveriesQuery = {}): Promise<WebhookDeliveryList> {
    return this.http.request<WebhookDeliveryList>('GET', webhookPath(webhookId, '/deliveries'), {
      query: { status: query.status, limit: query.limit, skip: query.skip },
    });
  }

  /**
   * Put a delivery back in the queue (202; the same event id, to the endpoint's
   * current URL and secret), e.g. after fixing the receiver. Returns the reset
   * delivery (`status: 'pending'`); it is sent asynchronously. Rejects with
   * 409 `endpoint_disabled` (enable the endpoint first) or `delivery_pending`.
   */
  async redeliver(deliveryId: string): Promise<WebhookDelivery> {
    const response = await this.http.request<{ delivery: WebhookDelivery }>(
      'POST',
      `${WEBHOOKS_PATH}/deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
      { body: {} },
    );
    return response.delivery;
  }
}
