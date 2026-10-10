/**
 * @cognipeer/console-sdk/webhooks — Node.js-only helpers for verifying
 * webhooks the Console sends to your server.
 *
 * Kept out of the main entry point because it depends on `node:crypto`,
 * which would break browser bundles of `@cognipeer/console-sdk`.
 *
 * @packageDocumentation
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyWebhookParams {
  /**
   * The request body EXACTLY as received (string or bytes) — not a re-serialized
   * `JSON.stringify(req.body)`, whose key order/whitespace may differ.
   */
  rawBody: string | Uint8Array;
  /** Value of the `X-Cognipeer-Signature` header: `t=<unix seconds>,v1=<hex>`. */
  signatureHeader: string | null | undefined;
  /**
   * The signing secret: the webhook endpoint's `secret` (returned by
   * `webhooks.create()` / `webhooks.rotateSecret()`), or the `callback_secret`
   * sent when a background run was created.
   */
  secret: string;
  /** Maximum age (either direction) of the signature timestamp. Default 300 s. */
  toleranceSeconds?: number;
  /** Override "now" (unix seconds). For tests. */
  nowSeconds?: number;
}

/** @deprecated Alias of {@link VerifyWebhookParams}, kept for existing imports. */
export type VerifyAgentRunCallbackParams = VerifyWebhookParams;

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      if (!/^\d+$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === 'v1' && value) {
      signatures.push(value);
    }
  }
  if (timestamp === undefined || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Verify a delivery signed by the Console — a webhook subscription event or an
 * agent-run `callback_url` call. The `X-Cognipeer-Signature` header is
 * HMAC-SHA256 over `${t}.${rawBody}` keyed with your secret; this compares it in
 * constant time and rejects timestamps outside `toleranceSeconds` (replay window).
 *
 * Returns `true` only when the header is well-formed, the timestamp is within
 * tolerance and one of its `v1` signatures matches. Dedupe deliveries on the
 * `X-Cognipeer-Event-Id` (or `webhook-id`) header: a delivery can be retried.
 *
 * @example
 * ```typescript
 * import { verifyWebhook, type WebhookEvent } from '@cognipeer/console-sdk/webhooks';
 *
 * app.post('/hooks/cognipeer', express.raw({ type: 'application/json' }), (req, res) => {
 *   const ok = verifyWebhook({
 *     rawBody: req.body,
 *     signatureHeader: req.get('X-Cognipeer-Signature'),
 *     secret: process.env.COGNIPEER_WEBHOOK_SECRET!,
 *   });
 *   if (!ok) return res.sendStatus(400);
 *   const event: WebhookEvent = JSON.parse(req.body.toString('utf8'));
 *   res.sendStatus(204);
 * });
 * ```
 */
export function verifyWebhook(params: VerifyWebhookParams): boolean {
  const { rawBody, signatureHeader, secret } = params;
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  if (!signatureHeader || !secret) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) return false;

  // A string body is hashed as UTF-8 (update()'s default encoding).
  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.`)
    .update(rawBody)
    .digest();

  let matched = false;
  for (const candidate of parsed.signatures) {
    if (!/^[0-9a-fA-F]+$/.test(candidate) || candidate.length !== expected.length * 2) continue;
    // Keep scanning after a match so timing does not reveal which entry matched.
    if (timingSafeEqual(Buffer.from(candidate, 'hex'), expected)) matched = true;
  }
  return matched;
}

/**
 * Verify an agent-run callback (`callback_url` + `callback_secret`). Same scheme
 * as {@link verifyWebhook}, which is the name to use in new code.
 *
 * @example
 * ```typescript
 * import { verifyAgentRunCallback } from '@cognipeer/console-sdk/webhooks';
 *
 * app.post('/hooks/agent-run', express.raw({ type: 'application/json' }), (req, res) => {
 *   const ok = verifyAgentRunCallback({
 *     rawBody: req.body,
 *     signatureHeader: req.get('X-Cognipeer-Signature'),
 *     secret: process.env.AGENT_CALLBACK_SECRET!,
 *   });
 *   if (!ok) return res.sendStatus(400);
 *   const event = JSON.parse(req.body.toString('utf8'));
 *   res.sendStatus(204);
 * });
 * ```
 */
export function verifyAgentRunCallback(params: VerifyAgentRunCallbackParams): boolean {
  return verifyWebhook(params);
}

export type {
  AgentRunCallbackEvent,
  WebhookEvent,
  KnownWebhookEvent,
  UnknownWebhookEvent,
  WebhookEventType,
} from './types';
