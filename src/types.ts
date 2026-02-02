/**
 * Common types used across the SDK
 */

// ============================================================================
// Configuration
// ============================================================================

export interface CGateClientOptions {
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

// ============================================================================
// Error Types
// ============================================================================

export class CGateError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'CGateError';
  }
}

export class CGateAPIError extends CGateError {
  constructor(
    message: string,
    statusCode: number,
    public errorType?: string,
    response?: unknown
  ) {
    super(message, statusCode, response);
    this.name = 'CGateAPIError';
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
  createdAt?: string;
  updatedAt?: string;
}

export interface ListPromptsQuery {
  search?: string;
}

export interface PromptRenderResponse {
  prompt: {
    key: string;
    name: string;
    description?: string;
  };
  rendered: string;
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
  agent?: TracingAgent;
  config?: Record<string, unknown>;
  summary?: TracingSummary;
  status?: TracingStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  errors?: TracingError[];
  events?: TracingEvent[];
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
