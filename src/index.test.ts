import { describe, it, expect } from 'vitest';
import * as sdk from './index';

describe('package entry point (index.ts)', () => {
  it('exports the main client and its deprecated alias', () => {
    expect(sdk.ConsoleClient).toBeTypeOf('function');
    expect(sdk.CognipeerClient).toBe(sdk.ConsoleClient);
  });

  it('exports error classes', () => {
    expect(sdk.CognipeerError).toBeTypeOf('function');
    expect(sdk.CognipeerAPIError).toBeTypeOf('function');
  });

  it('exports the realtime connection helpers', () => {
    expect(sdk.RealtimeConnection).toBeTypeOf('function');
    expect(sdk.RealtimeResource).toBeTypeOf('function');
    expect(sdk.RealtimeModelsResource).toBeTypeOf('function');
  });

  it('exports the LangChain integration surface', () => {
    expect(sdk.CognipeerLangChainChatModel).toBeTypeOf('function');
    expect(sdk.CognipeerTracingCallbackHandler).toBeTypeOf('function');
    expect(sdk.createCognipeerAgentTracing).toBeTypeOf('function');
    expect(sdk.createCognipeerTracingMiddleware).toBeTypeOf('function');
  });

  it('exports the LangGraph integration surface', () => {
    expect(sdk.CognipeerLangGraphTracer).toBeTypeOf('function');
    expect(sdk.createCognipeerLangGraphTracing).toBeTypeOf('function');
    expect(sdk.createTracedGraphInvoker).toBeTypeOf('function');
    expect(sdk.createTracedGraphStreamer).toBeTypeOf('function');
  });

  it('exports the OpenTelemetry integration surface', () => {
    expect(sdk.CognipeerOTelSpanExporter).toBeTypeOf('function');
  });

  it('can construct a working client end-to-end from the public entry point', () => {
    const client = new sdk.ConsoleClient({ apiKey: 'sk-test' });
    expect(client.getBaseURL()).toBe('https://console.cognipeer.com');
    expect(client.chat).toBeTruthy();
  });
});
