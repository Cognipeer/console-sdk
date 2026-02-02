/**
 * @cognipeer/cgate-sdk
 * 
 * Official TypeScript SDK for CognipeerAI Gateway
 * 
 * @packageDocumentation
 */

// Main client
export { CGateClient } from './client';

// Types
export * from './types';

// Errors
export { CGateError, CGateAPIError } from './types';

// LangChain integrations
export {
  CGateLangChainChatModel,
  CGateTracingCallbackHandler,
  createCGateAgentTracing,
  createCGateTracingMiddleware,
} from './integrations/langchain';

// LangGraph integrations
export {
  CGateLangGraphTracer,
  createCGateLangGraphTracing,
  createTracedGraphInvoker,
  createTracedGraphStreamer,
} from './integrations/langgraph';

// Re-export for convenience
export type {
  // Configuration
  CGateClientOptions,
  
  // Chat
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  Tool,
  ToolCall,
  
  // Embeddings
  EmbeddingRequest,
  EmbeddingResponse,
  Embedding,
  
  // Vectors
  VectorProvider,
  CreateVectorProviderRequest,
  VectorIndex,
  CreateVectorIndexRequest,
  UpdateVectorIndexRequest,
  Vector,
  UpsertVectorsRequest,
  QueryVectorsRequest,
  QueryVectorsResponse,
  VectorMatch,
  
  // Files
  FileBucket,
  FileObject,
  UploadFileRequest,
  ListFilesQuery,

  // Prompts
  Prompt,
  ListPromptsQuery,
  PromptRenderResponse,
  
  // Tracing
  TracingSessionRequest,
  TracingAgent,
  TracingSummary,
  TracingEvent,

  // Tools
  AgentToolDefinition,
  AgentToolAdapter,
  
  // Common
  Usage,
} from './types';

// LangGraph types
export type {
  CGateLangGraphTracingOptions,
  CGateLangGraphTracingBinding,
  NodeExecutionContext,
  GraphExecutionContext,
} from './integrations/langgraph';
