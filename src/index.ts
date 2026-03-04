/**
 * @cognipeer/console-sdk
 * 
 * Official TypeScript SDK for CognipeerAI Gateway
 * 
 * @packageDocumentation
 */

// Main client
export { ConsoleClient } from './client';

/** @deprecated Use `ConsoleClient` instead. */
export { ConsoleClient as CognipeerClient } from './client';

// Types
export * from './types';

// Errors
export { CognipeerError, CognipeerAPIError } from './types';

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

// Re-export for convenience
export type {
  // Configuration
  ConsoleClientOptions,
  
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
  DeployPromptOptions,
  PromptCompareResponse,
  PromptComparison,
  PromptDeploymentsResponse,
  PromptDeploymentAction,
  PromptDeploymentEvent,
  PromptDeploymentState,
  PromptEnvironment,
  Prompt,
  PromptVersion,
  ListPromptsQuery,
  GetPromptOptions,
  RenderPromptOptions,
  PromptRenderResponse,
  PromptVersionsResponse,

  // Guardrails
  GuardrailTarget,
  GuardrailAction,
  GuardrailFindingType,
  GuardrailSeverity,
  GuardrailEvaluateRequest,
  GuardrailEvaluateResponse,
  GuardrailFinding,
  
  // Tracing
  TracingSessionRequest,
  TracingAgent,
  TracingSummary,
  TracingEvent,

  // Memory
  MemoryScope,
  MemorySource,
  MemoryStoreStatus,
  MemoryItemStatus,
  MemoryStoreConfig,
  MemoryStore,
  MemoryItem,
  CreateMemoryStoreRequest,
  UpdateMemoryStoreRequest,
  AddMemoryRequest,
  UpdateMemoryRequest,
  MemorySearchRequest,
  MemorySearchMatch,
  MemorySearchResponse,
  MemoryRecallRequest,
  MemoryRecallResponse,
  MemoryBatchResult,

  // Tools
  AgentToolDefinition,
  AgentToolAdapter,
  ToolDefinition,
  ToolAction,
  ToolExecutionResult,
  ToolActionAdapter,

  // RAG
  RagModule,
  RagDocument,
  RagChunkConfig,
  RagChunkStrategy,
  RagDocumentStatus,
  RagIngestRequest,
  RagIngestFileRequest,
  RagIngestResponse,
  RagQueryRequest,
  RagQueryResponse,
  RagQueryMatch,
  RagQueryResult,
  RagDeleteDocumentResponse,
  
  // Config
  ConfigValueType,
  ConfigGroup,
  ConfigGroupWithItems,
  ConfigItem,
  ConfigAuditLog,
  CreateConfigGroupRequest,
  UpdateConfigGroupRequest,
  CreateConfigItemRequest,
  UpdateConfigItemRequest,
  ResolveConfigRequest,
  ResolvedConfigValue,
  ResolvedConfigMap,
  ListConfigGroupsQuery,
  ListConfigItemsQuery,

  // Common
  Usage,

  // Agents
  Agent,
  AgentConfig,
  AgentStatus,
  AgentChatRequest,
  AgentChatResponse,
  ListAgentsQuery,

  // Agent Responses API
  AgentResponseCreateRequest,
  AgentResponse,
  ResponseInputItem,
  ResponseInputContent,
  ResponseOutputText,
  ResponseOutputMessage,
  ResponseUsage,
} from './types';

// LangGraph types
export type {
  CognipeerLangGraphTracingOptions,
  CognipeerLangGraphTracingBinding,
  NodeExecutionContext,
  GraphExecutionContext,
} from './integrations/langgraph';
