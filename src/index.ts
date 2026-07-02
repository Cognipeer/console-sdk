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

// OpenTelemetry integration
export {
  CognipeerOTelSpanExporter,
} from './integrations/opentelemetry';

export type {
  CognipeerOTelExporterOptions,
  ReadableSpan as OTelReadableSpan,
} from './integrations/opentelemetry';

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

  // Audio + OCR
  AudioFileInput,
  AudioFileSource,
  AudioTranscriptionRequest,
  AudioTranscriptionResponse,
  AudioTranslationRequest,
  AudioTranslationResponse,
  AudioSpeechRequest,
  AudioSpeechResponse,
  SttResponseFormat,
  SttTimestampGranularity,
  TtsOutputFormat,
  OcrFeature,
  OcrDocumentInput,
  OcrExtractRequest,
  OcrExtractResponse,
  OcrPage,

  // Automations
  Automation,
  AutomationStatus,

  // Crawler
  Crawler,
  CrawlerStatus,
  CrawlerUrlEntry,
  CreateCrawlerRequest,
  UpdateCrawlerRequest,
  RunCrawlerRequest,
  CrawlOnContainerRequest,
  AdhocCrawlRequest,
  CrawlJob,
  CrawlJobStatus,
  CrawlResult,
  CrawlRunAcceptedResponse,
  ListCrawlersQuery,
  ListCrawlJobsQuery,
  ListCrawlJobResultsQuery,

  // JS Sandbox

  // Agent Sandbox (remote runtime sandboxes)
  SandboxStatus,
  SandboxCreateRequest,
  SandboxSummary,
  SandboxSnapshotSummary,
  SandboxSnapshotRequest,
  SandboxForkRequest,
  SandboxRestoreRequest,
  SandboxExecRequest,
  SandboxExecResult,
  SandboxCodeRunRequest,
  SandboxFileEntry,
  SandboxFileInfo,
  SandboxReadFileResult,
  SandboxFindMatch,
  SandboxReplaceResult,
  SandboxGitStatus,
  SandboxGitLogEntry,
  SandboxSessionCommandLogs,

  // Reranker
  Reranker,
  RerankerDocumentInput,
  RerankerRunRequest,
  RerankerRunResponse,
  RerankerResultItem,

  // MCP
  McpServerInfo,
  McpInitializeResult,
  McpToolDescriptor,
  McpToolsListResult,
  McpExecuteRequest,
  McpExecuteResponse,
  McpConsoleListToolsResponse,
  McpConnectionInfo,

  // Tracing streaming + OTLP
  TracingStreamStartRequest,
  TracingStreamStartResponse,
  TracingStreamEventResponse,
  TracingStreamEndRequest,
  TracingStreamEndResponse,
  OtlpExportTraceServiceRequest,
  OtlpIngestResponse,

  // File providers
  FileProvider,
  FileProviderStatus,
  CreateFileProviderRequest,
  ListFileProvidersQuery,

  // Batch API
  Batch,
  BatchEndpoint,
  BatchStatus,
  BatchItem,
  BatchItemStatus,
  BatchRequestEntry,
  BatchFileRef,
  BatchRequestCounts,
  BatchUsage,
  BatchOutputLine,
  CreateBatchRequest,
  ListBatchesQuery,
  ListBatchItemsQuery,

  // Moderations
  CreateModerationRequest,
  ModerationResponse,
  ModerationResult,
  ModerationFinding,

  // Spend & Budgets
  SpendReport,
  SpendModelEntry,
  SpendTimeseriesPoint,
  ListSpendReportQuery,
  Budget,
  BudgetDomain,
  BudgetStatus,
  BudgetWindowStatus,
  CreateBudgetRequest,
  UpdateBudgetRequest,

  // Realtime
  RealtimeSessionUpdate,
  RealtimeServerEvent,
  RealtimeModel,
  CreateRealtimeModelRequest,
  UpdateRealtimeModelRequest,
} from './types';

// LangGraph types
export type {
  CognipeerLangGraphTracingOptions,
  CognipeerLangGraphTracingBinding,
  NodeExecutionContext,
  GraphExecutionContext,
} from './integrations/langgraph';
