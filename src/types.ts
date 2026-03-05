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

export interface TracingSection {
  kind?: 'message' | 'tool_call' | 'tool_result' | 'data';
  label?: string;
  role?: string;
  content?: string;
  id?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
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
export type MemorySource = 'user_input' | 'agent_output' | 'system' | 'api' | 'extraction';

/**
 * Status of a memory store
 */
export type MemoryStoreStatus = 'active' | 'inactive' | 'error';

/**
 * Status of a memory item
 */
export type MemoryItemStatus = 'active' | 'archived' | 'deleted';

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
  skipped: number;
  errors: Array<{ index: number; error: string }>;
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
