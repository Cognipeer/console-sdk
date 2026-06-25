/**
 * Common types used across the SDK
 */

// ============================================================================
// Configuration
// ============================================================================

export interface ConsoleClientOptions {
  /** API token for authentication (required) */
  apiKey: string;
  /** Base URL for the API (optional, defaults to production) */
  baseURL?: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Custom fetch implementation (optional) */
  fetch?: typeof fetch;
}

/** @deprecated Use `ConsoleClientOptions` instead. */
export type CognipeerClientOptions = ConsoleClientOptions;

// ============================================================================
// Error Types
// ============================================================================

export class CognipeerError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'CognipeerError';
  }
}

export class CognipeerAPIError extends CognipeerError {
  constructor(
    message: string,
    statusCode: number,
    public errorType?: string,
    response?: unknown
  ) {
    super(message, statusCode, response);
    this.name = 'CognipeerAPIError';
  }
}

// ============================================================================
// Chat Types
// ============================================================================

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  /**
   * Chain-of-thought emitted by reasoning ("thinking") models, separate from
   * the final `content`. Present on assistant messages and streamed deltas when
   * the underlying model exposes it (OpenAI-compatible `reasoning_content`).
   */
  reasoning_content?: string;
  /** Structured reasoning payload (Responses / o-series style), when provided. */
  reasoning?: unknown;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  request_id?: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | Record<string, unknown>;
  /** Optional memory configuration for context-aware recall */
  memory?: {
    storeKey: string;
    topK?: number;
    scope?: MemoryScope;
    scopeId?: string;
    maxTokens?: number;
  };
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
  request_id?: string;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason?: string;
  }>;
}

// ============================================================================
// Embedding Types
// ============================================================================

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  user?: string;
  request_id?: string;
}

export interface Embedding {
  object: string;
  index: number;
  embedding: number[];
}

export interface EmbeddingResponse {
  object: string;
  data: Embedding[];
  model: string;
  usage: Usage;
  request_id?: string;
}

// ============================================================================
// Vector Types
// ============================================================================

export type VectorProviderStatus = 'active' | 'inactive' | 'error';
export type VectorMetric = 'cosine' | 'euclidean' | 'dotproduct';

export interface VectorProvider {
  _id: string;
  key: string;
  driver: string;
  label: string;
  description?: string;
  status: VectorProviderStatus;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVectorProviderRequest {
  key: string;
  driver: string;
  label: string;
  description?: string;
  status?: VectorProviderStatus;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown>;
  capabilitiesOverride?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface VectorIndex {
  _id: string;
  key: string;
  indexId: string;
  name: string;
  dimension: number;
  metric: VectorMetric;
  providerKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVectorIndexRequest {
  name: string;
  dimension: number;
  metric?: VectorMetric;
  metadata?: Record<string, unknown>;
}

export interface UpdateVectorIndexRequest {
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface Vector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface UpsertVectorsRequest {
  vectors: Vector[];
}

export interface QueryVectorsRequest {
  query: {
    vector: number[];
    topK?: number;
    filter?: Record<string, unknown>;
  };
}

export interface VectorMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, unknown>;
}

export interface QueryVectorsResponse {
  result: {
    matches: VectorMatch[];
  };
}

// ============================================================================
// File Types
// ============================================================================

export interface FileBucket {
  _id: string;
  key: string;
  name: string;
  description?: string;
  provider: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FileObject {
  _id: string;
  key: string;
  bucketKey: string;
  fileName: string;
  contentType: string;
  size: number;
  metadata?: Record<string, unknown>;
  markdownContent?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadFileRequest {
  fileName: string;
  contentType?: string;
  data: string;
  metadata?: Record<string, unknown>;
  convertToMarkdown?: boolean;
  keyHint?: string;
}

export interface ListFilesQuery {
  search?: string;
  limit?: number;
  cursor?: string;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface Prompt {
  id: string;
  key: string;
  name: string;
  description?: string;
  template: string;
  metadata?: Record<string, unknown>;
  currentVersion?: number;
  latestVersionId?: string;
  deployments?: Partial<Record<PromptEnvironment, PromptDeploymentState>>;
  deploymentHistory?: PromptDeploymentEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export type PromptEnvironment = 'dev' | 'staging' | 'prod';

export type PromptDeploymentAction = 'promote' | 'plan' | 'activate' | 'rollback';

export interface PromptDeploymentState {
  environment: PromptEnvironment;
  versionId: string;
  version: number;
  rolloutStatus: 'planned' | 'active';
  rolloutStrategy: 'manual';
  rollbackVersionId?: string;
  rollbackVersion?: number;
  note?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface PromptDeploymentEvent {
  id: string;
  environment: PromptEnvironment;
  action: PromptDeploymentAction;
  versionId: string;
  version: number;
  note?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface PromptComparison {
  fromVersion: PromptVersion;
  toVersion: PromptVersion;
  templateDiff: Array<{
    type: 'added' | 'removed' | 'unchanged';
    line: string;
  }>;
  metadataDiff: Array<{
    key: string;
    fromValue: unknown;
    toValue: unknown;
    changed: boolean;
  }>;
  deploymentHistory: PromptDeploymentEvent[];
  comments: Array<{
    id: string;
    content: string;
    version?: number;
    versionId?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt?: string;
  }>;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  name: string;
  description?: string;
  template?: string;
  isLatest: boolean;
  createdBy: string;
  createdAt?: string;
}

export interface ListPromptsQuery {
  search?: string;
}

export interface GetPromptOptions {
  version?: number;
  environment?: PromptEnvironment;
}

export interface RenderPromptOptions {
  version?: number;
  environment?: PromptEnvironment;
  data?: Record<string, unknown>;
}

export interface DeployPromptOptions {
  action: PromptDeploymentAction;
  environment: PromptEnvironment;
  versionId?: string;
  note?: string;
}

export interface PromptDeploymentsResponse {
  prompt: {
    id: string;
    key: string;
    name: string;
  };
  deployments: {
    deployments: Partial<Record<PromptEnvironment, PromptDeploymentState>>;
    history: PromptDeploymentEvent[];
  } | null;
}

export interface PromptCompareResponse {
  prompt: {
    id: string;
    key: string;
    name: string;
  };
  comparison: PromptComparison;
}

export interface PromptRenderResponse {
  prompt: {
    key: string;
    name: string;
    description?: string;
    version?: number;
  };
  rendered: string;
}

export interface PromptVersionsResponse {
  prompt: {
    key: string;
    name: string;
  };
  versions: PromptVersion[];
}

// ============================================================================
// Guardrail Types
// ============================================================================

export type GuardrailTarget = 'input' | 'output' | 'both';
export type GuardrailAction = 'block' | 'warn' | 'flag';
export type GuardrailFindingType = 'pii' | 'moderation' | 'prompt_shield' | 'custom';
export type GuardrailSeverity = 'low' | 'medium' | 'high';

export interface GuardrailEvaluateRequest {
  guardrail_key: string;
  text: string;
  target?: GuardrailTarget;
}

export interface GuardrailFinding {
  type: GuardrailFindingType;
  category: string;
  severity: GuardrailSeverity;
  message: string;
  action: GuardrailAction;
  block: boolean;
  value?: string;
}

export interface GuardrailEvaluateResponse {
  passed: boolean;
  guardrail_key: string;
  guardrail_name: string;
  action: GuardrailAction;
  findings: GuardrailFinding[];
  message: string | null;
}

// ============================================================================
// Agent Tool Types
// ============================================================================

export interface AgentToolDefinition {
  key: string;
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  toolsetKey?: string | null;
  executionType?: string;
}

export interface AgentToolAdapter {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  invoke: (args: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// Tool Types (Unified Tool System)
// ============================================================================

export interface ToolAction {
  key: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolDefinition {
  key: string;
  name: string;
  description?: string;
  type: 'openapi' | 'mcp';
  status: string;
  actions: ToolAction[];
  createdAt?: string;
}

export interface ToolExecutionResult {
  result: unknown;
  latencyMs: number;
  toolKey: string;
  actionKey: string;
}

export interface ToolActionAdapter {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  invoke: (args: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// Tracing Types
// ============================================================================

export interface TracingAgent {
  name?: string;
  version?: string;
  model?: string;
}

export interface TracingSummary {
  totalDurationMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCachedInputTokens?: number;
  totalBytesIn?: number;
  totalBytesOut?: number;
  eventCounts?: Record<string, number>;
}

export interface TracingActor {
  scope?: 'agent' | 'tool' | 'system';
  name?: string;
  role?: string;
}

export interface TracingToolDetails {
  name?: string;
  description?: string;
  inputSchema?: unknown;
  schema?: unknown;
  parameters?: unknown;
  approval?: Record<string, unknown>;
  cache?: Record<string, unknown>;
  retry?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  source?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TracingSection {
  kind?: 'message' | 'tool_call' | 'tool_result' | 'tool_response' | 'summary' | 'metadata' | 'data';
  label?: string;
  role?: string;
  content?: string;
  id?: string;
  tool?: string;
  toolName?: string;
  toolDetails?: TracingToolDetails;
  details?: TracingToolDetails;
  args?: Record<string, unknown>;
  arguments?: unknown;
  result?: unknown;
  output?: unknown;
  summary?: string;
  items?: Array<Record<string, unknown>>;
  execution?: Record<string, unknown>;
}

/**
 * Event types for tracing
 * - ai_call: LLM/model invocation
 * - tool_call: Tool/function execution
 * - chain_start: Chain/graph execution started
 * - chain_end: Chain/graph execution completed
 * - chain_error: Chain/graph execution error
 * - llm_start: LLM call started
 * - llm_end: LLM call completed
 * - llm_error: LLM call error
 * - tool_start: Tool call started
 * - tool_end: Tool call completed
 * - tool_error: Tool call error
 * - error: General error
 */
export type TracingEventType =
  | 'ai_call'
  | 'tool_call'
  | 'chain_start'
  | 'chain_end'
  | 'chain_error'
  | 'llm_start'
  | 'llm_end'
  | 'llm_error'
  | 'tool_start'
  | 'tool_end'
  | 'tool_error'
  | 'error'
  | string;

/**
 * Status for tracing events and sessions
 */
export type TracingStatus = 'success' | 'error' | 'running' | 'completed' | string;

export interface TracingEvent {
  sessionId?: string;
  id?: string;
  type?: TracingEventType;
  label?: string;
  sequence?: number;
  timestamp?: string;
  status?: TracingStatus;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  requestBytes?: number;
  responseBytes?: number;
  model?: string;
  actor?: TracingActor;
  sections?: TracingSection[];
  data?: {
    sections?: TracingSection[];
    toolDetails?: TracingToolDetails;
  };
  error?: string;
  metadata?: Record<string, unknown>;
  // OTel span correlation fields
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  // Legacy fields for backwards compatibility
  modelName?: string;
  toolName?: string;
  toolDetails?: TracingToolDetails;
  toolExecutionId?: string;
  usage?: Record<string, unknown>;
}

export interface TracingError {
  message: string;
  type?: string;
  timestamp?: string;
}

export interface TracingSessionRequest {
  sessionId: string;
  threadId?: string;
  agent?: TracingAgent;
  config?: Record<string, unknown>;
  summary?: TracingSummary;
  status?: TracingStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  errors?: TracingError[];
  events?: TracingEvent[];
  /** W3C trace ID (32 hex chars) linking this session to an OTel trace */
  traceId?: string;
  /** Root span ID for this session */
  rootSpanId?: string;
  /** Ingestion source: 'custom' (default) or 'otlp' */
  source?: 'custom' | 'otlp';
}

// ============================================================================
// Memory Types
// ============================================================================

/**
 * Scope of a memory item
 */
export type MemoryScope = 'user' | 'agent' | 'session' | 'global';

/**
 * Source that created a memory item
 */
export type MemorySource = 'chat' | 'api' | 'agent' | 'manual';

/**
 * Status of a memory store
 */
export type MemoryStoreStatus = 'active' | 'inactive' | 'error';

/**
 * Status of a memory item
 */
export type MemoryItemStatus = 'active' | 'archived' | 'expired';

/**
 * Memory store configuration
 */
export interface MemoryStoreConfig {
  deduplication?: boolean;
  autoEmbed?: boolean;
  defaultTopK?: number;
  defaultMinScore?: number;
  defaultScope?: MemoryScope;
  maxMemories?: number;
}

/**
 * A memory store definition
 */
export interface MemoryStore {
  _id?: string;
  key: string;
  name: string;
  description?: string;
  vectorProviderKey: string;
  vectorIndexKey?: string;
  embeddingModelKey: string;
  config?: MemoryStoreConfig;
  status: MemoryStoreStatus;
  memoryCount: number;
  createdAt?: string;
  lastActivityAt?: string;
}

/**
 * A single memory item
 */
export interface MemoryItem {
  _id?: string;
  storeKey: string;
  content: string;
  contentHash?: string;
  scope: MemoryScope;
  scopeId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: MemorySource;
  importance?: number;
  accessCount?: number;
  vectorId?: string;
  status?: MemoryItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Request to create a memory store
 */
export interface CreateMemoryStoreRequest {
  name: string;
  description?: string;
  vectorProviderKey: string;
  embeddingModelKey: string;
  config?: Partial<MemoryStoreConfig>;
}

/**
 * Request to update a memory store
 */
export interface UpdateMemoryStoreRequest {
  name?: string;
  description?: string;
  config?: Partial<MemoryStoreConfig>;
  status?: MemoryStoreStatus;
}

/**
 * Request to add a memory
 */
export interface AddMemoryRequest {
  content: string;
  scope?: MemoryScope;
  scopeId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: MemorySource;
  importance?: number;
}

/**
 * Request to update a memory item
 */
export interface UpdateMemoryRequest {
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  importance?: number;
  status?: MemoryItemStatus;
}

/**
 * Request to search memories semantically
 */
export interface MemorySearchRequest {
  query: string;
  topK?: number;
  scope?: MemoryScope;
  scopeId?: string;
  tags?: string[];
  minScore?: number;
}

/**
 * A single memory search match
 */
export interface MemorySearchMatch {
  id: string;
  content: string;
  score: number;
  scope: MemoryScope;
  scopeId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: MemorySource;
  importance?: number;
  createdAt?: string;
}

/**
 * Response from a memory search
 */
export interface MemorySearchResponse {
  memories: MemorySearchMatch[];
  query: string;
  storeKey: string;
}

/**
 * Request for chat-context-aware memory recall
 */
export interface MemoryRecallRequest {
  query: string;
  topK?: number;
  scope?: MemoryScope;
  scopeId?: string;
  maxTokens?: number;
}

/**
 * Response from memory recall
 */
export interface MemoryRecallResponse {
  context: string;
  memories: MemorySearchMatch[];
  storeKey: string;
}

/**
 * Batch add result
 */
export interface MemoryBatchResult {
  added: number;
  duplicates: number;
}

// ============================================================================
// RAG Types
// ============================================================================

export type RagChunkStrategy = 'recursive_character' | 'token';
export type RagDocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface RagChunkConfig {
  strategy: RagChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
  encoding?: string;
}

export interface RagModule {
  _id: string;
  key: string;
  name: string;
  description?: string;
  embeddingModelKey: string;
  vectorProviderKey: string;
  vectorIndexKey: string;
  fileBucketKey?: string;
  fileProviderKey?: string;
  chunkConfig: RagChunkConfig;
  status: string;
  totalDocuments?: number;
  totalChunks?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RagDocument {
  _id: string;
  ragModuleKey: string;
  fileKey?: string;
  fileName: string;
  status: RagDocumentStatus;
  chunkCount?: number;
  errorMessage?: string;
  lastIndexedAt?: string;
  createdAt?: string;
}

export interface RagIngestRequest {
  fileName: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** File upload ingest – send base64 / data-URL encoded file data */
export interface RagIngestFileRequest {
  fileName: string;
  /** Base64 or data-URL encoded file content */
  data: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface RagIngestResponse {
  document: RagDocument;
  chunkCount: number;
}

export interface RagQueryRequest {
  query: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

export interface RagQueryMatch {
  id: string;
  score: number;
  content?: string;
  fileName?: string;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface RagQueryResult {
  matches: RagQueryMatch[];
  query: string;
  topK: number;
  latencyMs: number;
}

export interface RagQueryResponse {
  result: RagQueryResult;
}

export interface RagDeleteDocumentResponse {
  success: boolean;
  deletedChunks?: number;
}

/** Optional body for re-ingest — omit entirely to re-process using existing chunks */
export interface RagReingestRequest {
  /** New text content to replace the document with */
  content?: string;
  /** Base64 or data-URL encoded file to replace the document with */
  data?: string;
  /** Alias of `data` for base64 payloads */
  base64?: string;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface RagReingestFileRequest {
  fileName: string;
  /** Base64 or data-URL encoded file content */
  data?: string;
  /** Alias of `data` for base64 payloads */
  base64?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface RagReingestResponse {
  document: RagDocument;
}

// ============================================================================
// Config Types
// ============================================================================

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';

export interface ConfigGroup {
  _id: string;
  key: string;
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigGroupWithItems extends ConfigGroup {
  items: ConfigItem[];
}

export interface ConfigItem {
  _id: string;
  groupId: string;
  key: string;
  name: string;
  description?: string;
  value: string;
  valueType: ConfigValueType;
  isSecret: boolean;
  tags?: string[];
  version: number;
  metadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConfigGroupRequest {
  name: string;
  key?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateConfigGroupRequest {
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateConfigItemRequest {
  name: string;
  key?: string;
  description?: string;
  value: string;
  valueType?: ConfigValueType;
  isSecret?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateConfigItemRequest {
  name?: string;
  description?: string;
  value?: string;
  valueType?: ConfigValueType;
  isSecret?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ConfigAuditLog {
  _id: string;
  configKey: string;
  action: string;
  previousValue?: string;
  newValue?: string;
  version?: number;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ResolveConfigRequest {
  keys: string[];
}

export interface ResolvedConfigValue {
  value: string;
  valueType: ConfigValueType;
  version: number;
}

export interface ResolvedConfigMap {
  [key: string]: ResolvedConfigValue;
}

export interface ListConfigGroupsQuery {
  tags?: string[];
  search?: string;
}

export interface ListConfigItemsQuery {
  groupId?: string;
  isSecret?: boolean;
  tags?: string[];
  search?: string;
}

// ============================================================================
// Response Wrappers
// ============================================================================

export interface ListResponse<T> {
  items: T[];
  count: number;
  nextCursor?: string | null;
}

export interface ApiResponse<T> {
  data?: T;
  success?: boolean;
  message?: string;
  error?: string | { message: string; type?: string };
}

// ────────────────────────────────────────────────────────────────────
// Agents
// ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'inactive' | 'draft';

export interface AgentConfig {
  modelKey: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface Agent {
  key: string;
  name: string;
  description?: string;
  config: AgentConfig;
  status: AgentStatus;
  /** Currently published version number (null = never published) */
  publishedVersion?: number | null;
  /** Total number of versions published */
  latestVersion?: number;
  createdAt?: string;
}

export interface ListAgentsQuery {
  status?: AgentStatus;
}

export interface AgentChatRequest {
  message: string;
  conversationId?: string;
}

export interface AgentChatResponse {
  content: string;
  conversationId: string;
  agentKey: string;
}

// ============================================================================
// Agent Responses API Types (OpenAI Responses API compatible)
// ============================================================================

/** Input item for the Responses API `input` field */
export interface ResponseInputItem {
  role: 'user' | 'system' | 'assistant';
  content: string | ResponseInputContent[];
}

/** Content part inside an input item */
export interface ResponseInputContent {
  type: 'input_text';
  text: string;
}

/** Request body for the Responses API */
export interface AgentResponseCreateRequest {
  /** Agent name or key — identifies which agent to invoke */
  model: string;
  /** User input: a plain string or array of message items */
  input: string | ResponseInputItem[];
  /** ID of the previous response to continue the conversation */
  previous_response_id?: string;
  /** System prompt override */
  instructions?: string;
  /** Request a specific published version of the agent */
  version?: number;
  /** Sampling temperature */
  temperature?: number;
  /** Top-p sampling */
  top_p?: number;
  /** Maximum output tokens */
  max_output_tokens?: number;
}

/** Text content within a response output message */
export interface ResponseOutputText {
  type: 'output_text';
  text: string;
}

/** A single output message in the response */
export interface ResponseOutputMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ResponseOutputText[];
}

/** Token usage information */
export interface ResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/** Full response returned by the Responses API */
export interface AgentResponse {
  /** Unique response ID (use as `previous_response_id` for follow-ups) */
  id: string;
  object: 'response';
  /** Agent name */
  model: string;
  /** Output messages from the agent */
  output: ResponseOutputMessage[];
  /** Completion status */
  status: 'completed' | 'failed';
  /** Token usage */
  usage: ResponseUsage;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Previous response ID if this is a follow-up */
  previous_response_id: string | null;
  /** Published version used for this response (null if not versioned) */
  version: number | null;
}

// ── Browser sessions, profiles & MCP ────────────────────────────────
export type BrowserSessionStatus = 'pending' | 'running' | 'idle' | 'closed' | 'expired' | 'errored';
export type BrowserStatus = 'active' | 'disabled';
export type BrowserSessionEventStatus = 'success' | 'error';
export type BrowserSessionEventType =
  | 'create'
  | 'goto'
  | 'click'
  | 'hover'
  | 'type'
  | 'press'
  | 'wait'
  | 'scroll'
  | 'extract'
  | 'snapshot'
  | 'screenshot'
  | 'pdf'
  | 'tool_call'
  | 'agent_event'
  | 'close'
  | 'error';
export type BrowserMcpToolName =
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_hover'
  | 'browser_type'
  | 'browser_press'
  | 'browser_wait'
  | 'browser_snapshot'
  | 'browser_extract'
  | 'browser_screenshot'
  | 'browser_close';

export interface BrowserAccessRules {
  allowList?: string[];
  blockList?: string[];
}

export interface BrowserSessionConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  maxLifetimeMs?: number;
  idleTimeoutMs?: number;
  access?: BrowserAccessRules;
}

export interface BrowserArtifactRef {
  bucketKey: string;
  fileId: string;
  objectKey: string;
  contentType?: string;
  url?: string;
}

export interface BrowserSessionLastScreenshot {
  bucketKey: string;
  fileId: string;
  objectKey: string;
  capturedAt?: string;
}

export interface BrowserSession {
  id: string;
  tenantId: string;
  projectId?: string;
  browserId: string;
  agentId?: string;
  agentKey?: string;
  sessionKey: string;
  name?: string;
  status: BrowserSessionStatus;
  currentUrl?: string;
  pageTitle?: string;
  artifactBucketKey?: string;
  config?: BrowserSessionConfig;
  metadata?: Record<string, unknown>;
  lastScreenshot?: BrowserSessionLastScreenshot;
  errorMessage?: string;
  startedAt?: string;
  lastActivityAt?: string;
  endedAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  eventCount?: number;
}

export interface BrowserSessionEvent {
  id: string;
  tenantId: string;
  projectId?: string;
  sessionId: string;
  sequence: number;
  type: BrowserSessionEventType;
  status?: BrowserSessionEventStatus;
  url?: string;
  selector?: string;
  ref?: string;
  durationMs?: number;
  artifact?: BrowserArtifactRef;
  data?: Record<string, unknown>;
  errorMessage?: string;
  createdAt?: string;
}

export interface BrowserActionGoto {
  type: 'goto';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}
export interface BrowserActionClick {
  type: 'click';
  ref?: string;
  selector?: string;
  button?: 'left' | 'right' | 'middle';
  timeout?: number;
}
export interface BrowserActionHover {
  type: 'hover';
  ref?: string;
  selector?: string;
  timeout?: number;
}
export interface BrowserActionType {
  type: 'type';
  ref?: string;
  selector?: string;
  text: string;
  delay?: number;
  clear?: boolean;
}
export interface BrowserActionPress {
  type: 'press';
  ref?: string;
  selector?: string;
  key: string;
}
export interface BrowserActionWait {
  type: 'wait';
  ms?: number;
  ref?: string;
  selector?: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}
export interface BrowserActionScroll {
  type: 'scroll';
  ref?: string;
  selector?: string;
  x?: number;
  y?: number;
}
export type BrowserAction =
  | BrowserActionGoto
  | BrowserActionClick
  | BrowserActionHover
  | BrowserActionType
  | BrowserActionPress
  | BrowserActionWait
  | BrowserActionScroll;

export interface BrowserActionResult {
  ok: boolean;
  url?: string;
  pageTitle?: string;
  ariaSnapshot?: string;
  artifact?: BrowserArtifactRef;
  errorMessage?: string;
}

export interface BrowserExtractInput {
  ref?: string;
  selector?: string;
  mode?: 'text' | 'html' | 'attr';
  attribute?: string;
  multiple?: boolean;
}

export interface BrowserExtractResult {
  ok: boolean;
  values: string[];
  errorMessage?: string;
}

export interface BrowserSnapshotResult {
  ariaSnapshot: string;
  url: string;
}

export interface BrowserArtifactResult {
  artifact: BrowserArtifactRef;
  eventId: string;
}

export interface BrowserScreenshotInput {
  fullPage?: boolean;
  ref?: string;
  selector?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
}

export interface BrowserPdfInput {
  format?: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
  landscape?: boolean;
  printBackground?: boolean;
}

export interface Browser {
  id: string;
  tenantId: string;
  projectId?: string;
  key: string;
  name: string;
  description?: string;
  status: BrowserStatus;
  artifactBucketKey?: string;
  defaultSessionConfig?: BrowserSessionConfig;
  defaultModelKey?: string;
  defaultRunOptions?: { maxSteps?: number; temperature?: number; runtimeProfile?: string };
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrowserCreateInput {
  key?: string;
  name: string;
  description?: string;
  status?: BrowserStatus;
  artifactBucketKey?: string;
  defaultSessionConfig?: BrowserSessionConfig;
  defaultModelKey?: string;
  defaultRunOptions?: { maxSteps?: number; temperature?: number; runtimeProfile?: string };
  metadata?: Record<string, unknown>;
}

export interface BrowserUpdateInput {
  name?: string;
  description?: string;
  status?: BrowserStatus;
  artifactBucketKey?: string;
  defaultSessionConfig?: BrowserSessionConfig;
  defaultModelKey?: string;
  defaultRunOptions?: { maxSteps?: number; temperature?: number; runtimeProfile?: string };
  metadata?: Record<string, unknown>;
}

export interface BrowserCreateSessionInput {
  browserId: string;
  name?: string;
  agentId?: string;
  agentKey?: string;
  artifactBucketKey?: string;
  config?: BrowserSessionConfig;
  metadata?: Record<string, unknown>;
}

export interface BrowserMcpInitializeResult {
  capabilities?: {
    tools?: {
      listChanged?: boolean;
    };
  };
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface BrowserMcpToolDescriptor {
  name: BrowserMcpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface BrowserMcpConnectionInfo {
  browserKey: string;
  sseUrl: string;
  messageUrlTemplate: string;
  authHeader: string;
}

// ============================================================================
// Audio + OCR Types
// ============================================================================

export type SttResponseFormat = 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
export type SttTimestampGranularity = 'word' | 'segment';

/** Common audio file payload (JSON body form). */
export interface AudioFileInput {
  /** Base64-encoded audio data (raw bytes, no data: prefix needed). */
  data: string;
  fileName?: string;
  contentType?: string;
}

/** Browser/runtime-agnostic representation of an audio file. */
export type AudioFileSource =
  | { kind: 'base64'; data: string; fileName?: string; contentType?: string }
  | { kind: 'blob'; blob: Blob; fileName?: string }
  | { kind: 'buffer'; data: Uint8Array | ArrayBuffer; fileName?: string; contentType?: string };

export interface AudioTranscriptionRequest {
  model: string;
  /** Base64 (string) or a structured file source for multipart upload. */
  audio: string | AudioFileInput | AudioFileSource;
  language?: string;
  prompt?: string;
  response_format?: SttResponseFormat;
  temperature?: number;
  timestamp_granularities?: SttTimestampGranularity[];
}

export interface AudioTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<Record<string, unknown>>;
  words?: Array<Record<string, unknown>>;
  request_id?: string;
  [key: string]: unknown;
}

export type AudioTranslationRequest = AudioTranscriptionRequest;
export type AudioTranslationResponse = AudioTranscriptionResponse;

export type TtsOutputFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

export interface AudioSpeechRequest {
  model: string;
  /** Text to synthesize (alias: text). */
  input: string;
  /** Optional — the TTS provider falls back to its default voice (e.g. alloy). */
  voice?: string;
  response_format?: TtsOutputFormat;
  speed?: number;
  instructions?: string;
}

export interface AudioSpeechResponse {
  /** Raw audio bytes. */
  audio: Uint8Array;
  contentType: string;
  requestId?: string;
}

export type OcrFeature =
  | 'text'
  | 'tables'
  | 'kv_pairs'
  | 'layout'
  | 'reading_order'
  | 'handwriting';

export type OcrDocumentInput =
  | { url: string; contentType?: string }
  | AudioFileInput;

export interface OcrExtractRequest {
  model: string;
  /** Either `{ url }` (remote document) or `{ data, fileName? }` (base64). */
  document: OcrDocumentInput;
  pages?: number[];
  language?: string;
  features?: OcrFeature[];
  prompt?: string;
}

export interface OcrPage {
  page: number;
  text?: string;
  blocks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OcrExtractResponse {
  text?: string;
  pages?: OcrPage[];
  language?: string;
  features?: Record<string, unknown>;
  request_id?: string;
  [key: string]: unknown;
}

// ============================================================================
// Automations Types (built-in scheduled jobs)
// ============================================================================

export type AutomationStatus = 'idle' | 'running' | 'paused' | 'errored';

export interface Automation {
  key: string;
  name: string;
  description?: string;
  schedule?: string;
  status: AutomationStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Crawler Types
// ============================================================================

export type CrawlerStatus = 'active' | 'paused' | 'archived' | string;
export type CrawlJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | string;

export interface CrawlerUrlEntry {
  url: string;
  addedAt?: string;
  addedBy?: string;
  lastCrawledAt?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface Crawler {
  _id: string;
  key: string;
  name: string;
  description?: string;
  status: CrawlerStatus;
  schedule?: string;
  seeds?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  totalUrls?: number;
  lastRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCrawlerRequest {
  key?: string;
  name: string;
  description?: string;
  status?: CrawlerStatus;
  schedule?: string;
  seeds?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateCrawlerRequest {
  name?: string;
  description?: string;
  status?: CrawlerStatus;
  schedule?: string;
  seeds?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RunCrawlerRequest {
  urls?: string[];
  seeds?: string[];
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CrawlOnContainerRequest {
  urls: string[];
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AdhocCrawlRequest {
  urls: string[];
  config?: Record<string, unknown>;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CrawlJob {
  _id: string;
  crawlerKey?: string;
  status: CrawlJobStatus;
  startedAt?: string;
  finishedAt?: string;
  urlCount?: number;
  resultCount?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface CrawlResult {
  _id: string;
  jobId: string;
  url: string;
  status?: string;
  contentType?: string;
  markdown?: string;
  html?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

export interface CrawlRunAcceptedResponse {
  jobId: string;
  crawlerKey?: string;
  status: CrawlJobStatus;
  urlCount?: number;
}

export interface ListCrawlersQuery {
  status?: string;
  search?: string;
}

export interface ListCrawlJobsQuery {
  crawlerKey?: string;
  status?: CrawlJobStatus;
  limit?: number;
}

export interface ListCrawlJobResultsQuery {
  limit?: number;
  skip?: number;
  type?: string;
}

// ============================================================================
// JS Sandbox Types
// ============================================================================

export type JsSandboxRuntimeStatus = 'active' | 'inactive' | 'errored' | string;

export interface JsSandboxRuntime {
  _id: string;
  key: string;
  name: string;
  description?: string;
  engine?: string;
  version?: string;
  status: JsSandboxRuntimeStatus;
  defaultTimeoutMs?: number;
  defaultMemoryMb?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface JsSandboxExecuteRequest {
  /** Runtime key or id to use. If omitted, the default runtime is used. */
  runtimeKey?: string;
  /** Source code to execute. */
  code: string;
  /** Variables made available to the sandbox as globals. */
  variables?: Record<string, unknown>;
  /** Override the runtime's default timeout. */
  timeoutMs?: number;
  /** Optional metadata for tracing. */
  metadata?: Record<string, unknown>;
}

export type JsSandboxExecutionStatus = 'success' | 'error' | 'timeout' | string;

export interface JsSandboxLogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | string;
  message: string;
  timestamp?: string;
  args?: unknown[];
}

export interface JsSandboxExecutionResult {
  executionId: string;
  runtimeKey: string;
  status: JsSandboxExecutionStatus;
  durationMs?: number;
  result?: unknown;
  logs?: JsSandboxLogEntry[];
  errorMessage?: string;
}

// ============================================================================
// Reranker Types
// ============================================================================

export interface RerankerDocumentInput {
  id?: string;
  content?: string;
  text?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface RerankerRunRequest {
  query: string;
  documents: Array<string | RerankerDocumentInput>;
  /** Cohere-compatible alias. */
  top_n?: number;
  /** Camel-case alias accepted by the server. */
  topN?: number;
}

export interface RerankerResultItem {
  index: number;
  relevance_score: number;
  document: { text: string };
}

export interface RerankerRunResponse {
  id: string;
  results: RerankerResultItem[];
  meta?: {
    api_version?: { version?: string };
    reranker?: string;
    strategy?: string;
    model?: string;
    latency_ms?: number;
  };
}

export interface Reranker {
  _id?: string;
  key: string;
  name: string;
  description?: string;
  strategy?: string;
  modelKey?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// MCP Types (generic + console)
// ============================================================================

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpInitializeResult {
  protocolVersion: string;
  serverInfo: McpServerInfo;
  capabilities?: {
    tools?: { listChanged?: boolean };
    [key: string]: unknown;
  };
}

export interface McpToolsListResult {
  tools: McpToolDescriptor[];
}

export interface McpExecuteRequest {
  tool: string;
  arguments?: Record<string, unknown>;
}

export interface McpExecuteResponse {
  result: unknown;
  metadata?: {
    latencyMs?: number;
    server?: string;
    tool?: string;
    [key: string]: unknown;
  };
}

export interface McpConsoleListToolsResponse {
  server: {
    key: string;
    name: string;
    version: string;
    builtin?: boolean;
  };
  tools: McpToolDescriptor[];
}

export interface McpConnectionInfo {
  serverKey: string;
  sseUrl: string;
  messageUrlTemplate: string;
  authHeader: string;
}

// ============================================================================
// Streaming Tracing Types
// ============================================================================

export interface TracingStreamStartRequest {
  threadId?: string;
  agent?: TracingAgent;
  config?: Record<string, unknown>;
  startedAt?: string;
  traceId?: string;
  rootSpanId?: string;
}

export interface TracingStreamStartResponse {
  success: boolean;
  sessionId: string;
  status: string;
}

export interface TracingStreamEventResponse {
  success: boolean;
  sessionId: string;
  eventId?: string;
  totalEvents: number;
}

export interface TracingStreamEndRequest {
  endedAt?: string;
  durationMs?: number;
  status?: TracingStatus;
  summary?: TracingSummary;
  errors?: TracingError[];
}

export interface TracingStreamEndResponse {
  success: boolean;
  sessionId: string;
  status: TracingStatus;
  durationMs?: number;
  totalEvents: number;
}

/** OTLP/HTTP JSON payload accepted by /client/v1/traces. */
export interface OtlpExportTraceServiceRequest {
  resourceSpans: Array<Record<string, unknown>>;
}

export interface OtlpIngestResponse {
  success: boolean;
  spansProcessed: number;
  sessionsIngested: number;
  eventsStored: number;
}

// ============================================================================
// File Providers (admin-level)
// ============================================================================

export type FileProviderStatus = 'active' | 'inactive' | 'error' | string;

export interface FileProvider {
  _id: string;
  key: string;
  driver: string;
  label: string;
  description?: string;
  status: FileProviderStatus;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  capabilities?: string[] | Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFileProviderRequest {
  key: string;
  driver: string;
  label: string;
  description?: string;
  status?: FileProviderStatus;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown>;
  capabilitiesOverride?: string[];
  metadata?: Record<string, unknown>;
}

export interface ListFileProvidersQuery {
  driver?: string;
  status?: FileProviderStatus;
}

// ============================================================================
// Batch API (OpenAI-compatible async bulk inference)
// ============================================================================

export type BatchEndpoint = '/v1/chat/completions' | '/v1/embeddings';

export type BatchStatus =
  | 'validating'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled';

export type BatchItemStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** One request line of a batch submission. */
export interface BatchRequestEntry {
  /** Caller correlation id, echoed back on the matching output line. */
  custom_id?: string;
  /** Chat-completion or embedding request payload (must include `model`). */
  body: Record<string, unknown>;
}

/** Reference to a JSONL object in a Document Store bucket. */
export interface BatchFileRef {
  bucket_key: string;
  object_key: string;
}

export interface CreateBatchRequest {
  endpoint: BatchEndpoint;
  /** Inline submission: request lines directly in the create call. */
  requests?: BatchRequestEntry[];
  /** File submission: a JSONL object uploaded via the Files API. */
  input_file?: BatchFileRef;
  /** When set, the output JSONL is written to this bucket on completion. */
  output_bucket_key?: string;
  /** Informational (OpenAI compat); defaults to "24h". */
  completion_window?: string;
  metadata?: Record<string, unknown>;
}

export interface BatchRequestCounts {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface BatchUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface Batch {
  id: string;
  object: 'batch';
  endpoint: BatchEndpoint;
  status: BatchStatus;
  completion_window: string | null;
  input_file: BatchFileRef | null;
  output_file: { bucket_key: string; object_key: string | null } | null;
  error_message: string | null;
  request_counts: BatchRequestCounts;
  usage: BatchUsage;
  metadata: Record<string, unknown>;
  created_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  cancelled_at: number | null;
}

export interface BatchItem {
  id: string;
  object: 'batch.item';
  index: number;
  custom_id: string | null;
  status: BatchItemStatus;
  response_status_code: number | null;
  response_body: Record<string, unknown> | null;
  error_message: string | null;
  usage: BatchUsage | null;
  started_at: number | null;
  ended_at: number | null;
}

/** One line of the OpenAI-format batch output JSONL. */
export interface BatchOutputLine {
  id: string;
  custom_id: string | null;
  response: { status_code: number; body: Record<string, unknown> | null } | null;
  error: { code: string; message: string | null } | null;
}

export interface ListBatchesQuery {
  status?: BatchStatus;
  limit?: number;
}

export interface ListBatchItemsQuery {
  status?: BatchItemStatus;
  limit?: number;
  skip?: number;
}

// ============================================================================
// Moderations API (OpenAI-compatible, backed by guardrails)
// ============================================================================

export interface CreateModerationRequest {
  /** Text (or array of texts / `{type:'text', text}` parts) to classify. */
  input: string | Array<string | { type: 'text'; text: string }>;
  /**
   * Guardrail key to evaluate with. Omit to use the tenant's first enabled
   * guardrail that has an active moderation policy.
   */
  model?: string;
}

export interface ModerationFinding {
  type: 'pii' | 'moderation' | 'prompt_shield' | 'custom';
  category: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  action: string;
  block: boolean;
  value?: string;
}

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
  /** Console extension: raw guardrail findings behind the category map. */
  findings: ModerationFinding[];
}

export interface ModerationResponse {
  id: string;
  /** Guardrail key the inputs were evaluated against. */
  model: string;
  results: ModerationResult[];
}

// ============================================================================
// Spend & Budgets
// ============================================================================

export interface SpendModelEntry {
  model_key: string;
  model_name: string | null;
  category: string | null;
  provider_key: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  currency: string;
}

export interface SpendTimeseriesPoint {
  period: string;
  calls: number;
  total_tokens: number;
  cost: number;
}

export interface SpendReport {
  object: 'spend.report';
  from: string | null;
  to: string | null;
  group_by: 'hour' | 'day' | 'month';
  currency: string;
  total_cost: number;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  by_model: SpendModelEntry[];
  timeseries: SpendTimeseriesPoint[];
}

export interface ListSpendReportQuery {
  /** ISO date — start of the reporting window. */
  from?: string;
  /** ISO date — end of the reporting window. */
  to?: string;
  group_by?: 'hour' | 'day' | 'month';
  /** Restrict to a single model key. */
  model?: string;
}

export type BudgetDomain =
  | 'global'
  | 'llm'
  | 'embedding'
  | 'vector'
  | 'file'
  | 'tracing'
  | 'stt'
  | 'tts'
  | 'ocr';

export interface Budget {
  id: string | null;
  object: 'budget';
  label: string | null;
  description: string | null;
  domain: BudgetDomain;
  scope: 'tenant' | 'user' | 'token' | 'resource' | 'provider';
  scope_id: string | null;
  project_id: string | null;
  daily_limit_usd: number | null;
  monthly_limit_usd: number | null;
  alert_thresholds: number[] | null;
  enabled: boolean;
  priority: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateBudgetRequest {
  /** Defaults to 'llm'. */
  domain?: BudgetDomain;
  /** Defaults to 'tenant'. */
  scope?: 'tenant' | 'user' | 'token' | 'resource' | 'provider';
  scope_id?: string;
  daily_limit_usd?: number;
  monthly_limit_usd?: number;
  /** e.g. [0.5, 0.8, 1.0] — fractions of the limit to alert at. */
  alert_thresholds?: number[];
  label?: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateBudgetRequest {
  daily_limit_usd?: number;
  monthly_limit_usd?: number;
  alert_thresholds?: number[];
  label?: string;
  description?: string;
  enabled?: boolean;
}

export interface BudgetWindowStatus {
  limit_usd: number | null;
  used_usd: number;
  remaining_usd: number | null;
}

export interface BudgetStatus {
  object: 'budget.status';
  domain: BudgetDomain;
  configured: boolean;
  per_day: BudgetWindowStatus;
  per_month: BudgetWindowStatus;
  alert_thresholds: number[] | null;
}

// ============================================================================
// Realtime API (WebSocket)
// ============================================================================

/**
 * Session config patch sent with `session.update`.
 *
 * The response generator (`model` / `agent_key`) is a session-start choice:
 * it can be set before the first response is created and locks afterwards —
 * the server rejects later changes with a `generator_locked` error.
 */
export interface RealtimeSessionUpdate {
  /** Chat model key responses are generated with. Locked after the first response. */
  model?: string;
  /** Agent key responses are generated with (takes precedence over `model`). Locked after the first response. */
  agent_key?: string;
  /** System prompt prepended to the conversation. */
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  /** STT model key used by `input_audio_buffer.commit`. */
  transcription_model?: string;
  /** MIME type of appended audio chunks (default audio/webm). */
  input_audio_format?: string;
  /** TTS model key; when set, responses are also synthesized to audio. */
  tts_model?: string;
  /** TTS voice id. Optional — the provider falls back to its default voice. */
  voice?: string;
  tts_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

/** Any event emitted by the realtime server. */
export interface RealtimeServerEvent {
  type:
    | 'session.created'
    | 'session.updated'
    | 'conversation.item.created'
    | 'input_audio_buffer.cleared'
    | 'input_audio_buffer.committed'
    | 'response.created'
    | 'response.output_text.delta'
    | 'response.output_text.done'
    | 'response.audio.delta'
    | 'response.audio.done'
    | 'response.done'
    | 'error'
    | string;
  event_id?: string;
  [key: string]: unknown;
}

// ============================================================================
// Realtime models (named session presets)
// ============================================================================

export interface RealtimeModel {
  id: string | null;
  object: 'realtime.model';
  /** Stable identifier clients connect with (`?model=<key>`). */
  key: string;
  name: string;
  description: string | null;
  status: 'active' | 'disabled';
  /** Chat model responses are generated with (null when an agent is set). */
  chat_model_key: string | null;
  /** Agent responses are generated with (takes precedence over the chat model). */
  agent_key: string | null;
  instructions: string | null;
  temperature: number | null;
  max_output_tokens: number | null;
  stt_model_key: string | null;
  input_audio_format: string | null;
  tts_model_key: string | null;
  voice: string | null;
  tts_format: string | null;
  turn_silence_ms: number | null;
  turn_silence_threshold: number | null;
  greeting: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateRealtimeModelRequest {
  /** Auto-slugged from `name` when omitted. */
  key?: string;
  name: string;
  description?: string;
  /** Chat model responses are generated with. Either this or `agent_key` is required. */
  chat_model_key?: string;
  /** Agent responses are generated with (takes precedence over `chat_model_key`). */
  agent_key?: string;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  /** STT model key — required for voice input / telephony. */
  stt_model_key?: string;
  input_audio_format?: string;
  /** TTS model key — required for spoken responses / telephony. */
  tts_model_key?: string;
  /** Optional — the TTS provider falls back to its default voice. */
  voice?: string;
  tts_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  /** Telephony turn detection: silence that ends a caller turn (ms). */
  turn_silence_ms?: number;
  /** Telephony turn detection: RMS silence threshold (0..1). */
  turn_silence_threshold?: number;
  /** Spoken when a telephony call connects. */
  greeting?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateRealtimeModelRequest = Partial<Omit<CreateRealtimeModelRequest, 'key'>> & {
  status?: 'active' | 'disabled';
};

// ============================================================================
// Agent Sandbox Types (remote runtime sandboxes)
// ============================================================================

export type SandboxStatus =
  | 'pending'
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'deleted'
  | string;

export interface SandboxCreateRequest {
  /** Template id or key. If omitted, the first available template is used. */
  template?: string;
  name?: string;
  /** Per-sandbox environment variables (override template env). */
  env?: Record<string, string>;
  runnerId?: string;
  volumeId?: string;
  /** Persist the sandbox so it survives stop/restart instead of being ephemeral. */
  persist?: boolean;
  /** Block all outbound network access from the sandbox container. */
  blockNetwork?: boolean;
  /** Override the template's resource limits. */
  resources?: { cpuCores?: number; memoryMb?: number; diskMb?: number; pids?: number };
}

export interface SandboxSummary {
  id: string;
  name?: string;
  status: SandboxStatus;
}

export interface SandboxSnapshotSummary {
  id: string;
  name?: string;
  status: string;
  kind: 'snapshot' | 'backup';
}

export interface SandboxSnapshotRequest {
  name?: string;
  export?: boolean;
}

export interface SandboxForkRequest {
  name?: string;
  persist?: boolean;
}

export interface SandboxRestoreRequest {
  name?: string;
  persist?: boolean;
  /** Override the snapshot's captured network policy. */
  blockNetwork?: boolean;
}

export interface SandboxExecRequest {
  command: string;
  cwd?: string;
  /** Extra environment variables for this command. */
  env?: Record<string, string>;
  timeoutSec?: number;
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export interface SandboxCodeRunRequest {
  code: string;
  language?: 'python' | 'javascript' | 'typescript' | 'bash';
  cwd?: string;
  timeoutSec?: number;
}

export interface SandboxFileEntry {
  name: string;
  isDir: boolean;
  size: number;
  modTime: string;
}

export interface SandboxFileInfo {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  mode: string;
  permissions: string;
  modTime: string;
}

export interface SandboxReadFileResult {
  content: string;
  encoding: 'utf8' | 'base64';
  size: number;
}

export interface SandboxFindMatch {
  file: string;
  line: number;
  content: string;
}

export interface SandboxReplaceResult {
  file: string;
  success: boolean;
  error?: string;
}

export interface SandboxGitStatus {
  branch: string | null;
  ahead: number;
  behind: number;
  files: Array<{ path: string; status: string }>;
}

export interface SandboxGitLogEntry {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface SandboxSessionCommandLogs {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running: boolean;
}
