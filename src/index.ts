/**
 * @cognipeer/console-sdk
 * 
 * Official TypeScript SDK for Cognipeer Console
 * 
 * @packageDocumentation
 */

// Main client
export { ConsoleClient } from './client';
export {
  RealtimeConnection,
  RealtimeResource,
  RealtimeModelsResource,
  RealtimeCallsResource,
  float32ToPcm16,
  pcm16ToFloat32,
} from './resources/realtime';
export type {
  RealtimeConnectOptions,
  RealtimeAuthMode,
  RealtimeAudioListener,
  RealtimeCallGetOptions,
  RealtimeCloseInfo,
  RealtimeCloseListener,
  RealtimeRespondResult,
  RealtimeUrlOptions,
  WebSocketLike,
  WebSocketConstructorLike,
} from './resources/realtime';

/** @deprecated Use `ConsoleClient` instead. */
export { ConsoleClient as CognipeerClient } from './client';

// Types
export * from './types';

/**
 * Guardrail verdict helper — the one correct enforcement test.
 * `decision === 'block' && enforced === false` does NOT block.
 */
export { shouldBlock } from './resources/guardrails';

// LangChain integrations
export {
  CognipeerLangChainChatModel,
  CognipeerTracingCallbackHandler,
  createCognipeerAgentTracing,
  createCognipeerTracingMiddleware,
} from './integrations/langchain';

// LangGraph integrations
export {
  CognipeerLangGraphTracer,
  createCognipeerLangGraphTracing,
  createTracedGraphInvoker,
  createTracedGraphStreamer,
} from './integrations/langgraph';

// OpenTelemetry integration
export {
  CognipeerOTelSpanExporter,
} from './integrations/opentelemetry';

export type {
  CognipeerOTelExporterOptions,
  ReadableSpan as OTelReadableSpan,
} from './integrations/opentelemetry';

// LangGraph types
export type {
  CognipeerLangGraphTracingOptions,
  CognipeerLangGraphTracingBinding,
  NodeExecutionContext,
  GraphExecutionContext,
} from './integrations/langgraph';
