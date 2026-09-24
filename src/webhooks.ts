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

export interface VerifyAgentRunCallbackParams {
  /**
   * The request body EXACTLY as received (string or bytes) — not a re-serialized
   * `JSON.stringify(req.body)`, whose key order/whitespace may differ.
   */
  rawBody: string | Uint8Array;
  /** Value of the `X-Cognipeer-Signature` header: `t=<unix seconds>,v1=<hex>`. */
  signatureHeader: string | null | undefined;
  /** The `callback_secret` sent when the run was created. */
  secret: string;
  /** Maximum age (either direction) of the signature timestamp. Default 300 s. */
  toleranceSeconds?: number;
  /** Override "now" (unix seconds). For tests. */
  nowSeconds?: number;
}

interface ParsedSignature {
  timestamp: number;
  signatures: string[];
}

function parseSignatureHeader(header: string): ParsedSignature | null {
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
 * Verify an agent-run callback (`X-Cognipeer-Signature`) — HMAC-SHA256 over
 * `${t}.${rawBody}` keyed with your `callback_secret`, compared in constant
 * time, with a replay window of `toleranceSeconds`.
 *
 * Returns `true` only when the header is well-formed, the timestamp is within
 * tolerance and one of its `v1` signatures matches. Dedupe deliveries on the
 * `X-Cognipeer-Event-Id` header: a callback can be retried.
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
  const { rawBody, signatureHeader, secret } = params;
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  if (!signatureHeader || !secret) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) return false;

  const hmac = createHmac('sha256', secret);
  hmac.update(`${parsed.timestamp}.`);
  hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
  const expected = hmac.digest();

  let matched = false;
  for (const candidate of parsed.signatures) {
    if (!/^[0-9a-fA-F]+$/.test(candidate) || candidate.length !== expected.length * 2) continue;
    // Keep scanning after a match so timing does not reveal which entry matched.
    if (timingSafeEqual(Buffer.from(candidate, 'hex'), expected)) matched = true;
  }
  return matched;
}

export type { AgentRunCallbackEvent } from './types';
