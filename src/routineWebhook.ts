import { newIdempotencyKey } from './resources/agentRuns';

// HMAC-SHA256 in plain TypeScript: the package root also runs in browsers, where `node:crypto`
// does not exist, and a signature is wanted synchronously. Checked against `node:crypto` in the tests.

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

function sha256(data: Uint8Array): Uint8Array {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((data.length * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (data.length * 8) >>> 0);
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  const out = new Uint8Array(32);
  h.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v));
  return out;
}

function hmacSha256Hex(key: Uint8Array, message: Uint8Array): string {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha256(key) : key);
  const inner = new Uint8Array(64 + message.length);
  const outer = new Uint8Array(96);
  for (let i = 0; i < 64; i++) {
    inner[i] = block[i] ^ 0x36;
    outer[i] = block[i] ^ 0x5c;
  }
  inner.set(message, 64);
  outer.set(sha256(inner), 64);
  return Array.from(sha256(outer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface SignRoutineWebhookOptions {
  /** Unix seconds the signature is made at (default: now). The Console accepts one within 5 minutes. */
  timestamp?: number;
  /**
   * Sent as `x-cognipeer-event-id`: a delivery the Console already saw with the same id and body is
   * a duplicate and starts no second run. Default: a new random id, so reuse yours when retrying.
   */
  eventId?: string;
  /** Sent as `x-cognipeer-event` (up to 64 characters of `A-Z a-z 0-9 . _ : -`): the event name the trigger's `events` and `filter` see. */
  event?: string;
}

/**
 * The headers that authenticate a delivery to a webhook trigger with auth `signature` (preset
 * `generic`): send them with the exact `body` you sign (`string`, or bytes) as the request body.
 * The signature is `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">` with the routine's
 * secret, the scheme the Console uses for its own deliveries (`verifyWebhook()`).
 *
 * @example
 * ```typescript
 * const body = JSON.stringify({ event: 'deploy.failed', service: 'api' });
 * await fetch(routine.trigger.url, {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json', ...signRoutineWebhook(secret, body) },
 *   body,
 * });
 * ```
 */
export function signRoutineWebhook(
  secret: string,
  body: string | Uint8Array,
  options: SignRoutineWebhookOptions = {},
): Record<string, string> {
  const encoder = new TextEncoder();
  const timestamp = Math.floor(options.timestamp ?? Date.now() / 1000);
  const prefix = encoder.encode(`${timestamp}.`);
  const payload = typeof body === 'string' ? encoder.encode(body) : body;
  const signed = new Uint8Array(prefix.length + payload.length);
  signed.set(prefix);
  signed.set(payload, prefix.length);
  return {
    'x-cognipeer-signature': `t=${timestamp},v1=${hmacSha256Hex(encoder.encode(secret), signed)}`,
    'x-cognipeer-event-id': options.eventId ?? newIdempotencyKey(),
    ...(options.event ? { 'x-cognipeer-event': options.event } : {}),
  };
}
