/**
 * @cognipeer/console-sdk
 * 
 * Official TypeScript SDK for Cognipeer Console
 * 
 * @packageDocumentation
 */

// Main client
export { ConsoleClient } from './client';
export { RealtimeConnection, RealtimeResource, RealtimeModelsResource } from './resources/realtime';
export type { RealtimeConnectOptions, WebSocketLike, WebSocketConstructorLike } from './resources/realtime';

/** @deprecated Use `ConsoleClient` instead. */
export { ConsoleClient as CognipeerClient } from './client';

// Types
export * from './types';

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
