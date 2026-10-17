import { describe, it, expect } from 'vitest';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { signRoutineWebhook } from './routineWebhook';
import { signRoutineWebhook as exportedFromRoot } from './index';
import { verifyWebhook } from './webhooks';

const NOW = 1_800_000_000;
const BODY = JSON.stringify({ event: 'deploy.failed', service: 'api' });
const SECRET = 'whsec_Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZg';

// The Console's check for auth `signature` (console: src/lib/services/agents/routineWebhookAuth.ts,
// verifyBodyAuth), reduced to that one mode: the signature header, a 5 minute window, an HMAC-SHA256
// over "<t>." + the raw body, compared as digests.
function serverVerifiesSignature(headers: Record<string, string>, body: Buffer, secrets: string[], nowMs: number) {
  const header = headers['x-cognipeer-signature'];
  if (!header) return { ok: false, reason: 'missing signature' };
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value.toLowerCase());
  }
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return { ok: false, reason: 'missing signature' };
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return { ok: false, reason: 'timestamp outside the 5 minute window' };
  const digest = (value: string) => createHash('sha256').update(value).digest();
  let matched = false;
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
    for (const signature of signatures) matched = timingSafeEqual(digest(expected), digest(signature)) || matched;
  }
  return matched ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

describe('signRoutineWebhook', () => {
  it('is exported from the package root', () => {
    expect(exportedFromRoot).toBe(signRoutineWebhook);
  });

  it('matches a fixed vector (openssl dgst -sha256 -hmac over "<t>.<body>")', () => {
    const headers = signRoutineWebhook(SECRET, BODY, { timestamp: NOW, eventId: 'evt-1' });
    expect(headers['x-cognipeer-signature']).toBe(
      `t=${NOW},v1=515151575656c98bcda008f45cc22a4bab5567b42ad6ad5b69e52a83b2d65370`,
    );
  });

  it('is accepted by the Console verifier (bodies of every block size, short and long secrets)', () => {
    for (const bodyLength of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      for (const secretLength of [1, 31, 64, 65, 200]) {
        const body = randomBytes(bodyLength);
        const secret = randomBytes(secretLength).toString('base64').slice(0, secretLength);
        const headers = signRoutineWebhook(secret, body, { timestamp: NOW });
        expect(serverVerifiesSignature(headers, body, [secret], NOW * 1000), `${bodyLength}/${secretLength}`).toEqual({ ok: true });
      }
    }
  });

  it('signs a string body as UTF-8 and the same bytes alike', () => {
    const body = JSON.stringify({ text: 'özgür ✓ 日本語' });
    const fromString = signRoutineWebhook(SECRET, body, { timestamp: NOW, eventId: 'a' });
    const fromBytes = signRoutineWebhook(SECRET, Buffer.from(body, 'utf8'), { timestamp: NOW, eventId: 'a' });
    expect(fromString).toEqual(fromBytes);
    expect(serverVerifiesSignature(fromString, Buffer.from(body, 'utf8'), [SECRET], NOW * 1000)).toEqual({ ok: true });
  });

  it('is rejected for another secret, a changed body or a timestamp outside the window', () => {
    const headers = signRoutineWebhook(SECRET, BODY, { timestamp: NOW });
    const body = Buffer.from(BODY);
    expect(serverVerifiesSignature(headers, body, ['another-secret'], NOW * 1000).reason).toBe('signature mismatch');
    expect(serverVerifiesSignature(headers, Buffer.from(`${BODY} `), [SECRET], NOW * 1000).reason).toBe('signature mismatch');
    expect(serverVerifiesSignature(headers, body, [SECRET], (NOW + 301) * 1000).reason).toBe('timestamp outside the 5 minute window');
    expect(serverVerifiesSignature(headers, body, [SECRET], (NOW + 300) * 1000)).toEqual({ ok: true });
  });

  it('uses the same scheme as verifyWebhook()', () => {
    const headers = signRoutineWebhook(SECRET, BODY, { timestamp: NOW });
    expect(verifyWebhook({ rawBody: BODY, signatureHeader: headers['x-cognipeer-signature'], secret: SECRET, nowSeconds: NOW })).toBe(true);
  });

  it('adds the event id (generated, or yours) and the event name when given', () => {
    const generated = signRoutineWebhook(SECRET, BODY);
    expect(Object.keys(generated).sort()).toEqual(['x-cognipeer-event-id', 'x-cognipeer-signature']);
    // The Console only reads ids of up to 128 characters of A-Za-z0-9._:-
    expect(generated['x-cognipeer-event-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(signRoutineWebhook(SECRET, BODY)['x-cognipeer-event-id']).not.toBe(generated['x-cognipeer-event-id']);

    expect(signRoutineWebhook(SECRET, BODY, { timestamp: NOW, eventId: 'deploy-42', event: 'deploy.failed' })).toEqual({
      'x-cognipeer-signature': expect.stringMatching(new RegExp(`^t=${NOW},v1=[0-9a-f]{64}$`)),
      'x-cognipeer-event-id': 'deploy-42',
      'x-cognipeer-event': 'deploy.failed',
    });
  });

  it('stamps the current time and whole seconds by default', () => {
    const before = Math.floor(Date.now() / 1000);
    const t = Number(/^t=(\d+),/.exec(signRoutineWebhook(SECRET, BODY)['x-cognipeer-signature'])![1]);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(before + 2);
    expect(signRoutineWebhook(SECRET, BODY, { timestamp: NOW + 0.7 })['x-cognipeer-signature']).toMatch(new RegExp(`^t=${NOW},`));
  });
});
