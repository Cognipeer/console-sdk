import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyAgentRunCallback } from './webhooks';

const SECRET = 'whsec_0123456789abcdef';
const BODY = JSON.stringify({ id: 'evt_1', event: 'agent_run.succeeded', runId: 'abc', data: { result: {} } });
const NOW = 1_800_000_000;

function sign(body: string, t: number, secret = SECRET): string {
  return createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
}

describe('verifyAgentRunCallback', () => {
  it('accepts a valid signature (string body)', () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW)}`;
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW })).toBe(true);
  });

  it('accepts a valid signature (byte body)', () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW)}`;
    expect(
      verifyAgentRunCallback({ rawBody: Buffer.from(BODY, 'utf8'), signatureHeader: header, secret: SECRET, nowSeconds: NOW }),
    ).toBe(true);
  });

  it('accepts when any one of several v1 entries matches', () => {
    const header = `t=${NOW},v1=${'0'.repeat(64)},v1=${sign(BODY, NOW)}`;
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW })).toBe(true);
  });

  it('rejects a tampered body', () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW)}`;
    expect(
      verifyAgentRunCallback({ rawBody: BODY.replace('succeeded', 'failed'), signatureHeader: header, secret: SECRET, nowSeconds: NOW }),
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW, 'another-secret-value')}`;
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW })).toBe(false);
  });

  it('rejects a timestamp outside the tolerance window (default 300s), both directions', () => {
    const old = NOW - 301;
    const future = NOW + 301;
    expect(
      verifyAgentRunCallback({ rawBody: BODY, signatureHeader: `t=${old},v1=${sign(BODY, old)}`, secret: SECRET, nowSeconds: NOW }),
    ).toBe(false);
    expect(
      verifyAgentRunCallback({ rawBody: BODY, signatureHeader: `t=${future},v1=${sign(BODY, future)}`, secret: SECRET, nowSeconds: NOW }),
    ).toBe(false);
  });

  it('honours a custom toleranceSeconds', () => {
    const t = NOW - 1000;
    const header = `t=${t},v1=${sign(BODY, t)}`;
    expect(
      verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW, toleranceSeconds: 1200 }),
    ).toBe(true);
  });

  it('rejects a signature that was computed for a different timestamp', () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW - 1)}`;
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW })).toBe(false);
  });

  it.each([
    [undefined],
    [null],
    [''],
    ['garbage'],
    [`v1=${'a'.repeat(64)}`],
    [`t=${NOW}`],
    [`t=abc,v1=${'a'.repeat(64)}`],
    [`t=${NOW},v1=zz`],
    [`t=${NOW},v1=abcd`],
  ])('rejects a malformed header %j without throwing', (header) => {
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW })).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW, '')}`;
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: header, secret: '', nowSeconds: NOW })).toBe(false);
  });

  it('uses the current clock when nowSeconds is omitted', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyAgentRunCallback({ rawBody: BODY, signatureHeader: `t=${t},v1=${sign(BODY, t)}`, secret: SECRET })).toBe(true);
  });
});
