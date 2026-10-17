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
    response?: unknown,
    /** Parsed `Retry-After` response header, in milliseconds, when present. */
    public retryAfterMs?: number,
    /**
     * Machine-readable code from the response body, when the server sends one:
     * `error.code` (e.g. `agent_run_conflict`, `agent_run_concurrency_limit`) or,
     * when `error` is just the message string, the top-level `code`
     * (`{ error: 'Webhook not found', code: 'not_found' }`).
     * More specific than `errorType`: several codes can share one type
     * (`agent_run_concurrency_limit` is a `rate_limit_error`).
     */
    public errorCode?: string
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

/** Reasoning effort accepted by the reasoning knobs of chat and agent calls. */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * `response_format` of a chat completion or an agent run (OpenAI shape).
 * `json_schema` constrains the answer to the schema; `json_object` to any JSON object.
 */
export type ChatResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: { name: string; schema: Record<string, unknown>; description?: string; strict?: boolean };
    };

/** `service_tier` of a chat, responses or run request. `flex` runs the call as a low-priority `deferred` run (agents). */
export type ServiceTier = 'auto' | 'default' | 'flex' | (string & {});

/** Request `metadata`: up to 16 string pairs (key up to 64 chars of `[A-Za-z0-9_.-]`, value up to 512 chars). */
export type RequestMetadata = Record<string, string>;

export interface ChatCompletionRequest {
  model: string;
  /**
   * When `model` names an agent that offers several models: which one answers
   * (its main model or one listed in `Agent.models`). Not offered: `400 model_not_allowed`.
   */
  agent_model?: string;
  /** Reasoning effort. Model Hub / agent picks win over it; an invalid value is `400 invalid_reasoning`. */
  reasoning_effort?: ReasoningEffort;
  /**
   * Same as `reasoning_effort` in the Responses shape; the object wins when both are sent.
   * For an agent it applies when the run executes inside the request; a queued run
   * (`service_tier: 'flex'`) uses the agent's own effort.
   */
  reasoning?: { effort?: ReasoningEffort };
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  /** Opaque end-user id. For an agent it also takes part in the transcript match that continues a session: two end users with the same transcript start separate sessions. */
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
  /** Constrain the answer (models and agents). An agent returns the JSON as a string in `message.content`. */
  response_format?: ChatResponseFormat;
  /** `{ include_usage: true }` adds a final chunk with `usage` to a stream. */
  stream_options?: { include_usage?: boolean };
  /** `flex` runs an agent call as a low-priority deferred run. */
  service_tier?: ServiceTier;
  /** Stored on the agent run (agents) / echoed (models). */
  metadata?: RequestMetadata;
  /** Agent targets: values for the agent's declared inputs (`Agent.input_schema`). */
  inputs?: Record<string, unknown>;
  /** Agent targets: continue this agent session (also `X-Cognipeer-Session-Id`). */
  conversation_id?: string;
  /**
   * Agent targets: the agent version to run. A positive integer (a numeric string is accepted too)
   * pins a published version, `'draft'` runs the draft; omitted = the published version. Anything else
   * is `400 invalid_version`, a version that does not exist `404 version_not_found`.
   */
  version?: AgentRunVersion;
}

/** Per-call options of `chat.completions.create()`. */
export interface ChatCompletionOptions {
  /** Agent targets: continue this session (sent as `X-Cognipeer-Session-Id`). */
  sessionId?: string;
  /** Sent as the `Idempotency-Key` header. */
  idempotencyKey?: string;
  signal?: AbortSignal;
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

/** A file the agent produced this turn, as an agent's chat completion reports it (`output_files`). */
export interface ChatOutputFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  /** Path of the file's content under the API root. */
  download_url: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
  request_id?: string;
  /** Agent targets: the session this turn belongs to (pass it back as `conversation_id` or `X-Cognipeer-Session-Id`). */
  conversation_id?: string;
  /** Agent targets: files the agent produced this turn (also `file_path` annotations on the message). */
  output_files?: ChatOutputFile[];
  /** Agent targets: why the run ended without a final answer (`limit`, `cancelled`, ...); absent for a normal answer. */
  stop_reason?: string;
  /** Agent targets: the runtime's own wording for `stop_reason`, e.g. which limit. */
  stop_detail?: string;
  /**
   * Agent targets. `agent_model` is set when the call picked one of the agent's models.
   * A call that outlives the wait window answers `202` with `choices: []`, no `usage`, and
   * `status` (`queued` | `in_progress`), `run_id` and `session_id`: follow it with
   * `client.agents.runs.wait(run_id)`.
   */
  cognipeer?: { agent_model?: string; status?: 'queued' | 'in_progress'; run_id?: string; session_id?: string };
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
  /** Final chunk when `stream_options.include_usage` is set (its `choices` is empty). */
  usage?: Usage | null;
  /** Agent targets: the session (first and last chunk). */
  conversation_id?: string;
  /** Agent targets, closing chunk: files the agent produced this turn. */
  files?: ChatOutputFile[];
  /** Agent targets, closing chunk: `agent_model`, when the call picked one of the agent's models. */
  cognipeer?: { agent_model?: string };
}

// ============================================================================
// Models (`GET /api/client/v1/models`)
// ============================================================================

/** A model of the project as `models.list()` shows it (OpenAI discovery shape plus capabilities). */
export interface ModelListModelEntry {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  name?: string;
  context_length?: number;
  max_output_tokens?: number;
  category?: string;
  supports_image_input?: boolean;
  supports_reasoning?: boolean;
  supports_structured_outputs?: boolean;
  supports_tool_calls?: boolean;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  cognipeer?: {
    /** Absent on models (an agent's entry says `agent`). */
    kind?: undefined;
    schema_version?: string | number;
    canonical_model_id?: string | null;
    capabilities?: Record<string, unknown>;
  };
}

/**
 * An active agent of the project, listed beside the models. Use `id` (`agent:<key>`)
 * as `model` in `chat.completions.create()` and `responses.create()`.
 */
export interface ModelListAgentEntry {
  id: `agent:${string}`;
  object: 'model';
  created: number;
  owned_by: 'cognipeer-agent';
  /** The agent's name. */
  name: string;
  /** The agent's description ('' when it has none). */
  description: string;
  cognipeer: { kind: 'agent'; key: string };
}

export type ModelListEntry = ModelListModelEntry | ModelListAgentEntry;

/** True for the agent entries of a model list. */
export function isAgentModelEntry(entry: ModelListEntry): entry is ModelListAgentEntry {
  return entry.cognipeer?.kind === 'agent';
}

/** Query of `models.list()`. */
export interface ListModelsQuery {
  category?: string;
  providerKey?: string;
  providerDriver?: string;
  includeProviders?: boolean;
}

/**
 * `GET /api/client/v1/models`: the OpenAI discovery list (`data`, models and agents) and the full registry rows (`models`).
 * The route admits a token that holds the `models` OR the `agents` service (read) and shows each its own part: a token
 * with `agents` read only gets the agent entries in `data`, `models: []` and no `providers`; a token with `models` read
 * only gets no agents; a token with neither is rejected (`403`).
 */
export interface ModelList {
  object: 'list';
  /** The project's LLM models (for a token that may read models), then (for a token that may read agents, unless `category` is not `llm` or a provider filter is set) its active agents. */
  data: ModelListEntry[];
  /** The project's model registry rows (secrets masked); agents are not in it. Empty for a token that can only read agents. */
  models: Array<Record<string, unknown>>;
  /** Present with `includeProviders`, for a token that may read models. */
  providers?: Array<Record<string, unknown>>;
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
  /**
   * Set on a file uploaded to an agent session (stored in the bucket the agent's
   * `attachments.bucketKey` names); absent on every other file. Manage those through
   * `client.agents.sessions.files`.
   */
  purpose?: 'conversation';
  /** The session the file belongs to (`purpose: 'conversation'`). */
  conversationId?: string;
  /** The agent that session belongs to (`purpose: 'conversation'`). */
  agentKey?: string;
  /** When the Console deletes the file (session files only; null = kept). ISO timestamp. */
  expiresAt?: string | null;
  /** Who uploaded it (session files). */
  uploadedBy?: string;
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
  /**
   * List one folder of the bucket: a path such as `agent-sessions/support-bot/` (a
   * trailing `/` is added when missing; `''` is the bucket root). The answer then
   * carries the folder's files and its sub-folders in `folders`. With `search`, every
   * match under the prefix, however deep.
   */
  prefix?: string;
  /** `conversation`: only files attached to agent sessions; `other`: only the rest. */
  purpose?: 'conversation' | 'other';
}

/** `client.files.list()` answer. */
export interface ListFilesResponse {
  files: FileObject[];
  count: number;
  nextCursor?: string | null;
  /** Sub-folders of `prefix` (full paths ending in `/`); only when `prefix` was given. */
  folders?: string[];
  /** The folder listed, normalised; only when `prefix` was given. */
  prefix?: string;
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
export type GuardrailAction = 'block' | 'warn' | 'flag' | 'redact';
export type GuardrailFindingType = 'pii' | 'word_filter' | 'moderation' | 'prompt_shield' | 'custom';
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
  /**
   * "No BLOCKING finding was produced" — **not** "the request was not blocked".
   *
   * The two diverge in monitor mode: a monitoring guardrail still reports
   * `passed: false` for a blocking finding while `verdict.enforced` is false and
   * nothing was actually stopped. To decide whether to refuse the call, use
   * {@link shouldBlock}(response.verdict), never `!passed`.
   */
  passed: boolean;
  guardrail_key: string;
  guardrail_name: string;
  action: GuardrailAction;
  findings: GuardrailFinding[];
  message: string | null;
  /** True when the guardrail is disabled — no policies ran and `passed` is vacuous. */
  disabled?: boolean;
  /** Text with redact-action findings masked; present when redaction applied. */
  redacted_text?: string | null;
  /**
   * The full hook verdict behind this legacy result — spans, mutations, risk
   * score, response codes and the dry-run `wouldBeDecision`. Null when no
   * guardrail ran.
   *
   * Every key above keeps its exact pre-hook-plane meaning; this one is
   * additive, and it is the field to branch enforcement on
   * ({@link shouldBlock}).
   */
  verdict?: HookVerdict | null;
}

// ============================================================================
// Guardrail Hook Plane (contract v2)
// ============================================================================
/**
 * The five hook points a guardrail can run on, the verdict they answer with,
 * and the persisted configuration `create`/`update` carry.
 *
 * Mirrors the Console's own contract; `contractVersion` is bumped only on a
 * breaking change to the call/verdict shape.
 */

/** Bumped only on a breaking change to the hook call/verdict shape. */
export type GuardrailContractVersion = 2;

/**
 * The six hook points, in PIPELINE order. A string union rather than an enum,
 * so a seventh is additive and invalidates nothing stored.
 *
 * Direction is carried by the hook id itself — a guardrail's `target` column is
 * not consulted when it runs.
 *
 * `prompt.pre` fires ONCE per run on what the person actually typed;
 * `input.pre` fires again before every model call, so after a tool round trip
 * the newest message there is a tool result rather than anything a human wrote.
 * Nothing inside the Console emits `prompt.pre` — it exists for exactly this
 * kind of remote enforcement point, which is why it belongs in this union.
 */
export type HookId =
  | 'prompt.pre'
  | 'input.pre'
  | 'output.pre'
  | 'output.stream.delta'
  | 'tool.pre'
  | 'tool.post';

/**
 * Enforcement posture. `monitor` evaluates and logs but neutralises the
 * decision to `'allow'` before anyone acts on it.
 */
export type GuardrailMode = 'enforce' | 'monitor' | 'disabled';

/**
 * The action ladder, strictly ordered:
 * `allow < flag < warn < redact < block`. Merging several verdicts is max(),
 * which is why the order is total and guardrails may merge in any order.
 */
export type SafetyAction = 'allow' | GuardrailAction;

/** The nine policy families a hook can run. */
export type GuardrailPolicyFamily =
  | 'pii'
  | 'secrets'
  | 'word_filter'
  | 'regex'
  | 'moderation'
  | 'prompt_shield'
  | 'custom'
  | 'tool_access'
  | 'webhook';

/**
 * Timing × failure handling as ONE field, so `{ timing: 'async', onFail:
 * 'block' }` is unrepresentable: an async policy has by definition already let
 * the flow continue, so it cannot block.
 */
export type GuardrailHookSchedule =
  | { timing: 'sync'; onFail: 'block' | 'log' }
  | { timing: 'async'; onFail: 'log' };

/** One scannable string, addressed by an RFC-6901 JSON Pointer into the
 *  subject (`/text`, `/args/url`, `/result/0/body`). */
export interface SubjectSegment {
  path: string;
  text: string;
  role?: 'system' | 'user' | 'assistant' | 'tool' | string;
}

interface HookSubjectCommon {
  /** The segments joined by '\n', in segment order. */
  text: string;
  segments: SubjectSegment[];
}

/** What a hook was evaluated against, returned on the verdict only when a
 *  mutation actually rewrote it. */
export type HookSubject =
  | (HookSubjectCommon & { kind: 'text' })
  | (HookSubjectCommon & {
      kind: 'tool_call';
      /** Canonical policy name (`${serverKey}/${tool}`, `sandbox.fs.read`). */
      toolName: string;
      /** The name the model used, before MCP rename resolution. */
      requestedName?: string;
      args: Record<string, unknown>;
      /** `mcp:<serverKey>` | `sandbox:<instanceId>` | `agent:<agentKey>`. */
      providerRef: string;
      sandboxAvailable?: boolean;
    })
  | (HookSubjectCommon & {
      kind: 'tool_result';
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
      providerRef: string;
    })
  | (HookSubjectCommon & {
      kind: 'stream_delta';
      /** This window's newly-arrived text; policies read `text`. */
      delta: string;
      /** The full accumulated channel text. Spans are ABSOLUTE into this. */
      buffer: string;
      /** Absolute offset already written to the client. */
      releasedTo: number;
      seq: number;
      final: boolean;
    });

/**
 * A finding, purely additive over {@link GuardrailFinding} — `type`,
 * `category`, `severity`, `message`, `action`, `block` and `value` keep their
 * exact names and meanings, so a `SafetyFinding[]` is a `GuardrailFinding[]`.
 */
export interface SafetyFinding extends GuardrailFinding {
  family: GuardrailPolicyFamily;
  hook: HookId;
  /** The policy id that produced it. */
  policyId: string;
  /** Machine code, e.g. `'tool_not_allowed'`, `'secret_detected'`,
   *  `'evaluation_error'`. Append-only. */
  code?: string;
  /** Criticality, folded out of `severity` (which stays three-valued). A
   *  critical finding forces decision `'block'` regardless of its `action`. */
  critical?: boolean;
  /** Pointer into the subject. Present when the detector knows where. */
  path?: string;
  /** Absolute offsets INSIDE the string at `path`. Present only for
   *  span-capable families (`pii`, `secrets`, `regex`). */
  span?: { start: number; end: number };
  confidence?: number;
}

/**
 * A rewrite the verdict asks you to apply. When `HookVerdict.subject` /
 * `.text` is present the Console already applied these to the copy it returned
 * — send THAT onwards rather than replaying the ops yourself.
 */
export type Mutation =
  /** The primary redaction op. Absolute offsets into the string at `path`. */
  | {
      op: 'replace_span';
      path: string;
      start: number;
      end: number;
      replacement: string;
      family: GuardrailPolicyFamily;
      policyId: string;
      category?: string;
    }
  /** For span-less detectors. Replaces every occurrence of `value` WITHIN THE
   *  SEGMENT AT `path` — never across the whole document. */
  | {
      op: 'replace_value';
      path: string;
      value: string;
      replacement: string;
      family: GuardrailPolicyFamily;
      policyId: string;
      category?: string;
    }
  /** Delete the property at `path` (a tool argument, a result field). */
  | { op: 'remove'; path: string; family: GuardrailPolicyFamily; policyId: string };

/** Coarse reason shown to an end user — never the matched value. */
export type GuardrailBlockReasonClass =
  | 'pii'
  | 'secrets'
  | 'profanity'
  | 'moderation'
  | 'injection'
  | 'tool_denied'
  | 'custom'
  | 'unavailable';

/**
 * The rendered end-user message for a block. **An object, not a string** — the
 * human-readable text is `body`.
 *
 * `mode` says how to deliver it:
 * - `'error'` — REJECT the call and surface `body` as the error message, with
 *   HTTP `status`.
 * - `'replace'` — do NOT reject: SUBSTITUTE `body` for the model's response and
 *   answer normally (a chat UI renders it as the assistant turn). Returning an
 *   error here would show a failure where the policy asked for a polite
 *   refusal.
 */
export interface RenderedBlockMessage {
  reasonClass: GuardrailBlockReasonClass;
  body: string;
  mode: 'error' | 'replace';
  /** 400 unless the guardrail opted into the verdict status codes (then 446). */
  status: number;
  traceId: string;
}

/**
 * The result of running one hook.
 *
 * READ `decision` AND `enforced` TOGETHER. `decision` is the EFFECTIVE
 * decision, already neutralised to `'allow'` in monitor mode, and `enforced`
 * says whether it was applied at all:
 *
 * ```ts
 * if (shouldBlock(verdict)) refuse(verdict.message?.body);
 * ```
 *
 * Do not re-derive that rule per call site — {@link shouldBlock} encodes it
 * once.
 */
export interface HookVerdict {
  contractVersion: GuardrailContractVersion;
  hook: HookId;
  mode: GuardrailMode;
  /**
   * The EFFECTIVE decision, ALREADY neutralised to `'allow'` when
   * `mode !== 'enforce'`. Compare against `wouldBeDecision` to see what a
   * monitoring guardrail WOULD have done.
   */
  decision: SafetyAction;
  /** What would have happened in enforce mode. The dry-run affordance. */
  wouldBeDecision: SafetyAction;
  /**
   * Whether the decision was APPLIED.
   *
   * `decision === 'block' && enforced === false` means the decision was NOT
   * applied — the guardrail is monitoring, and the call must proceed. Blocking
   * on `decision` alone turns every monitor-mode guardrail into an enforcing
   * one. Use {@link shouldBlock}.
   */
  enforced: boolean;
  /**
   * True when the guardrail is disabled or absent: no policies ran, so
   * `decision: 'allow'` is VACUOUS rather than "the content is safe".
   */
  disabled: boolean;
  findings: SafetyFinding[];
  mutations: Mutation[];
  /** Present iff mutations were produced — the rewrite is already applied. */
  subject?: HookSubject;
  /** Shortcut onto the rewritten text; the legacy result calls it
   *  `redacted_text`. Send this instead of what you submitted. */
  text?: string;
  riskScore: number;
  codes: string[];
  /** The rendered block message — an OBJECT (see {@link RenderedBlockMessage}),
   *  whose `mode` decides between rejecting and substituting `body`. */
  message?: RenderedBlockMessage;
  guardrailKeys: string[];
  /** First evaluated key — what the legacy result reports. */
  guardrailKey: string;
  guardrailName: string;
  /** `${key}@${updatedAt}`, joined with '+' when several guardrails merged. */
  policyVersion: string;
  traceId: string;
  latencyMs: number;
  /** Policies that could not run; `failMode` has already been applied. */
  degraded?: Array<{ policyId: string; family: GuardrailPolicyFamily; reason: string }>;
  /**
   * Policies that were STARTED and then abandoned, because another policy in
   * the same lane blocked first. Distinct from `degraded`: that one tried and
   * failed, this one was never allowed to finish, so it contributed no finding
   * and no mutation.
   *
   * Read it whenever you compare two evaluations of the same input: a lane
   * configured to stop on the first block may report a different number of
   * findings from one run to the next, and this is the only field that says so.
   */
  cancelled?: Array<{
    policyId: string;
    family: GuardrailPolicyFamily;
    /** The lane it was running in. */
    layer: number;
    reason: string;
  }>;
}

// ── Hook evaluation (POST /guardrails/hooks/evaluate) ────────────────────

/** Options every hook evaluation accepts, whatever the hook. */
interface GuardrailHookEvaluateOptions {
  /**
   * Run ONLY these policy families — what lets a latency-sensitive caller ask
   * for just the deterministic part instead of racing the whole evaluation.
   */
  only?: GuardrailPolicyFamily[];
  /**
   * Suppress evaluation-log writes and usage events. Opt-IN, and only for a
   * preview ("would this block?"): real enforcement traffic belongs in the
   * audit trail.
   */
  shadow?: boolean;
  /** Wall-clock budget in ms for SYNC policies. On expiry `failMode` decides. */
  budget_ms?: number;
  /** Your correlation id; it becomes the verdict's `traceId`. */
  request_id?: string;
}

/**
 * Which guardrails to evaluate. At least one of the two is required — a hook
 * may be governed by several guardrails, whose verdicts merge by max().
 */
type GuardrailHookKeys =
  | { guardrail_key: string; guardrail_keys?: string[] }
  | { guardrail_key?: string; guardrail_keys: string[] };

/** `prompt.pre` / `input.pre` / `output.pre` — a flat string subject. */
export type GuardrailTextHookEvaluateParams = GuardrailHookEvaluateOptions &
  GuardrailHookKeys & {
    hook: 'prompt.pre' | 'input.pre' | 'output.pre';
    text: string;
  };

/** `output.stream.delta` — one window of a streamed answer. */
export type GuardrailStreamHookEvaluateParams = GuardrailHookEvaluateOptions &
  GuardrailHookKeys & {
    hook: 'output.stream.delta';
    /** The FULL accumulated channel text. Finding spans are absolute into it. */
    buffer: string;
    /** This window's newly-arrived text. Defaults to `buffer.slice(released_to)`. */
    delta?: string;
    /** Absolute offset already written to the client. Default 0. */
    released_to?: number;
    seq?: number;
    final?: boolean;
  };

/** `tool.pre` — a tool call about to run. `tool_name` is required. */
export type GuardrailToolPreHookEvaluateParams = GuardrailHookEvaluateOptions &
  GuardrailHookKeys & {
    hook: 'tool.pre';
    /** Canonical policy name with route params stripped — a concrete URL leaks
     *  ids into policy and stops `sideEffects` entries from matching. */
    tool_name: string;
    tool_args?: Record<string, unknown>;
    /** The name the model used, before MCP rename resolution. */
    requested_name?: string;
    /** `mcp:<serverKey>` | `sandbox:<instanceId>` | `agent:<agentKey>`. */
    provider_ref?: string;
    sandbox_available?: boolean;
  };

/** `tool.post` — a tool result about to reach the model. `tool_name` and
 *  `tool_result` are both required. */
export type GuardrailToolPostHookEvaluateParams = GuardrailHookEvaluateOptions &
  GuardrailHookKeys & {
    hook: 'tool.post';
    tool_name: string;
    /** The tool's output. Required — pass `null` for a tool that returns
     *  nothing rather than omitting the field. */
    tool_result: unknown;
    tool_args?: Record<string, unknown>;
    provider_ref?: string;
  };

/**
 * The body of `client.guardrails.hooks.evaluate(...)`, discriminated on
 * `hook`: a `tool.pre` call cannot compile without `tool_name`, and a
 * `tool.post` call cannot compile without `tool_result`.
 */
export type GuardrailHookEvaluateParams =
  | GuardrailTextHookEvaluateParams
  | GuardrailStreamHookEvaluateParams
  | GuardrailToolPreHookEvaluateParams
  | GuardrailToolPostHookEvaluateParams;

/**
 * The wire form of a {@link HookVerdict} — the same decision, in the snake_case
 * this API answers with. `decision` / `enforced` keep their names, so
 * {@link shouldBlock} accepts this directly.
 */
export interface GuardrailHookEvaluateResponse {
  hook: HookId;
  contract_version: GuardrailContractVersion;
  /** EFFECTIVE decision, already neutralised in monitor mode. */
  decision: SafetyAction;
  /** What would have happened in enforce mode. */
  would_be_decision: SafetyAction;
  /** False = the decision was NOT applied. See {@link shouldBlock}. */
  enforced: boolean;
  mode: GuardrailMode;
  /** True when nothing ran, so `decision: 'allow'` is vacuous. */
  disabled: boolean;
  /** "No blocking finding", NOT "the request was not blocked" — the two
   *  diverge in monitor mode. */
  passed: boolean;
  findings: SafetyFinding[];
  mutations: Mutation[];
  /** The rewritten subject; present only when a mutation was applied. */
  subject: HookSubject | null;
  /** The rewritten flat text; present only when a mutation was applied. */
  redacted_text: string | null;
  risk_score: number;
  codes: string[];
  /** The rendered block message OBJECT — `body` is the text, `mode` decides
   *  between rejecting and substituting it. See {@link RenderedBlockMessage}. */
  blocked_message: RenderedBlockMessage | null;
  /** A flat summary string built from the findings. Not the block message —
   *  that is `blocked_message`. */
  message: string | null;
  guardrail_key: string;
  guardrail_keys: string[];
  guardrail_name: string;
  /** Pair with the compiled policy's ETag to tell whether a cached policy is
   *  still current. */
  policy_version: string;
  trace_id: string;
  latency_ms: number;
  /** Policies that could not run; `failMode` has already been applied. */
  degraded: Array<{ policyId: string; family: GuardrailPolicyFamily; reason: string }>;
  /**
   * Policies that were STARTED and then abandoned, because another policy in
   * the same lane blocked first — they contributed no finding and no mutation.
   * Empty on every evaluation that ran to completion.
   *
   * OPTIONAL on this wire type even though the current server always sends it:
   * a client pinned to this SDK may be talking to an older console, and a
   * required field would make it describe a response that does not arrive.
   */
  cancelled?: Array<{
    policyId: string;
    family: GuardrailPolicyFamily;
    /** The lane it was running in. */
    layer: number;
    reason: string;
  }>;
}

// ── Persisted hook configuration (create / update / list) ────────────────

export interface GuardrailPolicyBase<F extends GuardrailPolicyFamily> {
  /** Stable within the guardrail and never reused — it appears on every
   *  finding. */
  id: string;
  family: F;
  enabled: boolean;
  /** Must be a subset of the family's valid hooks; enforced at save time. */
  hooks: HookId[];
  schedule: GuardrailHookSchedule;
  /** Overrides the record-level `action` for this policy's findings. */
  action?: SafetyAction;
  /** Per-POLICY, unlike the record-level `failMode`. */
  failMode?: 'open' | 'closed';
  /** 0 / absent = no timeout. */
  timeoutMs?: number;
  /**
   * WHEN this policy may spend a model call. `'onFinding'` runs it only after a
   * cheap deterministic policy has already flagged something; `'onSideEffect'`
   * only for a destructive, external or UNCLASSIFIED tool call. Absent — and
   * any unrecognised stored value — means `'always'`.
   *
   * Read only by the three LLM families; the deterministic ones cost a pass
   * over a string, so gating them would add nothing but a way to switch them
   * off by accident.
   */
  runIf?: 'always' | 'onFinding' | 'onSideEffect';
  label?: string;
  /**
   * What an end user is told when THIS policy blocks something, overriding the
   * per-reason template on `blockedMessage.templates`.
   *
   * WHY IT EXISTS. Messages are keyed by reason class, and `regex`, `custom`
   * and `webhook` all collapse onto `'custom'` — so without this field an
   * operator editing "the regex policy's message" is also rewriting the webhook
   * policy's, with nothing saying so.
   *
   * RESOLUTION ORDER, normative: this field, then
   * `blockedMessage.templates[reasonClass]`, then the built-in default for the
   * locale. BLANK MEANS INHERIT rather than "an empty message" — a whitespace
   * layer is skipped, so clearing it restores the inherited wording.
   *
   * Same closed variable set as every other template: the output is shown to
   * end users, so there is deliberately no way to interpolate a matched value —
   * that would turn the guardrail into an exfiltration channel for the very
   * data it exists to protect. The server rejects an unknown `{{variable}}`.
   */
  message?: string;
}

export interface GuardrailPiiPolicyConfig extends GuardrailPolicyBase<'pii'> {
  /** The `PiiPolicy.key` this policy scans through — a separate, reusable
   *  tenant asset it REFERENCES, not an id of its own. Required once enabled:
   *  the PII service owns categories, languages, patterns and mask
   *  strategies. */
  piiPolicyKey: string;
  actionOverride?: PiiAction;
  locale?: PiiLanguage;
  /** Extra NFKC + zero-width-strip + de-obfuscation pass. Its findings are
   *  span-less. Default true. */
  detectObfuscated?: boolean;
  /** Set only by the Console's legacy lift, never by an authored config. */
  legacyCategories?: Record<string, boolean>;
}

export interface GuardrailSecretsPolicyConfig extends GuardrailPolicyBase<'secrets'> {
  /** Named vendor patterns (Stripe / OpenAI / AWS / GitHub / Slack / JWT / PEM). */
  known?: boolean;
  /** The `\b[A-Za-z0-9-_]{32,}\b` heuristic, gated behind `minEntropy`. */
  genericHighEntropy?: boolean;
  minEntropy?: number;
  /** Known-safe literals: test fixtures, documentation samples. */
  allowValues?: string[];
}

export interface GuardrailWordFilterPolicyConfig extends GuardrailPolicyBase<'word_filter'> {
  builtinLists?: Record<string, boolean>;
  customListKeys?: string[];
  words?: string[];
  /** Legacy patterns. Newly authored ones belong in the `regex` family, which
   *  is span-capable and stream-eligible; these are neither. */
  regexes?: string[];
}

export interface GuardrailRegexRule {
  id: string;
  label: string;
  /** JavaScript regex source. Inline flags (`(?i)`) are not supported — put
   *  the letter in `flags` instead. */
  pattern: string;
  flags?: string;
  category: string;
  severity: GuardrailSeverity;
  action?: SafetyAction;
  /** Redact only this capture group instead of the whole match. */
  captureGroup?: number;
  /** Longest string this rule can match. Required, and rejected above 4096: it
   *  sizes the streaming hold-back window. */
  maxMatchChars: number;
}

export interface GuardrailRegexPolicyConfig extends GuardrailPolicyBase<'regex'> {
  rules: GuardrailRegexRule[];
}

export interface GuardrailModerationPolicyConfig extends GuardrailPolicyBase<'moderation'> {
  modelKey?: string;
  categories: Record<string, boolean>;
}

export interface GuardrailPromptShieldPolicyConfig extends GuardrailPolicyBase<'prompt_shield'> {
  modelKey?: string;
  sensitivity: 'low' | 'balanced' | 'high';
}

export interface GuardrailCustomPolicyConfig extends GuardrailPolicyBase<'custom'> {
  modelKey?: string;
  prompt: string;
  /** What a policy with no model does: `'skip'` passes (the legacy quirk),
   *  `'error_finding'` reports. */
  onMissingModel: 'skip' | 'error_finding';
}

export type GuardrailSideEffect = 'none' | 'read' | 'write' | 'destructive' | 'external';

/** A deliberate subset of JSON Schema — no `$ref`, no remote schemas. */
export interface GuardrailJsonSchemaLite {
  type?: 'object' | 'string' | 'number' | 'boolean' | 'array';
  required?: string[];
  properties?: Record<string, GuardrailJsonSchemaLite>;
  enum?: unknown[];
  additionalProperties?: boolean;
}

export interface GuardrailToolAccessPolicyConfig extends GuardrailPolicyBase<'tool_access'> {
  allow?: string[];
  deny?: string[];
  sideEffects?: Record<string, GuardrailSideEffect>;
  allowedRoles?: Record<string, string[]>;
  allowedDomains?: string[];
  /** Deny wins over allow and also matches subdomains. */
  deniedDomains?: string[];
  allowedPathPrefixes?: string[];
  deniedPathPrefixes?: string[];
  argumentSchemas?: Record<string, GuardrailJsonSchemaLite>;
  maxArgBytes?: number;
  maxResultBytes?: number;
  /** JSON-bomb defence. Default 32. */
  maxArgDepth?: number;
  /** Which arguments actually carry a URL / a filesystem path, per tool name.
   *  Declared paths are authoritative. */
  urlArgPaths?: Record<string, string[]>;
  pathArgPaths?: Record<string, string[]>;
  /** Scrape every string for URLs/paths instead. Default false; its findings
   *  are clamped to 'medium'/'flag'. */
  scanUndeclaredStrings?: boolean;
  /** Root that path prefixes resolve against, POSIX-normalised. */
  fsRoot?: string;
  /** SSRF guard on DECLARED url arguments only (it resolves DNS). */
  denyPrivateNetworks?: boolean;
  /** Default 'read'. */
  defaultSideEffect?: GuardrailSideEffect;
  /** Side effect → action. Defaults to warn (not block) for destructive and
   *  external. */
  sideEffectActions?: Partial<Record<GuardrailSideEffect, SafetyAction>>;
}

/**
 * The extension point: its request body IS a hook call and its response body
 * IS a hook verdict.
 */
export interface GuardrailWebhookPolicyConfig extends GuardrailPolicyBase<'webhook'> {
  /** https only, enforced at save. */
  url: string;
  headers?: Record<string, string>;
  /** Provider key holding the encrypted bearer. */
  credentialProviderKey?: string;
  /** Config key of the HMAC secret used to sign `${timestamp}.${body}`. */
  signingSecretRef?: string;
  /** `'text'` keeps structured PII off the wire unless you opt in. */
  send: 'text' | 'subject';
  retries?: 0 | 1 | 2;
}

export type GuardrailPolicy =
  | GuardrailPiiPolicyConfig
  | GuardrailSecretsPolicyConfig
  | GuardrailWordFilterPolicyConfig
  | GuardrailRegexPolicyConfig
  | GuardrailModerationPolicyConfig
  | GuardrailPromptShieldPolicyConfig
  | GuardrailCustomPolicyConfig
  | GuardrailToolAccessPolicyConfig
  | GuardrailWebhookPolicyConfig;

/** A hook runs iff its binding is enabled AND an enabled policy names it. */
export interface GuardrailHookBinding {
  enabled: boolean;
  schedule: GuardrailHookSchedule;
  failMode?: 'open' | 'closed';
  /** Whole-hook budget. 0 / absent = no timeout. */
  timeoutMs?: number;
}

export interface GuardrailStreamSettings {
  /** Opt-in. Lifted legacy rows get false so streaming behaviour does not
   *  change on upgrade. */
  enabled: boolean;
  /** Characters withheld behind the write frontier. The engine RAISES this to
   *  the longest match any enabled stream-eligible policy can produce. Default 256. */
  holdBackChars?: number;
  /** ...or this long, whichever comes first. Default 200. */
  holdBackMs?: number;
  /** Characters re-scanned each window so a match spanning the boundary is
   *  found with a correct absolute span. Default 64. */
  overlapChars?: number;
  /** Cap on the held region; on overflow `onBudgetExceeded` decides. Default 4000. */
  maxHeldChars?: number;
  onBudgetExceeded?: 'release' | 'terminate';
  /** `'truncate'` ends the stream after the block message; `'replace'` is only
   *  honest when nothing has been flushed yet. Default 'truncate'. */
  onBlock?: 'truncate' | 'replace';
}

export interface GuardrailBlockedMessageSettings {
  /** `'error'` returns the OpenAI-shaped error body; `'replace'` returns a
   *  normal 200 whose assistant content IS the message. */
  mode?: 'error' | 'replace';
  /** Per-reason overrides. The variable set is closed and excludes the matched
   *  text — a template is tenant-editable and its output is shown to end users. */
  templates?: Partial<Record<GuardrailBlockReasonClass, string>>;
  /** Default true — support cannot debug a block without the trace id. */
  includeTraceId?: boolean;
}

export interface GuardrailVerdictVisibility {
  /** Response headers describing the verdict (`x-cognipeer-guardrail*`).
   *  Default true. */
  headers?: boolean;
  /** Opt-in 246 (passed with findings) / 446 (blocked). Off by default: a
   *  block is HTTP 400 today and every deployed client parses that. */
  useVerdictStatusCodes?: boolean;
  detailedHeaders?: boolean;
  /** Keep the pre-rename `x-aegis-*` header aliases for one release. */
  aegisCompatHeaders?: boolean;
}

/** The whole v2 configuration in one blob — what `hooks` carries on create and
 *  update. */
export interface GuardrailHooksConfig {
  contractVersion: GuardrailContractVersion;
  policies: GuardrailPolicy[];
  bindings: Partial<Record<HookId, GuardrailHookBinding>>;
  stream?: GuardrailStreamSettings;
  blockedMessage?: GuardrailBlockedMessageSettings;
  visibility?: GuardrailVerdictVisibility;
  /** Stop after the first synchronous `block`. Default true. */
  shortCircuit?: boolean;
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
  /** False when the agent hides its reasoning text from API responses and session events. Default true. */
  showReasoning?: boolean;
  /** Sandbox settings, as the authoring calls return them: secret values are never included. */
  sandbox?: {
    /**
     * True when the stored secrets can no longer be decrypted (the encryption key changed): the
     * secrets list comes back empty and the sandbox tools run without them. Saving the agent with
     * masked and new values together is `409 sandbox_secrets_unreadable`; enter every secret again.
     */
    secretsUnreadable?: boolean;
    [key: string]: unknown;
  };
}

/** One entry of `Agent.models`: a model a caller may pick with `agent_model`. */
export interface AgentModelChoice {
  /** Model key to send as `agent_model`. */
  key: string;
  /** Display name. */
  label: string;
  /** When to choose it, as the agent's author wrote it. */
  description?: string;
  /** True for the agent's main model. */
  default: boolean;
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
  /**
   * What a client needs before it offers an attach button. Only on the
   * single-agent lookup (`agents.get()`), not in `agents.list()`; absent on a
   * Console that predates session files.
   */
  attachments?: AgentAttachmentsInfo;
  /**
   * Models a caller may pick with `agent_model`, main model first. Only on the
   * single-agent lookup, and only when the agent offers more than one model.
   */
  models?: AgentModelChoice[];
  /**
   * JSON Schema of the inputs the agent declares (`inputs` of a request, run or routine),
   * "the agent as a typed function". Only on the single-agent lookup, and only when the
   * agent declares inputs.
   */
  input_schema?: Record<string, unknown> | null;
  /** JSON Schema of the agent's structured output (`output_parsed`). Only on the single-agent lookup, when it has one. */
  output_schema?: Record<string, unknown> | null;
}

/**
 * `Agent.attachments`: whether the agent takes files right now, its limits, and
 * whether its model reads images. The limits are the agent's `attachments`
 * settings (Configure → Files); the Console enforces them on every upload.
 */
export interface AgentAttachmentsInfo {
  /**
   * Files are switched on for the agent AND its bucket can take a file now. When
   * false, `sessions.files.upload()` answers 403 `attachments_disabled` (files off,
   * or on with no bucket chosen) or 409 `storage_unavailable` (the bucket cannot
   * take a file at the moment).
   */
  enabled: boolean;
  /**
   * Files one session holds (0 while files are switched off for the agent). When
   * files are on but the bucket cannot take a file at the moment, `enabled` is
   * false and the real limits are still reported.
   */
  max_files: number;
  /** Largest file in MB (0 while files are switched off; real limits otherwise, see `max_files`). */
  max_file_size_mb: number;
  /** Accepted MIME types (`image/*` style wildcards allowed); empty = any. */
  allowed_mime_types: string[];
  /**
   * The agent can take an image now: uploads are on and the bucket can take a file
   * (`enabled`) AND the agent's model accepts image input. It is `false` whenever uploads are
   * off or the bucket is unusable, whatever the model can read. When false, an attached image
   * is replaced by a note saying so (the model never sees it). A chat model with no stored
   * setting is taken to accept images when its id belongs to a known vision family.
   */
  accepts_images: boolean;
  /**
   * Files the agent writes for the person (`session_files_create`, listed in the response's
   * `output_files`). Independent of uploads: an agent with an attachments bucket can write
   * files while uploads are off. By default outputs are on when uploads are on and a bucket is
   * set; with uploads off they stay off until turned on.
   */
  outputs: AgentOutputsInfo;
}

/** `Agent.attachments.outputs`. */
export interface AgentOutputsInfo {
  /** The agent writes files now: outputs are on, a bucket is chosen and it can take a file. */
  enabled: boolean;
  /** Files the agent may write per turn. */
  max_files_per_turn: number;
  /** Largest file in MB. */
  max_file_size_mb: number;
  /** File extensions it may write, without the dot (`pdf`, `csv`, ...). */
  types: string[];
}

export interface ListAgentsQuery {
  status?: AgentStatus;
}

// ============================================================================
// Agent Responses API Types (OpenAI Responses API compatible)
// ============================================================================

/** Input item for the Responses API `input` field */
export interface ResponseInputItem {
  role: 'user' | 'system' | 'assistant';
  content: string | Array<ResponseInputContent | ResponseInputFileContent | ResponseInputImageContent>;
}

/** Content part inside an input item */
export interface ResponseInputContent {
  type: 'input_text';
  text: string;
}

/**
 * A file for the turn: one already uploaded to the conversation with
 * `client.agents.sessions.files.upload()` (`file_id`, which needs the request to
 * name that conversation: `session_id`, `conversation` or `previous_response_id`),
 * or inline `file_data` (base64 or a `data:` URL; the Console stores it as a
 * session file).
 */
export interface ResponseInputFileContent {
  type: 'input_file';
  file_id?: string;
  /** Base64 or a `data:` URL; used when there is no `file_id`. */
  file_data?: string;
  /** An `http(s)` URL the Console fetches (public hosts only); used when there is no `file_id` / `file_data`. */
  file_url?: string;
  /** Name for inline `file_data` / `file_url`. */
  filename?: string;
}

/**
 * An image: a session file (`file_id`, with `session_id` / `conversation` /
 * `previous_response_id`), a `data:` URL, or an `http(s)` URL the Console
 * fetches (public hosts only).
 */
export interface ResponseInputImageContent {
  type: 'input_image';
  file_id?: string;
  image_url?: string | { url: string };
}

/** Request body for the Responses API */
/**
 * Caller-supplied runtime context forwarded into the agent's downstream
 * tool / MCP / connected-agent HTTP calls. Each target must opt in to header
 * passthrough on the Console side ("Runtime Headers" policy); headers offered
 * to targets without the opt-in are silently dropped. Header values are never
 * logged or persisted by the Console.
 */
export interface RuntimeContext {
  /** Headers offered to every outbound target (subject to per-target policy). */
  headers?: Record<string, string>;
  /**
   * Per-target overrides. Keys are a bare record key or a kind-prefixed key:
   * `tool:<key>`, `mcp:<key>`, `agent:<key>`. Scoped headers win over `headers`.
   */
  connections?: Record<string, { headers?: Record<string, string> }>;
  /** Free-form metadata surfaced to logs/traces. */
  metadata?: Record<string, unknown>;
}

/** `text.format` of a Responses request: structured output for the turn. */
export type ResponsesTextFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; name: string; schema: Record<string, unknown>; description?: string; strict?: boolean };

/**
 * Which version of the agent runs: a version number, or `'draft'` for the unpublished
 * draft. Omitted = the published version (the draft only when nothing was ever published).
 */
export type AgentRunVersion = number | 'draft';

/**
 * Request body of `client.agents.responses.create()` (OpenAI Responses API, agent fields).
 *
 * The agent's own configuration decides instructions, sampling, tools and output
 * limits: `instructions`, `temperature`, `top_p`, `max_output_tokens`, `tools`,
 * `tool_choice` and the like are ignored (the response header `X-Cognipeer-Ignored-Params`
 * lists them), so they are not part of this type.
 */
export interface AgentResponseCreateRequest {
  /** Agent key (`my-agent` or `agent:my-agent`). */
  model: string;
  /** User input: a plain string or array of message items */
  input: string | ResponseInputItem[];
  /** ID of the previous response (`resp_<runId>`) to continue the conversation */
  previous_response_id?: string;
  /**
   * Continue this session: one created with `client.agents.sessions.create()`
   * (with files already uploaded to it, if any) or any session id. The same
   * session `previous_response_id` (`resp_<id>`) and `conversation` name; give
   * one, or several that agree. `session_id` and `conversation` naming two
   * different sessions is a `400 invalid_request`; either of them naming a
   * different session than `previous_response_id` is a `400 session_conflict`.
   * A session of another agent or project is a `404 session_not_found`.
   * `file_id` input parts may name a file of this session.
   */
  session_id?: string | null;
  /**
   * OpenAI-style alias of `session_id`: a session id, or `{ id }`. Same rules.
   */
  conversation?: string | { id: string } | null;
  /**
   * Agent version to run: a number pins one, `'draft'` runs the draft. Omitted =
   * the published version.
   */
  version?: AgentRunVersion;
  /**
   * Structured output for this turn (replaces the agent's own structured output).
   * The parsed result is `output_parsed`; an answer that does not fit is `output_error`.
   */
  text?: { format?: ResponsesTextFormat };
  /** Stored on the run (up to 16 string pairs) and echoed in the response. */
  metadata?: RequestMetadata;
  /** `flex` runs the turn as a low-priority `deferred` run; every other value is the default class. */
  service_tier?: ServiceTier;
  /** Values for the inputs the agent declares (`Agent.input_schema`). */
  inputs?: Record<string, unknown>;
  /** OpenAI compatibility. The turn is always stored; the value is ignored. */
  store?: boolean;
  /** Runtime context (downstream headers/metadata) for this invocation */
  runtime_context?: RuntimeContext;
  /**
   * Do not wait for the answer: the call returns right away (`202`) with a response in
   * `queued` / `in_progress`. With `stream: true`, `background: true` keeps the run going
   * after the connection closes (otherwise a disconnect cancels it).
   * Follow it with `responses.retrieve(id)` or `agents.runs.wait(response.cognipeer.run_id)`.
   */
  background?: boolean;
  /**
   * Async runs: URL the Console POSTs the run's terminal event to
   * (`agent_run.succeeded` / `agent_run.failed` / `agent_run.canceled`).
   */
  callback_url?: string;
  /**
   * Async runs: secret (min 16 chars) used to HMAC-sign callback
   * deliveries (`X-Cognipeer-Signature`). Verify with
   * `verifyAgentRunCallback` from `@cognipeer/console-sdk/webhooks`.
   */
  callback_secret?: string;
  /** `true`: server-sent `response.*` events (use `for await` over what `create()` returns). */
  stream?: boolean;
  /**
   * Spend cap for the conversation this request creates (ignored when
   * `previous_response_id`, `session_id` or `conversation` continues an
   * existing one — use `client.agents.sessions.update()` then, or give the
   * budget to `client.agents.sessions.create()`). Defaults to the agent's own
   * session budget.
   */
  budget?: AgentSessionBudget;
  /**
   * Which of the agent's models answers this turn (its main model or one in
   * `Agent.models`). Omit for the session's last choice, else the main model.
   * Not offered: `400 model_not_allowed`.
   */
  agent_model?: string;
  /**
   * Reasoning effort; the agent's own pick and the Model Hub default win over it. Applied when the run
   * executes inside the request (a waited call or a stream); a queued run (`background: true`,
   * `service_tier: 'flex'`) uses the agent's own effort.
   */
  reasoning_effort?: ReasoningEffort;
  /** Same as `reasoning_effort` in the Responses shape; the object wins when both are sent. */
  reasoning?: { effort?: ReasoningEffort };
  /** False leaves the reasoning output item out of this response. It can only narrow what the agent's `showReasoning` allows. */
  include_reasoning?: boolean;
}

/** Per-call options for `client.agents.responses.create()`. */
export interface AgentResponseCreateOptions {
  /**
   * Sent as the `Idempotency-Key` header. Retrying an identical request with the
   * same key returns the original run's response instead of starting a second turn;
   * the same key with a different request is `409 idempotency_key_conflict`.
   */
  idempotencyKey?: string;
  /** Abort the HTTP request (for a stream: the stream; the run is cancelled unless `background: true`). */
  signal?: AbortSignal;
}

/** Annotation citing a file the agent produced this turn. */
export interface ResponseFileAnnotation {
  type: 'file_path';
  file_id: string;
  filename: string;
}

/** Text content within a response output message */
export interface ResponseOutputText {
  type: 'output_text';
  text: string;
  /** Files the agent produced this turn (also in `AgentResponse.output_files`). */
  annotations?: ResponseFileAnnotation[];
}

/** A single output message in the response */
export interface ResponseOutputMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ResponseOutputText[];
}

/** The agent's thinking text, when the agent shows its reasoning (`Agent.config.showReasoning`) and the request did not opt out (`include_reasoning: false`). Comes before the message. */
export interface ResponseReasoningItem {
  id: string;
  type: 'reasoning';
  summary: Array<{ type: 'summary_text'; text: string }>;
}

/** An item of `AgentResponse.output`. */
export type ResponseOutputItem = ResponseReasoningItem | ResponseOutputMessage;

/**
 * Token usage of an agent response. The two detail objects are always present (`0` when a
 * detail was not reported by the run).
 */
export interface ResponseUsage {
  input_tokens: number;
  /** `cached_tokens`: the cached slice of `input_tokens`. */
  input_tokens_details: { cached_tokens: number };
  output_tokens: number;
  /** `reasoning_tokens`: the reasoning slice of `output_tokens`; always `0` for an agent run (the platform has no source for it). */
  output_tokens_details: { reasoning_tokens: number };
  total_tokens: number;
}

/** A file the agent wrote this turn, saved as a session file (download with `sessions.files.content()`). */
export interface AgentOutputFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  /** Path of the file's content under the API root. */
  download_url: string;
}

/**
 * `AgentResponse.status`. `queued` / `in_progress` come with HTTP `202`: the turn is
 * still going. `cancelled` and `failed` end it without an answer, `incomplete` with a
 * partial one (a limit, see `incomplete_details`), `requires_action` waits on a person.
 */
export type AgentResponseStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'incomplete'
  | 'failed'
  | 'cancelled'
  | 'requires_action';

/** True when the response will not change any more (`completed`, `incomplete`, `failed`, `cancelled`). */
export function isAgentResponseFinal(status: AgentResponseStatus | string): boolean {
  return status === 'completed' || status === 'incomplete' || status === 'failed' || status === 'cancelled';
}

/** Full response returned by the Responses API */
export interface AgentResponse {
  /** Response ID, `resp_<runId>` (use as `previous_response_id` for follow-ups, `responses.retrieve()` / `cancel()`). */
  id: string;
  object: 'response';
  /** Agent key, as requested */
  model: string;
  /** The agent's reasoning item (when shown) and its answer message; empty while `queued` / `in_progress`. */
  output: ResponseOutputItem[];
  /** The answer text (all output text joined); a JSON string when structured output is set. */
  output_text?: string;
  /** Structured output: the parsed answer when the turn had a schema (`text.format`, or the agent's own). */
  output_parsed?: unknown;
  /** Structured output: why the answer does not fit the schema. */
  output_error?: string;
  /** Files the agent produced this turn. Absent when none. */
  output_files?: AgentOutputFile[];
  /** Completion status; see {@link AgentResponseStatus}. */
  status: AgentResponseStatus;
  /** Why a non-`completed` response ended early, OpenAI-style (e.g. `{ reason: 'max_cost' }`). */
  incomplete_details?: { reason: string } | null;
  /** Set when `status` is `failed`, else null. */
  error?: { code: string; message: string } | null;
  /**
   * How the agent turn ended: `completed` for a normal answer, `limit`,
   * `cancelled`, or `requires_action` while it waits on a person.
   */
  stop_reason?: AgentResponseStopReason;
  /** The runtime's own wording for a non-`completed` stop, e.g. which limit. */
  stop_detail?: string;
  /** Present when `status` is `requires_action`: the approvals / questions to resolve. */
  required_action?: AgentRequiredAction;
  /** Token usage; null while the turn has no answer yet. */
  usage: ResponseUsage | null;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Request `metadata`, echoed. */
  metadata?: RequestMetadata | null;
  /** The structured-output format the turn used, when any. */
  text?: { format?: ResponsesTextFormat };
  service_tier?: ServiceTier;
  /**
   * What the request asked for: `true` for a run started with `background: true` (also with
   * `stream: true`) or the `X-Cognipeer-Background` header; `retrieve()` reports it too. A
   * `service_tier: 'flex'` call is queued but was not a background request, so it reads `false`.
   */
  background?: boolean;
  /** Previous response ID if this is a follow-up */
  previous_response_id: string | null;
  /** The session (conversation) this turn belongs to. */
  conversation?: { id: string } | null;
  /** Agent version used for this response (null if not versioned) */
  version: number | null;
  /** The run behind the response, and which of the agent's models answered. */
  cognipeer?: AgentResponseCognipeer;
}

/** `AgentResponse.cognipeer`. */
export interface AgentResponseCognipeer {
  /** `run_<id>`: follow with `agents.runs.get()` / `wait()` / `events`. */
  run_id?: string;
  session_id?: string;
  /** Present when the call picked one of the agent's models (`agent_model`). */
  agent_model?: string;
}

// ── Response stream events (`responses.create({ stream: true })`) ────

interface ResponseEventBase<T extends string> {
  type: T;
  sequence_number: number;
}

/** `response.created` | `response.in_progress` | `response.completed` | `response.failed` | `response.incomplete`: carries the whole response. */
export type ResponseLifecycleEvent = {
  [T in
    | 'response.created'
    | 'response.in_progress'
    | 'response.completed'
    | 'response.failed'
    | 'response.incomplete']: ResponseEventBase<T> & { response: AgentResponse };
}[
  | 'response.created'
  | 'response.in_progress'
  | 'response.completed'
  | 'response.failed'
  | 'response.incomplete'
];

export type ResponseOutputItemEvent = {
  [T in 'response.output_item.added' | 'response.output_item.done']: ResponseEventBase<T> & {
    output_index: number;
    item: ResponseOutputMessage | { id: string; type: 'reasoning'; summary: Array<{ type: 'summary_text'; text: string }> };
  };
}['response.output_item.added' | 'response.output_item.done'];

export type ResponseContentPartEvent = {
  [T in 'response.content_part.added' | 'response.content_part.done']: ResponseEventBase<T> & {
    item_id: string;
    output_index: number;
    content_index: number;
    part: ResponseOutputText;
  };
}['response.content_part.added' | 'response.content_part.done'];

export type ResponseOutputTextDeltaEvent = ResponseEventBase<'response.output_text.delta'> & {
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
};

export type ResponseOutputTextDoneEvent = ResponseEventBase<'response.output_text.done'> & {
  item_id: string;
  output_index: number;
  content_index: number;
  text: string;
};

export type ResponseReasoningSummaryEvent =
  | (ResponseEventBase<'response.reasoning_summary_part.added'> & {
      item_id: string;
      output_index: number;
      summary_index: number;
      part: { type: 'summary_text'; text: string };
    })
  | (ResponseEventBase<'response.reasoning_summary_part.done'> & {
      item_id: string;
      output_index: number;
      summary_index: number;
      part: { type: 'summary_text'; text: string };
    })
  | (ResponseEventBase<'response.reasoning_summary_text.delta'> & {
      item_id: string;
      output_index: number;
      summary_index: number;
      delta: string;
    })
  | (ResponseEventBase<'response.reasoning_summary_text.done'> & {
      item_id: string;
      output_index: number;
      summary_index: number;
      text: string;
    });

/** The stream failed: `message` says why. A `response.failed` event with the failed response may follow; the stream ends after it. */
export interface ResponseErrorEvent {
  type: 'error';
  sequence_number?: number;
  code?: string | null;
  message: string;
  param?: string | null;
  /** The error's type (`server_error`, `invalid_request_error`, ...). */
  error_type?: string;
}

/** An event type this SDK version does not know: ignore it. */
export interface UnknownResponseEvent {
  type: string & {};
  sequence_number?: number;
  [key: string]: unknown;
}

/** One server-sent event of a streamed response. */
export type AgentResponseStreamEvent =
  | ResponseLifecycleEvent
  | ResponseOutputItemEvent
  | ResponseContentPartEvent
  | ResponseOutputTextDeltaEvent
  | ResponseOutputTextDoneEvent
  | ResponseReasoningSummaryEvent
  | ResponseErrorEvent
  | UnknownResponseEvent;

type KnownResponseStreamEvent = Exclude<AgentResponseStreamEvent, UnknownResponseEvent>;

/** Narrow a stream event by its `type`. */
export function isResponseStreamEvent<T extends KnownResponseStreamEvent['type']>(
  event: AgentResponseStreamEvent,
  type: T,
): event is Extract<KnownResponseStreamEvent, { type: T }> {
  return event.type === type;
}

/** What `sessions.cancel()` answers (200). */
export interface AgentConversationCancelResult {
  object: 'agent.session.cancel';
  session_id: string;
  /** Whether a running turn was asked to stop (false: nothing was running, not an error). */
  cancelled: boolean;
  /** `run_<id>` of the runs that were stopped. */
  run_ids: string[];
}

/**
 * What `sessions.actions.resolve()` answers (200) while other actions of the
 * same pause are still open: a `requires_action` response with no output yet.
 * Unlike a full {@link AgentResponse} it carries no `usage`, `created_at`,
 * `previous_response_id` or `version`.
 */
export interface AgentActionsPendingResponse {
  id: string;
  object: 'response';
  /** Agent key. */
  model: string;
  output: [];
  status: 'requires_action';
  stop_reason: 'requires_action';
  required_action: AgentRequiredAction;
}

/** `AgentResponse.stop_reason`. Open string: the server may add values. */
export type AgentResponseStopReason =
  | 'completed'
  | 'limit'
  | 'cancelled'
  | 'requires_action'
  | (string & {});

/** `AgentResponse.required_action` while `status` is `requires_action`. */
export interface AgentRequiredAction {
  type: 'agent_actions';
  actions: PendingAction[];
}

// ============================================================================
// Agent Background Runs
// ============================================================================

/**
 * Lifecycle of an agent run. `scheduled` waits for its start time (`run_at` /
 * `delay_seconds`, a routine); `queued` waits for a worker. `succeeded`/`failed`/`canceled` are
 * terminal. `requires_action` is NOT terminal: the run paused on an approval or
 * a question (its `result.required_action` lists them) and continues once they
 * are resolved.
 */
export type AgentRunStatus =
  | 'scheduled'
  | 'queued'
  | 'running'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'canceled';

/** Statuses after which a run never changes again. */
export const AGENT_RUN_TERMINAL_STATUSES: readonly AgentRunStatus[] = ['succeeded', 'failed', 'canceled'];

/** True when `status` is `succeeded`, `failed` or `canceled`. */
export function isAgentRunTerminal(status: AgentRunStatus | string): boolean {
  return (AGENT_RUN_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Statuses at which `agents.runs.wait()` stops polling: the terminal ones, plus
 * `requires_action` (the run is waiting on a person, so polling would never end).
 */
export const AGENT_RUN_SETTLED_STATUSES: readonly AgentRunStatus[] = [
  ...AGENT_RUN_TERMINAL_STATUSES,
  'requires_action',
];

/** True when `status` is terminal or `requires_action` — where `runs.wait()` returns. */
export function isAgentRunSettled(status: AgentRunStatus | string): boolean {
  return (AGENT_RUN_SETTLED_STATUSES as readonly string[]).includes(status);
}

/**
 * Why a run ended in `failed`/`canceled`. Known values are listed; the server
 * may add more, so treat it as an open string.
 */
export type AgentRunErrorReason =
  | 'agent_error'
  | 'max_duration_exceeded'
  | 'worker_lost'
  | 'expired'
  | 'interrupted'
  | 'canceled'
  | (string & {});

export interface AgentRunError {
  type: AgentRunErrorReason;
  message: string | null;
}

/** Execution class of a run: `default` (interactive) or `deferred` (low priority, own queue and caps). */
export type AgentRunClass = 'default' | 'deferred';

/** Where a run came from. */
export type AgentRunChannel = 'runs' | 'responses' | 'chat_completions' | 'a2a' | 'routine' | (string & {});

/** What started a run. */
export type AgentRunTrigger = 'request' | 'schedule' | 'once' | 'manual' | 'webhook' | (string & {});

/**
 * A run of an agent turn (`object: 'agent.run'`): what `agents.runs.*`,
 * `agents.routines.run()` and the `202` of the runs API return. `result` is the
 * Responses-shaped answer once the run finished; `output_text` / `output_parsed`
 * are lifted from it for convenience.
 */
export interface AgentRun {
  /** Run id, `run_<id>`. Its response id is `resp_<id>`. */
  id: string;
  object: 'agent.run';
  status: AgentRunStatus;
  class?: AgentRunClass;
  /** Agent key */
  agent?: string;
  /** Agent version the run uses. */
  version?: number | null;
  /** The session (conversation) the run belongs to. */
  session_id?: string;
  /** Same as `session_id`. */
  conversation_id?: string;
  channel?: AgentRunChannel | null;
  trigger?: AgentRunTrigger | null;
  /** The routine that fired it. */
  routine_id?: string | null;
  /** Request metadata. */
  metadata?: RequestMetadata | null;
  /**
   * How the agent turn ended (`end_turn`, `limit`, `requires_action`,
   * `cancelled`, `error`, ...). Null while the run is active.
   */
  stop_reason?: AgentSessionStopReason | null;
  /**
   * The turn's Responses API result once `succeeded` (its `id` is `resp_<runId>`),
   * or the `requires_action` response (with `required_action`) while `requires_action`.
   */
  result?: AgentResponse | null;
  /** The answer text, once there is one. */
  output_text?: string | null;
  /** The structured answer, when the run had a schema. */
  output_parsed?: unknown;
  /** Why the answer does not fit the schema (parsing or validation), when it had one. */
  output_error?: string | null;
  /** Set when `failed` or `canceled`. */
  error?: AgentRunError | null;
  /** Unix seconds a `scheduled` run starts at. */
  scheduled_for?: number | null;
  /** Unix timestamps (seconds) */
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  /** Unix seconds the caller stopped waiting (a sync call that became `202`), else null. */
  detached_at?: number | null;
  /** Unix seconds a cancel was requested (cooperative cancel in progress), else null. */
  cancel_requested_at?: number | null;
  /** The run's wall-clock ceiling in ms. */
  max_duration_ms?: number | null;
  /** The run's `callback` delivery, null when it has none. */
  callback?: AgentRunCallbackState | null;
}

/** `AgentRun.callback`: the state of the run's callback delivery. */
export interface AgentRunCallbackState {
  url: string;
  /** Delivery state (`pending`, `delivered`, `failed`...); null before the first attempt. */
  status: string | null;
  attempts: number;
  /** Whether the callback is HMAC-signed (a callback secret was given). */
  signed: boolean;
}

/** Options for `client.agents.runs.wait()`. */
export interface AgentRunWaitOptions {
  /**
   * Seconds each long-poll asks the Console to hold the request (`?wait=`). Default
   * 20; capped below the client's request timeout. The Console answers as soon as
   * the run settles, so this is only how long a quiet poll lasts.
   */
  waitSeconds?: number;
  /**
   * Smallest gap between two polls in ms (default 1000), a guard for a Console that
   * answers a long-poll at once. A long-poll that held for its time is not delayed.
   */
  pollIntervalMs?: number;
  /** Give up after this long and throw `AgentRunWaitTimeoutError`. Unset = wait until terminal or `requires_action`. */
  timeoutMs?: number;
  /** Abort waiting (the run itself keeps going; stop it with `runs.cancel()`). */
  signal?: AbortSignal;
}

/** `Prefer` header of a run call (RFC 7240): hold the call up to `wait` seconds, or answer at once with `respondAsync`. */
export interface AgentRunPrefer {
  wait?: number;
  respondAsync?: boolean;
}

/** Per-call options of `runs.create()` and `routines.run()`. */
export interface AgentRunCreateOptions {
  /**
   * Sent as `Idempotency-Key`. `runs.create()` generates one when you give none, so a
   * retried request (a network error, `429`/`5xx`) never starts a second run. Pass your
   * own to make the same job idempotent across processes; the same key with a different
   * request is `409 idempotency_key_conflict`.
   */
  idempotencyKey?: string;
  /** Sent as the `Prefer` header (a ready string, or `{ wait, respondAsync }`). */
  prefer?: string | AgentRunPrefer;
  signal?: AbortSignal;
}

/** Body of `runs.create()`. */
export interface AgentRunCreateRequest {
  /** The user message: text, or Responses input items (`input_text`, `input_file`, `input_image`). */
  input?: string | ResponseInputItem[];
  /** Values for the inputs the agent declares (`Agent.input_schema`). */
  inputs?: Record<string, unknown>;
  /** Continue this session; omitted starts a new one (its id is in the run). */
  session_id?: string;
  /** A version number, or `'draft'`. Omitted = the published version. */
  version?: AgentRunVersion;
  /** `deferred` is a low-priority run in its own queue. Default `default`. */
  class?: AgentRunClass;
  /** Start at this time (ISO 8601; up to 30 days ahead). The run is `scheduled` until then. */
  run_at?: string;
  /** Start in this many seconds. */
  delay_seconds?: number;
  /** Hold the call up to this many seconds for the answer (default 0: answer at once with the queued run; capped by the Console's window, 10 minutes by default). */
  wait?: number;
  /** `true`: stream `response.*` events (see {@link AgentResponseStreamEvent}). */
  stream?: boolean;
  /** Streams: `continue` (default) keeps the run going when the connection closes, `cancel` stops it. */
  on_disconnect?: 'continue' | 'cancel';
  metadata?: RequestMetadata;
  /** Where to POST the terminal event; `secret` (min 16 chars) signs it. */
  callback?: { url: string; secret?: string };
  /** Structured output for this run. */
  response_format?: ChatResponseFormat;
  runtime_context?: RuntimeContext;
  /** Applied to a streamed run only: a queued run (the default, `deferred`, scheduled) uses the agent's own effort. */
  reasoning?: { effort?: ReasoningEffort };
  agent_model?: string;
  budget?: AgentSessionBudget;
}

/** Options of `runs.get()`. */
export interface AgentRunGetOptions {
  /** Hold the request up to this many seconds until the run settles (long-poll). */
  wait?: number;
  signal?: AbortSignal;
}

/** Filters of `runs.list()`. */
export interface ListAgentRunsQuery {
  /** Agent key. */
  agent?: string;
  /** One status or several. */
  status?: AgentRunStatus | AgentRunStatus[];
  class?: AgentRunClass;
  session_id?: string;
  routine_id?: string;
  channel?: AgentRunChannel;
  /** What started the run. */
  trigger?: AgentRunTrigger;
  /** Exact match on up to 3 metadata pairs. */
  metadata?: RequestMetadata;
  /** Unix seconds, ISO 8601 string or Date. */
  created_after?: number | string | Date;
  created_before?: number | string | Date;
  /** Page size (default 20, max 100). */
  limit?: number;
  /** Cursor: a run id; the page starts after it (`AgentRunList.last_id`). */
  after?: string;
}

/** `GET /agents/runs`: one page, newest first. */
export interface AgentRunList {
  object: 'list';
  data: AgentRun[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
}

/** Counters of one execution class in {@link AgentRunQueue}. */
export interface AgentRunQueueCounts {
  running: number;
  queued: number;
  scheduled: number;
}

/** `runs.queue()`: what is running and waiting (tenant-wide, plus the token's project under `project`). */
export interface AgentRunQueue {
  object: 'agent.run_queue';
  default: AgentRunQueueCounts & { limit: number };
  deferred: AgentRunQueueCounts & {
    running_limit: number;
    queued_limit: number;
    oldest_queued_at: number | null;
  };
  /** The same counters for the caller's project only. */
  project?: {
    default?: AgentRunQueueCounts;
    deferred?: AgentRunQueueCounts;
  };
}

/** Machine-readable `error.code` values returned by agent run endpoints. */
export const AgentRunErrorCodes = {
  /** 409: a run is already queued/running on this conversation. */
  Conflict: 'agent_run_conflict',
  /** 409: cancel was called on a run that already finished (runs API). */
  AlreadyTerminal: 'agent_run_already_terminal',
  /**
   * 429 (`Retry-After: 30`): the tenant hit its concurrent run limit (or the deferred queue is full).
   * A stream is checked before it opens, so this is the plain `429` of the call, not an event on the stream.
   */
  ConcurrencyLimit: 'agent_run_concurrency_limit',
  /** 429 (with `Retry-After`): a spend limit is used up. */
  SpendLimitExceeded: 'spend_limit_exceeded',
  /** 429 (`Retry-After: 60` on a stream): the plan's agent quota is used up. A run counts a unit only once admitted. */
  QuotaExceeded: 'agent_quota_exceeded',
  /**
   * 503 (`retryable: true`, `side_effects_possible: true`): the run the call waited on was ended elsewhere
   * (the server shut down and handed its runs over, or the worker was lost) before it finished, so there is
   * no answer. Read the run or send the request again (use an `Idempotency-Key`: tool calls may have run).
   */
  Interrupted: 'agent_run_interrupted',
  /** 400: the body of the call is not a JSON object. */
  InvalidJson: 'invalid_json',
  /** 400: `version` is not a positive integer, a numeric string or `'draft'` (an unknown version is 404 `version_not_found`). */
  InvalidVersion: 'invalid_version',
  /** 400: a remote file or image URL could not be fetched, or did not arrive within the outbound timeout. */
  AttachmentUnreachable: 'attachment_unreachable',
  /** 400: the agent is not active. */
  AgentInactive: 'agent_inactive',
  /** 409: the Idempotency-Key was reused with a different request. */
  IdempotencyKeyConflict: 'idempotency_key_conflict',
  /** 400: `inputs` do not fit the agent's input schema; `error.response.error.errors` lists the fields. */
  InvalidInputs: 'invalid_inputs',
  /** 400: the response format (`response_format` / `text.format`) cannot be used. */
  InvalidResponseFormat: 'invalid_response_format',
} as const;

/** Machine-readable `error.code` values of the agent authoring calls (`agents.create()` / `update()`). */
export const AgentConfigErrorCodes = {
  /**
   * 409: the stored sandbox secrets cannot be decrypted (the encryption key changed), and the
   * save mixes masked values with new ones. Enter every secret again to replace them.
   */
  SandboxSecretsUnreadable: 'sandbox_secrets_unreadable',
} as const;

export type AgentConfigErrorCode = (typeof AgentConfigErrorCodes)[keyof typeof AgentConfigErrorCodes];

export type AgentRunErrorCode = (typeof AgentRunErrorCodes)[keyof typeof AgentRunErrorCodes];

/** True when `error` is a `CognipeerAPIError` carrying the given `error.code`. */
export function isAgentRunErrorCode(error: unknown, code: AgentRunErrorCode | AgentConfigErrorCode): error is CognipeerAPIError {
  return error instanceof CognipeerAPIError && error.errorCode === code;
}

/** Thrown by `runs.wait()` when `timeoutMs` elapses before the run finishes. */
export class AgentRunWaitTimeoutError extends CognipeerError {
  constructor(
    public runId: string,
    public timeoutMs: number,
    /** The last status observed before giving up. */
    public lastRun: AgentRun,
  ) {
    super(`Agent run ${runId} did not finish within ${timeoutMs}ms (last status: ${lastRun.status})`);
    this.name = 'AgentRunWaitTimeoutError';
  }
}

/**
 * Body of a callback POSTed to `callback_url`. Verify the signature
 * (`verifyAgentRunCallback`) on the raw body before trusting it.
 */
export interface AgentRunCallbackEvent {
  /**
   * `evt_<runId>_<event>`: stable across retries of the same event. After the run was resumed from a pause
   * the id carries the run's generation, `evt_<runId>_<event>_<generation>` from the second outcome on, so
   * every outcome has its own id.
   */
  id: string;
  /**
   * `agent_run.succeeded` | `agent_run.failed` | `agent_run.canceled`, and
   * `agent_run.requires_action` when the run paused on an approval or question.
   */
  event: `agent_run.${'succeeded' | 'failed' | 'canceled' | 'requires_action'}` | (string & {});
  createdAt: string;
  /** `run_<id>`. */
  runId: string;
  sessionId: string;
  /** Same as `sessionId`. */
  conversationId: string;
  /**
   * `{ result }` on success and on `requires_action` (the result carries
   * `required_action`), `{ errorReason, message? }` on failure, `{}` on cancel.
   */
  data: Record<string, unknown>;
}

// ============================================================================
// Agent Routines
// ============================================================================

/** Sender presets of a webhook trigger: they set the auth modes and how the event name and delivery id are read. */
export type AgentRoutineWebhookPreset = 'github' | 'gitlab' | 'azure_devops' | 'generic';

/**
 * How a webhook delivery proves itself. Per preset (first = default): `github` takes
 * `github_signature`; `gitlab` `gitlab_token` or `standard_webhooks`; `azure_devops` `basic`
 * (the password is the secret) or `header`; `generic` `bearer`, `signature`
 * (`x-cognipeer-signature`, see `signRoutineWebhook()`), `header` or `standard_webhooks`.
 */
export type AgentRoutineWebhookAuth =
  | 'github_signature'
  | 'gitlab_token'
  | 'basic'
  | 'header'
  | 'bearer'
  | 'signature'
  | 'standard_webhooks';

/** One rule of a webhook trigger's `filter` (all must match). Paths: `payload.action`, `payload.pull_request.labels.*.name`, `headers.x-github-event`, `event`. */
export interface AgentRoutineFilterRule {
  path: string;
  op: 'eq' | 'neq' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'contains' | 'starts_with' | 'glob';
  /** A string, number or boolean; a list for `in` / `not_in`; none for `exists` / `not_exists`. */
  value?: string | number | boolean | Array<string | number | boolean>;
}

/** A webhook trigger as a routine returns it: the URL to post to, never the secret. */
export interface AgentRoutineWebhookTrigger {
  type: 'webhook';
  /** The public URL a sender posts to. */
  url: string;
  preset: AgentRoutineWebhookPreset;
  auth: AgentRoutineWebhookAuth;
  /** The header that carries the secret, for auth `header`; else null. */
  header_name: string | null;
  /** The last 4 characters of the secret. */
  secret_hint: string;
  /** `generated` by the Console, or `provided` (the sender's Standard Webhooks secret). */
  secret_source: 'generated' | 'provided';
  /** Unix seconds until which the previous secret is still accepted (after `rotateWebhookSecret()` with a grace), else null. */
  previous_secret_valid_until: number | null;
  /** Event names to accept; empty = every event. */
  events: string[];
  filter: AgentRoutineFilterRule[];
  /** The event payload (JSON) is appended to the message. */
  include_payload: boolean;
}

/**
 * When a routine fires, as a routine returns it: on a cron `schedule`, `once` at a time,
 * `manual`ly (`routines.run()`), or when an authenticated delivery reaches its `webhook` URL.
 */
export type AgentRoutineTrigger =
  | { type: 'schedule'; cron: string; timezone: string }
  | { type: 'once'; run_at: string }
  | { type: 'manual' }
  | AgentRoutineWebhookTrigger;

/**
 * Trigger of a create / update. `schedule`: 5-field cron, IANA `timezone` (default `UTC`).
 * `once`: `run_at` (ISO 8601 or unix seconds, not in the past) or `delay_seconds`, one of them.
 * `webhook`: a new one gets a URL and a generated secret (shown once, in `AgentRoutine.webhook`),
 * except with `standard_webhooks`, where `secret` is the sender's `whsec_...` secret.
 */
export type AgentRoutineTriggerInput =
  | { type: 'schedule'; cron: string; timezone?: string }
  | { type: 'once'; run_at?: string | number; delay_seconds?: number }
  | { type: 'manual' }
  | {
      type: 'webhook';
      preset: AgentRoutineWebhookPreset;
      /** Default: the first mode of the preset. */
      auth?: AgentRoutineWebhookAuth;
      /** For auth `header`: `x-...`, default `x-cognipeer-token`. */
      header_name?: string;
      /** `standard_webhooks` only: the sender's secret. */
      secret?: string;
      events?: string[] | null;
      filter?: AgentRoutineFilterRule[] | null;
      include_payload?: boolean;
    };

/** A routine of an agent (`object: 'agent.routine'`): a prompt the agent runs on a trigger. Each fire is an {@link AgentRun}. */
export interface AgentRoutine {
  /** The routine's id (no prefix). */
  id: string;
  object: 'agent.routine';
  /** Agent key. */
  agent: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: AgentRoutineTrigger;
  /** The message each fire sends; for a webhook trigger a Mustache template over the event (`{{payload.action}}`). */
  prompt: string;
  /** For a webhook trigger: input name -> value or `{{path}}` template. */
  inputs: Record<string, unknown> | null;
  /** Pinned version; null = the published one. */
  version: number | null;
  class: AgentRunClass;
  /** Copied onto every run. */
  metadata: RequestMetadata;
  /** Where each run's terminal event goes; the secret is never returned. */
  callback: { url: string; signed: boolean } | null;
  response_format: ChatResponseFormat | null;
  /** Unix seconds; null for `manual`, `webhook` and a finished `once`. */
  next_fire_at: number | null;
  last_fire_at: number | null;
  /** `run_<id>` of the last fire that started a run. */
  last_run_id: string | null;
  last_status: 'started' | 'failed' | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  /** Only in the answer that created the routine or gave its webhook trigger a new generated secret: the secret is shown once. */
  webhook?: { url: string; secret: string };
}

/** `routines.list()`: every routine of the agent (`has_more` is always false). */
export interface AgentRoutineList {
  object: 'list';
  data: AgentRoutine[];
  has_more: boolean;
}

/**
 * Body of `routines.create()`. A routine without a `trigger` is `manual`. The prompt is
 * required unless the agent declares inputs and they are given (a webhook routine: unless
 * it includes the event payload or gives inputs).
 */
export interface AgentRoutineCreateRequest {
  name: string;
  description?: string | null;
  /** Default true. */
  enabled?: boolean;
  trigger?: AgentRoutineTriggerInput;
  prompt?: string;
  inputs?: Record<string, unknown> | null;
  /** Pin a version (omitted or null = the published one). */
  version?: number | null;
  class?: AgentRunClass;
  metadata?: RequestMetadata | null;
  /** `secret` is write-only: omitted keeps the stored one, `''` removes it. */
  callback?: { url: string; secret?: string } | null;
  response_format?: ChatResponseFormat | null;
}

/** Body of `routines.update()`: any field of the create body; the omitted ones stay. */
export type AgentRoutineUpdateRequest = Partial<AgentRoutineCreateRequest>;

/** Body of `routines.run()`: overrides for this one fire. */
export interface AgentRoutineRunRequest {
  /** Merged over the routine's inputs. */
  inputs?: Record<string, unknown>;
  metadata?: RequestMetadata;
  /** Webhook routines: a sample event payload (a JSON object or array), built into the turn like a delivery. */
  payload?: Record<string, unknown> | unknown[];
  /** Webhook routines: sample delivery headers (`x-github-event`, ...), for the event name and delivery id. */
  headers?: Record<string, string>;
  /** Webhook routines: evaluate the event filter and the turn, create nothing, answer an {@link AgentRoutineDryRun}. */
  dry_run?: boolean;
}

/** Per-call options of `routines.run()`. */
export interface AgentRoutineRunOptions extends AgentRunCreateOptions {
  /** Hold the call up to this many seconds for the answer (default 0: the run answers `202` when it did not finish; capped by the Console's window). */
  wait?: number;
}

/** What `routines.run(..., { dry_run: true })` answers (200): the turn a delivery would build, nothing created. */
export interface AgentRoutineDryRun {
  object: 'agent.routine.dry_run';
  /** The event passed the trigger's `events` and `filter`. */
  matched: boolean;
  /** Why it did not match, else null. */
  reason: string | null;
  event: string | null;
  delivery_id: string | null;
  /** The message the run would get (null when the turn cannot be built: see `errors`). */
  prompt: string | null;
  inputs: Record<string, unknown> | null;
  errors: Array<{ field: string; message: string }>;
}

/** `routines.delete()` answer. */
export interface AgentRoutineDeleted {
  id: string;
  object: 'agent.routine.deleted';
  deleted: true;
}

/** Body of `routines.rotateWebhookSecret()`. */
export interface AgentRoutineRotateSecretRequest {
  /** Seconds (0 to 86400, default 0) the current secret stays accepted. */
  grace_seconds?: number;
  /** `standard_webhooks` only (required there): the sender's new `whsec_...` secret. */
  secret?: string;
}

/** `routines.rotateWebhookSecret()` answer. */
export interface AgentRoutineWebhookSecret {
  object: 'agent.routine.webhook_secret';
  /** The new secret, shown once; absent for `standard_webhooks`, where you gave it. */
  secret?: string;
  secret_hint: string;
  /** Unix seconds the previous secret is accepted until, else null. */
  previous_valid_until: number | null;
}

/**
 * What became of a delivery: `accepted` started a run; `duplicate` repeated one; `filtered`
 * did not pass `events` / `filter`; `ignored` was a ping, a test or for a disabled routine;
 * `unauthorized` failed the auth check; `rejected` was refused by a rate or run limit;
 * `failed` was not valid JSON or could not start a run.
 */
export type AgentRoutineDeliveryOutcome =
  | 'accepted'
  | 'duplicate'
  | 'filtered'
  | 'ignored'
  | 'unauthorized'
  | 'rejected'
  | 'failed';

/** One request to a webhook trigger's URL, as the delivery log keeps it: outcome and normalized ids only, never the payload. */
export interface AgentRoutineDelivery {
  id: string;
  object: 'agent.routine.delivery';
  /** Unix seconds. */
  received_at: number;
  outcome: AgentRoutineDeliveryOutcome;
  /** What the Console answered the sender. */
  http_status: number;
  event: string | null;
  delivery_id: string | null;
  /** `run_<id>` of the run it started. */
  run_id: string | null;
  /** A fixed reason text (`signature mismatch`, `event "x" is not selected`, ...). */
  reason: string | null;
  /** Size of the request body. */
  bytes: number;
}

/** `routines.deliveries()`: newest first. */
export interface AgentRoutineDeliveryList {
  object: 'list';
  data: AgentRoutineDelivery[];
  has_more: boolean;
}

/** Query of `routines.deliveries()`. */
export interface ListAgentRoutineDeliveriesQuery {
  /** A delivery id: the page starts after it (the last `id` of the previous page). */
  before?: string;
  /** 1 to 100, default 20. */
  limit?: number;
}

// ============================================================================
// Agent Sessions: runtime state, pending actions, event log
// ============================================================================
//
// A session is a conversation seen from the runtime side: whether a turn is
// running, whether it paused for a person (tool approval / question), and an
// append-only event log. `client.agents.sessions.*` reads and drives it.

/**
 * `AgentSession.runtime_status`. `budget_paused` only exists on a Console with
 * agent runtime phase 1 (session budget). Open string: the server may add values.
 */
export type AgentSessionRuntimeStatus =
  | 'idle'
  | 'running'
  | 'requires_action'
  | 'budget_paused'
  | (string & {});

/**
 * Why a session turn (or background run) stopped. `budget_reached` only exists
 * on a Console with agent runtime phase 1 (session budget). Open string.
 */
export type AgentSessionStopReason =
  | 'end_turn'
  | 'requires_action'
  | 'limit'
  | 'cancelled'
  | 'error'
  | 'budget_reached'
  | (string & {});

/**
 * Spend cap of one session, in USD. `on_reach: 'pause'` (the default when
 * omitted in a request) keeps the session `budget_paused` so it can continue
 * after the budget is raised; `'stop'` ends the turn and leaves the session idle.
 *
 * An agent whose admin configured a session budget binds API callers to it: a
 * caller can lower it but not raise or remove it (403 `budget_override_forbidden`)
 * unless the agent allows client overrides.
 */
export interface AgentSessionBudget {
  max_cost_usd: number;
  on_reach?: 'pause' | 'stop';
}

/** The budget as the Console reports it (`on_reach` always present). */
export interface AgentSessionBudgetState {
  max_cost_usd: number;
  on_reach: 'pause' | 'stop';
}

/** One question of a `user_question` pending action. */
export interface AgentUserQuestion {
  question: string;
  header?: string;
  multi_select?: boolean;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value?: string; description?: string }>;
}

/** Status of a pending action. */
export type PendingActionStatus = 'pending' | 'resolved' | 'expired' | 'cancelled';

interface PendingActionBase {
  /** Action id (`act_<id>`) — pass it to `sessions.actions.resolve()`. */
  id: string;
  status: PendingActionStatus;
  /** ISO timestamp after which the request can no longer be answered. */
  expires_at?: string;
  /** ISO timestamp. */
  requested_at?: string;
}

/** The agent wants to run a tool and waits for an allow / deny. */
export interface ToolApprovalPendingAction extends PendingActionBase {
  kind: 'tool_approval';
  tool_name?: string;
  /** The arguments the model passed (approvers may edit them: `approved_args`). */
  args?: unknown;
}

/**
 * The agent asked the user a question and waits for the answer. Unlike a tool
 * approval it has no `tool_name`.
 */
export interface UserQuestionPendingAction extends PendingActionBase {
  kind: 'user_question';
  questions?: AgentUserQuestion[];
  /** Whether an answer other than the listed options is accepted. */
  allow_free_text?: boolean;
}

/** An approval or a question a paused turn is waiting on (public shape). */
export type PendingAction = ToolApprovalPendingAction | UserQuestionPendingAction;

/** Answer to a `tool_approval` action. */
export interface ToolApprovalResolution {
  decision: 'allow' | 'deny';
  comment?: string;
  /** Replacement arguments for an approval; must be a JSON object and valid for the tool. */
  approved_args?: Record<string, unknown>;
  /** Approve this tool for the rest of the session (only meaningful with `decision: 'allow'`). */
  remember_for_session?: boolean;
}

/**
 * Answer to a `user_question` action: `answers` keyed by the question text, a
 * string or (for `multi_select`) a list of strings — or `cancelled: true` to skip.
 */
export type UserQuestionResolution =
  | { answers: Record<string, string | string[]>; cancelled?: false }
  | { cancelled: true; answers?: Record<string, string | string[]> };

/** Body of `sessions.actions.resolve()`. */
export type ResolveActionBody = (ToolApprovalResolution | UserQuestionResolution) & {
  /** Runtime context for the continuation (downstream headers / metadata). */
  runtime_context?: RuntimeContext;
};

/** Options of `sessions.actions.resolve()`. */
export interface ResolveActionOptions {
  /**
   * Continue the turn as a background run: the call returns the queued
   * {@link AgentRun} (`202`) instead of waiting for the continuation.
   */
  background?: boolean;
  signal?: AbortSignal;
}

/**
 * `GET /agents/sessions/{id}` and `POST /agents/sessions` — a conversation with
 * an agent and its runtime state.
 */
export interface AgentSession {
  /** The session (conversation) id; pass it as `session_id`. */
  id: string;
  object: 'agent.session';
  /** Agent key. */
  agent: string;
  /** The session's title; the first message names a session that has none. */
  title: string | null;
  /** ISO timestamps. */
  created_at: string | null;
  updated_at: string | null;
  /**
   * The string pairs the client gave to `sessions.create({ metadata })` (`{}` for
   * a session it did not create that way). Never read by the agent.
   */
  metadata: Record<string, string>;
  runtime_status: AgentSessionRuntimeStatus;
  /** How the last turn ended; null before the first one. */
  stop_reason: AgentSessionStopReason | null;
  /** Actions still waiting for an answer. */
  pending_actions: PendingAction[];
  /** Seq of the newest event in the log (0 = none); resume streams after it. */
  last_event_seq: number;
  /** The session's spend budget, null when it has none. */
  budget: AgentSessionBudgetState | null;
  /** Priced spend so far, in USD. */
  spent_usd: number;
}

/** Body of `sessions.update()`. */
export interface AgentSessionUpdateRequest {
  /**
   * Required (the Console answers 400 `invalid_budget` without it): the new
   * budget, or `null` to remove it. A new budget must exceed what the session
   * already spent.
   */
  budget: AgentSessionBudget | null;
  /**
   * When the session is `budget_paused`, continue it without a new user
   * message (as a background run). Default `true` on the server; needs
   * background execution enabled for the agent.
   */
  resume?: boolean;
  /** Runtime context for the continuation (when it resumes). */
  runtime_context?: RuntimeContext;
}

/** Body of `sessions.create()`. */
export interface AgentSessionCreateRequest {
  /** Key of an active agent of the token's project. */
  agent: string;
  /** Optional title (at most 200 characters). Default: the first message names the session. */
  title?: string;
  /**
   * Up to 16 string pairs (keys 1-64 characters, values up to 512), returned as the
   * session's `metadata`. Handy for your own ids (`{ ticket: 'T-1042' }`); the agent
   * never reads it. Anything else is `400 invalid_metadata`.
   */
  metadata?: Record<string, string>;
  /**
   * Spend cap for the session (`null` = none, overriding the agent's default;
   * omitted = the agent's default). An agent whose admin set a session budget binds
   * API callers to it (403 `budget_override_forbidden`).
   */
  budget?: AgentSessionBudget | null;
  /** Context entered once for the whole session, merged under every turn's own. */
  runtime_context?: RuntimeContext;
}

/**
 * Runtime states `sessions.list({ status })` filters by (`idle` includes a
 * session that has not run yet).
 */
export type AgentSessionStatusFilter = 'idle' | 'running' | 'requires_action' | 'budget_paused';

/**
 * A session as a list shows it: {@link AgentSession} without its
 * `pending_actions` (open one session with `sessions.get()` to see them) and with
 * `message_count`.
 */
export interface AgentSessionSummary extends Omit<AgentSession, 'pending_actions'> {
  /** How many messages the session holds. */
  message_count: number;
}

/** Query of `sessions.list()`. */
export interface ListAgentSessionsQuery {
  /** Only this agent's sessions (its key). */
  agent?: string;
  /** Only sessions in this runtime state. */
  status?: AgentSessionStatusFilter;
  /** Page size, 1 to 100 (server default 20). Anything else is `400 invalid_limit`. */
  limit?: number;
  /**
   * The `next_cursor` of the previous page. The cursor marks the last row you read,
   * so sessions created while you page never shift a row into or out of a page you
   * already have. Not one the Console issued: `400 invalid_cursor`.
   */
  after?: string;
}

/** `GET /agents/sessions` as the Console answers it: one page, newest created first. */
export interface AgentSessionList {
  object: 'list';
  data: AgentSessionSummary[];
  has_more: boolean;
  /** Pass as `after` for the next page; null on the last page. */
  next_cursor: string | null;
}

/** `DELETE /agents/sessions/{id}` answer. */
export interface AgentSessionDeleted {
  id: string;
  object: 'agent.session';
  deleted: true;
}

// ── Session events ──────────────────────────────────────────────────

/**
 * Event types the Console documents. Open: unknown types arrive as
 * {@link UnknownSessionEvent} and must be ignored, not rejected.
 */
export type KnownSessionEventType = KnownSessionEvent['type'];

/**
 * Fields every persisted event has. On `/client/v1` the keys of `data` are
 * snake_case (tool `args` and question `answers` are passed through as the
 * agent/user wrote them).
 */
interface SessionEventEnvelope<T extends string, D> {
  /** Position in the conversation's log; strictly increasing. */
  seq: number;
  type: T;
  data: D;
  /** Background run the event belongs to, when there is one. */
  run_id?: string;
  /** ISO timestamp. */
  created_at: string;
}

/** Event `data` larger than 16 KB is cut and marked `_truncated: true`. */
type Truncatable = { _truncated?: boolean };

export type SessionUserMessageEvent = SessionEventEnvelope<
  'user.message',
  { content: string } & Truncatable
>;
export type SessionStatusRunningEvent = SessionEventEnvelope<
  'session.status_running',
  { trigger: 'message' | 'resume' | 'timeout' | (string & {}) }
>;
export type SessionToolUseEvent = SessionEventEnvelope<
  'agent.tool_use',
  { tool_call_id: string; name: string; args?: unknown; subagent?: string } & Truncatable
>;
export type SessionToolResultEvent = SessionEventEnvelope<
  'agent.tool_result',
  {
    tool_call_id: string;
    name: string;
    ok: boolean;
    duration_ms?: number;
    error?: string;
    subagent?: string;
  } & Truncatable
>;
export type SessionCompactionEvent = SessionEventEnvelope<
  'agent.compaction',
  Record<string, unknown>
>;
export type SessionActionRequiredEvent = SessionEventEnvelope<
  'action.required',
  {
    action_id: string;
    kind: 'tool_approval' | 'user_question';
    tool_name?: string;
    args?: unknown;
    questions?: AgentUserQuestion[];
    allow_free_text?: boolean;
    expires_at?: string;
  } & Truncatable
>;
export type SessionActionResolvedEvent = SessionEventEnvelope<
  'action.resolved',
  {
    action_id: string;
    kind: 'tool_approval' | 'user_question';
    decision?: 'allow' | 'deny';
    cancelled?: boolean;
    expired?: boolean;
    resolved_by: string;
    channel: string;
  }
>;
export type SessionAgentMessageEvent = SessionEventEnvelope<
  'agent.message',
  {
    content: string;
    message_index?: number;
    /** Present when the turn did not end with a plain answer (`limit`, `requires_action`, ...). */
    stop_reason?: AgentSessionStopReason;
    usage?: Record<string, unknown>;
  } & Truncatable
>;
export type SessionStatusIdleEvent = SessionEventEnvelope<
  'session.status_idle',
  {
    stop_reason: AgentSessionStopReason;
    pending_action_ids?: string[];
    detail?: string;
  }
>;
export type SessionErrorEvent = SessionEventEnvelope<
  'session.error',
  { message: string; code?: string }
>;
export type SessionWorkDoneEvent = SessionEventEnvelope<'session.work_done', Record<string, never>>;

/** Per-turn spend; written for a session that has a budget. */
export type SessionUsageEvent = SessionEventEnvelope<
  'session.usage',
  { turn_cost_usd: number; spent_usd: number; budget?: AgentSessionBudgetState | null }
>;
/** The session budget was reached (the turn stopped; `session.status_idle` follows). */
export type SessionBudgetReachedEvent = SessionEventEnvelope<
  'budget.reached',
  { spent_usd: number; max_cost_usd: number }
>;

/** The persisted event types this SDK knows. */
export type KnownSessionEvent =
  | SessionUserMessageEvent
  | SessionStatusRunningEvent
  | SessionToolUseEvent
  | SessionToolResultEvent
  | SessionCompactionEvent
  | SessionActionRequiredEvent
  | SessionActionResolvedEvent
  | SessionAgentMessageEvent
  | SessionStatusIdleEvent
  | SessionErrorEvent
  | SessionWorkDoneEvent
  | SessionUsageEvent
  | SessionBudgetReachedEvent;

/**
 * A persisted event of a type this SDK version does not know. Ignore it (a newer
 * Console may add event types). Note TypeScript cannot narrow `KnownSessionEvent`
 * out of a `type ===` check against this union — use {@link isSessionEvent}.
 */
export interface UnknownSessionEvent {
  seq: number;
  type: string & {};
  data: Record<string, unknown>;
  run_id?: string;
  created_at: string;
}

/** An event as stored in the log (`events.list`, and persisted frames of `events.stream`). */
export type SessionEvent = KnownSessionEvent | UnknownSessionEvent;

/**
 * Live-only text delta of the answer in progress. Delivered by `events.stream`
 * between persisted events, never stored, so it has no `seq` and a stream that
 * reconnects does not replay it — the full text arrives as `agent.message`.
 */
export interface SessionMessageDeltaEvent {
  seq?: undefined;
  type: 'agent.message.delta';
  data: { text: string };
  run_id?: string;
  created_at: string;
}

/** What `events.stream` yields. */
export type SessionStreamEvent = SessionEvent | SessionMessageDeltaEvent;

/** Type guard narrowing a session event to one documented type. */
export function isSessionEvent<T extends KnownSessionEventType>(
  event: SessionStreamEvent,
  type: T,
): event is Extract<KnownSessionEvent, { type: T }> {
  return event.type === type;
}

/**
 * Machine-readable `error.code` values of the session endpoints (see
 * `sessions.actions.resolve`, `sessions.create`, `sessions.files.upload`, and
 * `responses.create({ session_id })`).
 */
export const AgentActionErrorCodes = {
  /**
   * 404: the conversation does not exist in this project, or `session_id` /
   * `conversation` names a session of another agent or project.
   */
  SessionNotFound: 'session_not_found',
  /**
   * 400: `session_id` or `conversation` of one `responses.create()` names a
   * different session than `previous_response_id`. Give one of them. (Two
   * different sessions in `session_id` and `conversation` alone are a plain
   * `400 invalid_request`.)
   */
  SessionConflict: 'session_conflict',
  /**
   * 409: the bucket the agent keeps its session files in cannot take a file now
   * (deleted, disabled, or its provider is gone, inactive or not assigned to the
   * project). The message names the bucket; an administrator fixes the bucket or
   * picks another one in the agent's Files settings.
   */
  StorageUnavailable: 'storage_unavailable',
  /**
   * 409: the agent has files switched on but no bucket to keep them in (older
   * data). An administrator picks a bucket in the agent's Files settings.
   */
  StorageNotConfigured: 'storage_not_configured',
  /**
   * 403: the agent takes no files: they are off for it, or on with no bucket chosen
   * (`Files are not set up for this agent.`). Raised by `sessions.files.upload()` and
   * by a `responses.create()` that carries `input_file` / `input_image` parts.
   * `agents.get(key).attachments.enabled` says in advance.
   */
  AttachmentsDisabled: 'attachments_disabled',
  /**
   * 409 from the Files management API (not from any call of this SDK): a bucket
   * cannot be deleted or disabled while an agent keeps session files in it. The
   * body lists those agents (`error.response.agents`: `[{ key, name }]`).
   */
  BucketInUse: 'bucket_in_use',
  /** 404: no such action in this conversation. */
  NotFound: 'action_not_found',
  /**
   * 409: the request is no longer open because it was answered already (by
   * somebody else, or by an earlier call). A cancelled request is
   * {@link AgentActionErrorCodes.ActionCancelled} instead, a timed-out one
   * {@link AgentActionErrorCodes.Expired}; `error.response.error.action_status`
   * carries the final state.
   */
  NotPending: 'action_not_pending',
  /**
   * 409: the request was cancelled before it was answered (a new message that
   * withdrew it, a run cancel, or the agent's timeout policy), so there is
   * nothing left to answer. `error.response.error.action_status` is `cancelled`.
   */
  ActionCancelled: 'action_cancelled',
  /** 410: the request ran out of time (the agent's approval timeout). */
  Expired: 'action_expired',
  /** 403: the agent's `approvers` setting does not let this caller answer. */
  Forbidden: 'action_forbidden',
  /**
   * 503: the Console could not decide whether this caller may answer (or end a
   * request by sending a message) right now. Nothing was changed; retry after
   * the `Retry-After` seconds.
   */
  AuthorizationUnavailable: 'authorization_unavailable',
  /**
   * 409 from `sessions.files.content(…, { variant: 'markdown' })`: the file has
   * no text version (a picture, or a conversion that did not succeed). Read the
   * original instead.
   */
  MarkdownUnavailable: 'markdown_unavailable',
  /** 400: the body does not fit the action (bad decision, answers, `approvedArgs`...). */
  InvalidResolution: 'invalid_resolution',
  /**
   * 409: a new user message arrived while actions are open and the agent rejects
   * that; `error.response.error.pending_action_ids` lists them.
   */
  PendingAction: 'pending_action',
  /** 403: the agent's session budget binds API callers (`sessions.update`, `responses.create({ budget })`). */
  BudgetOverrideForbidden: 'budget_override_forbidden',
  /** 400: the budget is malformed or not above what the session already spent. */
  InvalidBudget: 'invalid_budget',
  /**
   * 402: the session used up its budget; `error.response.error.spent_usd` /
   * `max_cost_usd` say how much. Raise the budget with `sessions.update()`.
   */
  BudgetReached: 'budget_reached',
} as const;

export type AgentActionErrorCode = (typeof AgentActionErrorCodes)[keyof typeof AgentActionErrorCodes];

/**
 * True when `error` is a `CognipeerAPIError` carrying the given session error
 * code. A `409 agent_run_conflict` (a run is already active on the
 * conversation) is `isAgentRunErrorCode(error, AgentRunErrorCodes.Conflict)`.
 */
export function isAgentActionErrorCode(error: unknown, code: AgentActionErrorCode): error is CognipeerAPIError {
  return error instanceof CognipeerAPIError && error.errorCode === code;
}

/** Query of `sessions.events.list()`. */
export interface ListSessionEventsQuery {
  /** Only events with `seq` greater than this (default 0 = from the start). */
  after?: number;
  /** Only these event types. */
  types?: string[];
  /** Page size (server default 100, max 1000). */
  limit?: number;
}

/** Response of `sessions.events.list()`. */
export interface SessionEventList {
  object: 'list';
  events: SessionEvent[];
  /** Another page exists after `last_seq`. */
  has_more: boolean;
  /** Seq of the last event returned (or `after` when the page is empty). */
  last_seq: number;
}

/** Options of `sessions.events.stream()`. */
export interface SessionEventStreamOptions {
  /** Resume after this seq (default 0 = replay the log, then follow). */
  after?: number;
  /** Only these event types. */
  types?: string[];
  /** Stops the stream; the iterator then throws the signal's abort reason. */
  signal?: AbortSignal;
  /**
   * Consecutive reconnect attempts that get no data before the iterator gives
   * up and throws (default 8). A connection that delivered anything resets the
   * count. `Infinity` retries forever.
   */
  maxReconnects?: number;
  /** First reconnect delay in ms; doubles per failed attempt (default 1000). */
  reconnectDelayMs?: number;
  /** Upper bound of the reconnect delay in ms (default 15000). */
  maxReconnectDelayMs?: number;
  /**
   * Reconnect when no bytes (events or the server's 15 s `: ping`) arrive for
   * this long, in ms (default 45000; `0` disables).
   */
  idleTimeoutMs?: number;
}

// ── Session files ───────────────────────────────────────────────────

/** A file attached to a conversation. */
export interface SessionFile {
  /** Pass it as `file_id` in an `input_file` / `input_image` part. */
  id: string;
  object: 'agent.session.file';
  /** The conversation the file belongs to. */
  session_id: string;
  name: string;
  mime_type: string;
  /** Bytes. */
  size: number;
  /**
   * Text conversion of the file for the agent (documents become markdown):
   * `pending` until done, `skipped` for files that need none (images). Open string.
   */
  conversion_status: 'pending' | 'succeeded' | 'failed' | 'skipped' | (string & {});
  /** Why the conversion failed, when it did. */
  conversion_error?: string;
  /**
   * The Document Store bucket the file is stored in: the agent's
   * `attachments.bucketKey` when it was uploaded. Changing the agent's bucket
   * later affects new files only; this stays the bucket the file lives in.
   */
  bucket_key: string;
  /**
   * The object's path inside that bucket, `<folder>/<agentKey>/<sessionId>/<unique name>`
   * (the agent's `attachments.folder` is the first part). With `bucket_key` it
   * says where the file sits in the Document Store: list the session's folder with
   * `client.files.list(bucket_key, { prefix })`. Read the file itself with
   * `sessions.files.content()`.
   */
  path: string;
  /**
   * Console-relative path that serves the file's bytes
   * (`/api/client/v1/agents/sessions/{id}/files/{fileId}/content`). Prefer
   * `sessions.files.content()` / `contentStream()`, which add the base URL and the
   * token; this is for building a link on the Console host.
   */
  content_url: string;
  /** ISO timestamp. */
  created_at?: string;
  /** ISO timestamp after which the Console deletes the file (the agent's `retentionDays`); absent = kept. */
  expires_at?: string;
}

/** `GET …/files` envelope. */
export interface SessionFileList {
  object: 'list';
  data: SessionFile[];
}

/** `DELETE …/files/{id}` answer. */
export interface SessionFileDeleted {
  id: string;
  object: 'agent.session.file';
  deleted: true;
}

/** Options of `sessions.files.content()` / `contentStream()`. */
export interface SessionFileContentOptions {
  /**
   * `original` (default): the bytes as uploaded. `markdown`: the text the agent
   * reads, for a file that has one (`conversion_status: 'succeeded'`); a file without
   * one is a `409 markdown_unavailable` (the original is still there).
   */
  variant?: 'original' | 'markdown';
  signal?: AbortSignal;
}

/** A downloaded session file: `sessions.files.content()`. */
export interface SessionFileContent {
  data: Uint8Array;
  /** The response `Content-Type` (`application/octet-stream` when the Console sent none). */
  contentType: string;
  /** The file name from `Content-Disposition`, when the Console sent one. */
  fileName?: string;
}

/** A session file as a stream: `sessions.files.contentStream()`. Cancel the body if you stop reading early. */
export interface SessionFileContentStream {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  fileName?: string;
  /** From `Content-Length`, when the Console sent one. */
  size?: number;
}

/** Options of `sessions.files.upload()`. */
export interface UploadSessionFileOptions {
  /** File name; required for raw bytes, taken from a `File` when omitted. */
  name?: string;
  /**
   * MIME type; taken from a `Blob`/`File` when omitted, else
   * `application/octet-stream`. A JSON type (`application/json`, `*+json`) is
   * sent as `application/octet-stream`: the upload route reads a JSON body as
   * a base64 envelope, not as the file (the name still decides how it is read).
   */
  mimeType?: string;
  signal?: AbortSignal;
}

// ============================================================================
// Webhook subscriptions
// ============================================================================
//
// Subscriptions the Console delivers events to (signed with the endpoint's
// secret — verify with `verifyWebhook` from `@cognipeer/console-sdk/webhooks`).
// Requires a Console with agent runtime phase 1 (webhooks). Managing them is an
// administration permission (`webhooks.read` / `webhooks.admin`) of the Console's
// permission engine; see `WebhooksResource`.

/** Event types a subscription can ask for. Open string: the server may add more. */
export type WebhookEventType =
  | 'session.idled'
  | 'session.work_done'
  | 'action.required'
  | 'budget.reached'
  | 'agent_run.succeeded'
  | 'agent_run.failed'
  | 'agent_run.canceled'
  | 'agent_run.requires_action'
  | 'routine.fired'
  | 'routine.failed'
  | 'feedback.recorded'
  | 'webhook.test'
  | (string & {});

/** The event types above, for building pickers. */
export const WEBHOOK_EVENT_TYPES = [
  'session.idled',
  'session.work_done',
  'action.required',
  'budget.reached',
  'agent_run.succeeded',
  'agent_run.failed',
  'agent_run.canceled',
  'agent_run.requires_action',
  'routine.fired',
  'routine.failed',
  'feedback.recorded',
  'webhook.test',
] as const;

/** A subscribed event: an exact type or a `prefix.*` pattern (e.g. `agent_run.*`). */
export type WebhookEventPattern = WebhookEventType | `${string}.*`;

/** Health of a subscription. The Console disables one that keeps failing (`disabledReason`). */
export type WebhookEndpointStatus = 'active' | 'disabled';

export interface WebhookEndpoint {
  /** The endpoint id. */
  id: string;
  /**
   * The delivery URL. A caller who holds `webhooks.read` but not `webhooks.admin` sees
   * it with the userinfo and the query string removed (`https://host/path?…`), because
   * they often carry credentials. Only `webhooks.admin` sees the full URL, so never write
   * a URL you read as a read-only caller back with `update()` (which needs admin anyway).
   */
  url: string;
  /**
   * `true` when `url` is the shortened form described above because the caller
   * may not read the whole address. Absent when the full URL is shown.
   */
  urlRedacted?: boolean;
  /** null when none was given. */
  description: string | null;
  events: WebhookEventPattern[];
  /** Project the subscription is limited to; null = every project of the tenant. */
  projectId: string | null;
  status: WebhookEndpointStatus;
  /** Why the Console disabled it (redirect answer, blocked address, sustained failure, `manual`...). */
  disabledReason: string | null;
  /** ISO timestamp the endpoint started failing continuously; cleared by any 2xx. */
  failingSince: string | null;
  createdBy: string;
  /** ISO timestamps. */
  createdAt: string | null;
  updatedAt: string | null;
}

/** Returned once, by `create()` and `rotateSecret()` — store it, it cannot be read again. */
export interface WebhookEndpointWithSecret extends WebhookEndpoint {
  /** `whsec_…` */
  secret: string;
}

export interface CreateWebhookRequest {
  /** http(s) URL resolving to a public address; checked against the SSRF guard when saved (max 2048 chars). */
  url: string;
  events: WebhookEventPattern[];
  /** Max 500 chars. */
  description?: string;
  /**
   * Omitted = the token's project, which is the only one a client token can
   * create for: `null`, `"*"` or another project's id is refused with 403
   * (`A webhook can only be created for your own project`), tenant owner or not.
   */
  projectId?: string | null;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEventPattern[];
  description?: string;
  /** `active` re-enables a disabled endpoint, `disabled` pauses it. */
  status?: WebhookEndpointStatus;
}

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  /** `evt_<id>` — the `webhook-id` header; dedupe on it, a delivery can repeat. */
  eventId: string;
  eventType: WebhookEventType;
  /** The body that was (or will be) POSTed. */
  payload: WebhookEvent;
  status: WebhookDeliveryStatus;
  attempts: number;
  /** ISO timestamp of the next attempt while `pending`. */
  nextAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  lastDurationMs: number | null;
  /** ISO timestamps. */
  createdAt: string;
  deliveredAt: string | null;
}

/** Answer of `webhooks.deliveries()`. */
export interface WebhookDeliveryList {
  /** Newest first. */
  deliveries: WebhookDelivery[];
  /** Another page exists after `skip + deliveries.length`. */
  hasMore: boolean;
}

/** One entry of `webhooks.eventTypes()`. */
export interface WebhookEventTypeInfo {
  type: string;
  group: string;
}

export interface ListWebhookDeliveriesQuery {
  status?: WebhookDeliveryStatus;
  /** Page size (default 50, max 200). */
  limit?: number;
  /** Deliveries to skip (paging). */
  skip?: number;
}

/** Fields every webhook body has. `data` holds ids and small fields only: fetch the rest by id. */
interface WebhookEventEnvelope<T extends string, D> {
  /** `evt_<id>` — equal to the `webhook-id` / `x-cognipeer-event-id` header. */
  id: string;
  type: T;
  /** ISO timestamp. */
  createdAt: string;
  projectId?: string | null;
  data: D;
}

export type WebhookSessionIdledEvent = WebhookEventEnvelope<
  'session.idled',
  { conversationId: string; agentKey: string; stopReason: AgentSessionStopReason }
>;
export type WebhookSessionWorkDoneEvent = WebhookEventEnvelope<
  'session.work_done',
  { conversationId: string; agentKey: string }
>;
export type WebhookActionRequiredEvent = WebhookEventEnvelope<
  'action.required',
  { conversationId: string; agentKey: string; actionId: string; kind: 'tool_approval' | 'user_question' }
>;
export type WebhookBudgetReachedEvent = WebhookEventEnvelope<
  'budget.reached',
  { conversationId: string; agentKey: string; spentUsd: number; maxCostUsd: number }
>;
export type WebhookAgentRunEvent = WebhookEventEnvelope<
  | 'agent_run.succeeded'
  | 'agent_run.failed'
  | 'agent_run.canceled'
  | 'agent_run.requires_action',
  {
    /** `run_<id>`. */
    runId: string;
    sessionId: string;
    /** Same as `sessionId`. */
    conversationId: string;
    agentKey: string;
    status?: AgentRunStatus;
    class?: AgentRunClass;
    metadata?: RequestMetadata | null;
    routineId?: string | null;
  }
>;
/** What started a routine fire: a `schedule` tick, `once`, a `manual` run-now, or a `webhook` delivery. */
type WebhookRoutineTrigger = 'schedule' | 'once' | 'manual' | 'webhook';
export type WebhookRoutineFiredEvent = WebhookEventEnvelope<
  'routine.fired',
  {
    routineId: string;
    agentKey: string;
    trigger: WebhookRoutineTrigger;
    /** `run_<id>` of the run it started. */
    runId: string;
    /** The webhook event name, for a `webhook` trigger. */
    event?: string;
  }
>;
/** Sent at most once per routine and reason per hour. */
export type WebhookRoutineFailedEvent = WebhookEventEnvelope<
  'routine.failed',
  {
    routineId: string;
    agentKey: string;
    trigger: WebhookRoutineTrigger;
    event?: string;
    /** A fixed text: `agent run limit reached`, `spend limit reached`, `quota exceeded`, `agent is not active`, `internal error`, ... */
    reason: string;
  }
>;
export type WebhookFeedbackRecordedEvent = WebhookEventEnvelope<
  'feedback.recorded',
  {
    conversationId: string;
    agentKey: string;
    messageId: string;
    messageIndex: number;
    /** `null` when a rating was withdrawn. */
    rating: string | number | null;
    reasons: string[];
    hasComment: boolean;
    channel: string;
    portalId: string | null;
    withdrawn?: true;
  }
>;
export type WebhookTestEvent = WebhookEventEnvelope<'webhook.test', Record<string, never>>;

/** The body of a webhook delivery, for the types this SDK knows. */
export type KnownWebhookEvent =
  | WebhookSessionIdledEvent
  | WebhookSessionWorkDoneEvent
  | WebhookActionRequiredEvent
  | WebhookBudgetReachedEvent
  | WebhookAgentRunEvent
  | WebhookRoutineFiredEvent
  | WebhookRoutineFailedEvent
  | WebhookFeedbackRecordedEvent
  | WebhookTestEvent;

/** Body of an event type this SDK version does not know — acknowledge (2xx) and ignore it. */
export interface UnknownWebhookEvent {
  id: string;
  type: string & {};
  createdAt: string;
  projectId?: string | null;
  data: Record<string, unknown>;
}

/**
 * The JSON body of a delivery to a webhook subscription. (The older
 * per-run `callback_url` bodies are {@link AgentRunCallbackEvent}.)
 */
export type WebhookEvent = KnownWebhookEvent | UnknownWebhookEvent;

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

export type CrawlRunMode = 'sync' | 'async';

export interface RunCrawlerRequest {
  urls?: string[];
  seeds?: string[];
  callbackUrl?: string;
  /** 'async' (default) returns 202 + jobId; 'sync' blocks and inlines results. */
  mode?: CrawlRunMode;
  metadata?: Record<string, unknown>;
}

export interface CrawlOnContainerRequest {
  urls: string[];
  callbackUrl?: string;
  /** 'async' (default) returns 202 + jobId; 'sync' blocks and inlines results. */
  mode?: CrawlRunMode;
  metadata?: Record<string, unknown>;
}

export interface AdhocCrawlRequest {
  /** Seed URLs to crawl (maxDepth defaults to 0 → only these URLs). */
  seeds: string[];
  engine?: string;
  maxDepth?: number;
  maxPages?: number;
  callbackUrl?: string;
  /** 'async' (default) returns 202 + jobId; 'sync' blocks and inlines results. */
  mode?: CrawlRunMode;
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
  id?: string;
  _id?: string;
  jobId: string;
  url: string;
  type?: string;
  httpStatus?: number;
  status?: string;
  contentType?: string;
  title?: string;
  description?: string;
  /** Page content converted to markdown. */
  bodyMarkdown?: string;
  markdown?: string;
  html?: string;
  text?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

export interface CrawlRunAcceptedResponse {
  jobId: string;
  crawlerKey?: string;
  status: CrawlJobStatus;
  urlCount?: number;
}

/** Returned by container runs with `mode: 'sync'` — job finished, results inline. */
export interface CrawlRunSyncResponse {
  jobId: string;
  status: CrawlJobStatus;
  pagesProcessed?: number;
  filesProcessed?: number;
  errorsCount?: number;
  results: CrawlResult[];
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
// MCP Hub Types (curated server catalogs — enterprise module)
// ============================================================================

export interface McpHubSummary {
  key: string;
  name: string;
  description?: string;
  accessMode: 'token' | 'public';
  serverCount: number;
  updatedAt?: string;
}

export interface McpHubRemoteEndpoint {
  type: 'streamable-http' | 'sse';
  url: string;
  authentication: { type: 'none' } | { type: 'bearer'; description: string };
}

/** MCP-Registry-style catalog entry for one hub member server. */
export interface McpHubCatalogEntry {
  /** Server key — the stable identifier used in connection URLs. */
  name: string;
  title: string;
  description?: string;
  version: string;
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
  remotes: McpHubRemoteEndpoint[];
  _meta?: Record<string, unknown>;
}

export interface McpHubCatalogMetadata {
  count: number;
  nextCursor?: string;
}

export interface McpHubCatalogPage {
  servers: McpHubCatalogEntry[];
  metadata: McpHubCatalogMetadata;
}

export interface McpHubListResponse {
  hubs: McpHubSummary[];
}

export interface McpHubCatalogQuery {
  search?: string;
  cursor?: string;
  limit?: number;
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
 * Wire audio formats, for input and output alike.
 *
 * - `pcm16` — raw signed 16-bit little-endian mono at `*_audio_sample_rate`
 *   (default 24000). The default in both directions.
 * - `g711_ulaw` / `g711_alaw` — 8 kHz G.711 (telephony).
 *
 * Input is streamed (binary frames or base64 appends) into the server's turn
 * detector; output arrives as ~100 ms frames.
 */
export type RealtimeAudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw';

/** Output audio formats (same set as input). */
export type RealtimeOutputAudioFormat = RealtimeAudioFormat;

/** Sample rates accepted for `pcm16` input/output. */
export type RealtimeAudioSampleRate = 8000 | 16000 | 24000 | 48000;

/**
 * Server-side turn detection. `semantic_vad` = Silero VAD + Smart Turn
 * (semantic end-of-turn); `server_vad` = VAD + fixed silence. `null` on the
 * session means manual `input_audio_buffer.commit` (push-to-talk).
 *
 * Default: `semantic_vad`. All durations are milliseconds.
 */
export interface RealtimeTurnDetection {
  type: 'semantic_vad' | 'server_vad';
  /** VAD speech probability threshold, 0..1 (default 0.5). */
  threshold?: number;
  /** Audio kept before speech onset (default 300). */
  prefix_padding_ms?: number;
  /** Speech must last this long to count as speech start (default 150). */
  min_speech_ms?: number;
  /** `server_vad`: silence that ends the turn (default 600). `semantic_vad`: pause before the first semantic check (default 200). */
  silence_duration_ms?: number;
  /** `semantic_vad`: end the turn anyway after this much silence (default 1800; scaled by `eagerness`). */
  max_turn_silence_ms?: number;
  /** `semantic_vad`: Smart Turn end-of-turn probability threshold, 0..1 (default 0.5). */
  semantic_threshold?: number;
  /** `low` waits longer, `high` answers sooner. */
  eagerness?: 'low' | 'medium' | 'high' | 'auto';
  /** Continuous speech needed before a barge-in cancels the response (default 400). */
  interrupt_min_ms?: number;
  /** Hard cap on one utterance (default 30000) — the turn ends with reason `max_duration`. */
  max_utterance_ms?: number;
  /** Create a response automatically when a turn ends (default true). */
  create_response?: boolean;
  /** Let user speech (barge-in) cancel the in-flight response (default true). */
  interrupt_response?: boolean;
}

/**
 * Turn detection as the server echoes it (`session.created/updated`, preset
 * views): every field is present, unset tuning values are `null` (server
 * defaults apply).
 */
export interface RealtimeTurnDetectionView {
  type: 'semantic_vad' | 'server_vad';
  threshold: number | null;
  prefix_padding_ms: number | null;
  min_speech_ms: number | null;
  silence_duration_ms: number | null;
  max_turn_silence_ms: number | null;
  semantic_threshold: number | null;
  eagerness: 'low' | 'medium' | 'high' | 'auto' | null;
  interrupt_min_ms: number | null;
  max_utterance_ms: number | null;
  create_response: boolean;
  interrupt_response: boolean;
}

/** Speech-to-text settings for audio input. */
export interface RealtimeInputAudioTranscription {
  /** STT model key (same as `transcription_model`). */
  model?: string;
  /** ISO-639-1 language hint, e.g. `tr`. */
  language?: string;
  /** Vocabulary / style prompt passed to the STT model. */
  prompt?: string | null;
}

/** Who speaks first when the session (or call) starts. */
export type RealtimeFirstSpeaker = 'agent' | 'user';

/**
 * What the agent says first.
 *
 * - `none` — say nothing until the user speaks.
 * - `static` — speak `text` verbatim (`{{variables}}` are filled in).
 * - `generate` — the agent receives `instructions` as a hidden user turn
 *   (plus the caller's first words when the user spoke first) and generates
 *   the greeting itself.
 */
export interface RealtimeFirstMessage {
  mode: 'none' | 'static' | 'generate';
  /** `static`: the text to speak. */
  text?: string;
  /** `generate`: hidden instruction turn for the agent. */
  instructions?: string;
  /** Whether a barge-in may cut the greeting short (default true). */
  interruptible?: boolean;
}

/** A first message as the server echoes it (all fields present). */
export interface RealtimeFirstMessageView {
  mode: 'none' | 'static' | 'generate';
  text: string | null;
  instructions: string | null;
  interruptible: boolean;
}

/** Agent version an agent-backed session runs: `published` (default), `draft`, or a version number. */
export type RealtimeAgentVersion = 'published' | 'draft' | number;

/** `{{name}}` template variables — filled into instructions / first message and forwarded to agents. */
export type RealtimeVariables = Record<string, string>;

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
  /** Agent sessions: which agent version runs (default `published`, falling back to the draft when nothing is published). */
  agent_version?: RealtimeAgentVersion;
  /** System prompt prepended to the conversation. Supports `{{variables}}`. */
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  /** STT model key used for audio turns. Same as `input_audio_transcription.model`. */
  transcription_model?: string;
  /** STT model, language and prompt. */
  input_audio_transcription?: RealtimeInputAudioTranscription | null;
  /** `batch` (speculative transcription on pauses, default) or `streaming` (when the STT provider supports it). */
  stt_mode?: 'batch' | 'streaming';
  /** Format of the input audio (default `pcm16`). */
  input_audio_format?: RealtimeAudioFormat;
  /** `pcm16` input sample rate (default 24000). */
  input_audio_sample_rate?: RealtimeAudioSampleRate;
  /** Output audio format (default `pcm16`). */
  output_audio_format?: RealtimeOutputAudioFormat;
  /** `pcm16` output sample rate (default 24000). */
  output_audio_sample_rate?: RealtimeAudioSampleRate;
  /**
   * `json` (default): output audio arrives base64 in `response.audio.delta`.
   * `binary`: output audio arrives as binary WebSocket frames (less overhead);
   * the sentence text comes first as `response.audio_transcript.delta`.
   */
  audio_transport?: 'json' | 'binary';
  /** Server turn detection (default `{ type: 'semantic_vad' }`); `null` = manual commit (push-to-talk). */
  turn_detection?: RealtimeTurnDetection | null;
  /** TTS model key; when set, responses are also synthesized to audio. */
  tts_model?: string;
  /** TTS voice id. Optional — the provider falls back to its default voice. */
  voice?: string;
  /** Who speaks first. `agent` starts the first message right after this update is applied. */
  first_speaker?: RealtimeFirstSpeaker;
  /** What the agent says first. */
  first_message?: RealtimeFirstMessage | null;
  /** `first_speaker: 'user'`: greet anyway after this much silence (ms). */
  wait_for_user_ms?: number | null;
  /**
   * `{{name}}` template variables for `instructions` / `first_message`; also
   * forwarded to agents as `runtime_context.metadata.variables`.
   */
  variables?: RealtimeVariables;
  /**
   * Agent sessions: filler line sent on `response.tool_call.started` (and
   * spoken, when TTS is configured) the first time the agent starts calling
   * tools within a response.
   */
  tool_status_message?: string;
  /**
   * Agent sessions: play a soft, generated "waiting" sound through the normal
   * audio output while the agent runs tools, until the answer audio is ready
   * (default `false`). Independent of `tool_status_message` — with both set,
   * the filler line is spoken first, then the sound plays.
   */
  tool_wait_audio?: boolean;
  /**
   * Downstream auth/data for agent tool calls (see {@link RuntimeContext}).
   * Re-send to refresh short-lived tokens mid-session; `null` clears it.
   */
  runtime_context?: RuntimeContext | null;
}

/** Overrides for `response.create`. */
export interface RealtimeResponseCreate {
  /** Chat sessions: instructions for this response only. */
  instructions?: string;
  /** Text appended as a user item before responding (one round-trip instead of two). */
  input?: string;
  /** Run the first-message logic now (greeting on demand). */
  first_message?: boolean;
}

// ── Server events ─────────────────────────────────────────────────────────

/** Any event emitted by the realtime server. */
export interface RealtimeServerEvent {
  type:
    | 'session.created'
    | 'session.updated'
    | 'session.ended'
    | 'conversation.item.created'
    | 'conversation.item.input_audio_transcription.delta'
    | 'input_audio_buffer.speech_started'
    | 'input_audio_buffer.speech_stopped'
    | 'input_audio_buffer.cleared'
    | 'input_audio_buffer.committed'
    | 'output_audio_buffer.cleared'
    | 'response.created'
    | 'response.output_text.delta'
    | 'response.output_text.done'
    | 'response.tool_call.started'
    | 'response.tool_call.completed'
    | 'response.audio.delta'
    | 'response.audio_transcript.delta'
    | 'response.audio.done'
    | 'response.metrics'
    | 'response.done'
    | 'error'
    | string;
  event_id?: string;
  [key: string]: unknown;
}

/** Fields shared by every typed server event. */
export interface RealtimeServerEventBase<T extends string> {
  type: T;
  event_id?: string;
}

/** The session as echoed by `session.created` / `session.updated` (effective config, every field present). */
export interface RealtimeSessionView {
  id: string;
  model: string | null;
  agent_key: string | null;
  instructions: string | null;
  temperature: number | null;
  max_output_tokens: number | null;
  transcription_model: string | null;
  input_audio_format: RealtimeAudioFormat;
  /** Input rate: the `pcm16` rate, 8000 for G.711. */
  input_audio_sample_rate: number;
  tts_model: string | null;
  voice: string | null;
  output_audio_format: RealtimeOutputAudioFormat;
  /** Output rate: the `pcm16` rate, 8000 for G.711. */
  output_audio_sample_rate: number;
  /** `binary` only when the transport can send binary frames (the server may downgrade to `json`). */
  audio_transport: 'json' | 'binary';
  /** Effective turn detection; `null` = manual commit. */
  turn_detection: RealtimeTurnDetectionView | null;
  input_audio_transcription: { model: string; language: string | null; prompt: string | null } | null;
  stt_mode: 'batch' | 'streaming';
  first_speaker: RealtimeFirstSpeaker;
  first_message: RealtimeFirstMessageView | null;
  wait_for_user_ms: number | null;
  /** Names of the `{{variables}}` set on the session. Values are never echoed back. */
  variable_keys: string[];
  /** Agent sessions only (`null` for chat-model sessions). */
  agent_version: RealtimeAgentVersion | null;
  /**
   * Why server turn detection runs below full quality — e.g. energy VAD /
   * silence-only endpointing while the ONNX models are still loading or
   * unavailable — or `null`. Re-sent in `session.updated` whenever it changes.
   */
  degraded: string | null;
  tool_status_message: string | null;
  tool_wait_audio: boolean;
  /** Header NAMES only — values never go back over the wire. */
  runtime_context: { header_keys: string[]; connections: string[] } | null;
}

export interface RealtimeSessionCreatedEvent extends RealtimeServerEventBase<'session.created'> {
  session: RealtimeSessionView;
}

export interface RealtimeSessionUpdatedEvent extends RealtimeServerEventBase<'session.updated'> {
  session: RealtimeSessionView;
}

/** The server is ending the session (e.g. the phone call hung up); the socket closes next. */
export interface RealtimeSessionEndedEvent extends RealtimeServerEventBase<'session.ended'> {
  reason: 'call_ended' | (string & {});
}

export interface RealtimeConversationItemCreatedEvent extends RealtimeServerEventBase<'conversation.item.created'> {
  item: { id: string; role: 'user' | 'system' | 'assistant'; content: string };
}

/** Partial transcript of the user's current turn (`stt_mode: 'streaming'` only). */
export interface RealtimeInputTranscriptionDeltaEvent
  extends RealtimeServerEventBase<'conversation.item.input_audio_transcription.delta'> {
  item_id: string;
  delta: string;
}

/** Server VAD heard the user start talking. While the agent speaks, duck playback — a sustained barge-in follows with `output_audio_buffer.cleared`. */
export interface RealtimeSpeechStartedEvent extends RealtimeServerEventBase<'input_audio_buffer.speech_started'> {
  /** Position in the input audio clock (ms since the session's first input sample). */
  audio_start_ms: number;
  item_id: string;
}

/** The user's turn ended: the end-of-turn decision is made and the transcript follows in `input_audio_buffer.committed`. Not sent for a pause inside a turn. */
export interface RealtimeSpeechStoppedEvent extends RealtimeServerEventBase<'input_audio_buffer.speech_stopped'> {
  audio_end_ms: number;
  item_id: string;
}

export type RealtimeInputAudioBufferClearedEvent = RealtimeServerEventBase<'input_audio_buffer.cleared'>;

/** Why a user turn ended. `manual` = `input_audio_buffer.commit`. */
export type RealtimeTurnEndReason = 'semantic' | 'silence' | 'max_silence' | 'max_duration' | 'manual';

/** A user turn was committed and transcribed. */
export interface RealtimeInputAudioBufferCommittedEvent extends RealtimeServerEventBase<'input_audio_buffer.committed'> {
  item_id?: string;
  /**
   * Set when the caller resumed speaking before hearing any answer to the
   * previous turn: both utterances were transcribed together, and this
   * transcript replaces that item's (drop it from your transcript view).
   */
  continues_item_id?: string | null;
  transcript: string;
  language: string | null;
  /** Audio duration in seconds. */
  duration: number | null;
  /** Turn details. A manual commit carries `reason: 'manual'` with null metrics. */
  turn: {
    reason: RealtimeTurnEndReason;
    /** Smart Turn's end-of-turn probability; null on manual commits and silence-only endpointing. */
    endpoint_probability?: number | null;
    /** Last speech → end-of-turn decision; null on manual commits. */
    detection_ms?: number | null;
  };
}

/** Flush queued playback NOW — the response was interrupted (barge-in). */
export interface RealtimeOutputAudioBufferClearedEvent extends RealtimeServerEventBase<'output_audio_buffer.cleared'> {
  response_id: string;
}

export interface RealtimeResponseCreatedEvent extends RealtimeServerEventBase<'response.created'> {
  response: { id: string };
}

export interface RealtimeOutputTextDeltaEvent extends RealtimeServerEventBase<'response.output_text.delta'> {
  response_id: string;
  delta: string;
}

export interface RealtimeOutputTextDoneEvent extends RealtimeServerEventBase<'response.output_text.done'> {
  response_id: string;
  text: string;
}

export interface RealtimeToolCallStartedEvent extends RealtimeServerEventBase<'response.tool_call.started'> {
  response_id: string;
  tool: string;
  call_id: string | null;
  /** The session's `tool_status_message`, when set. */
  message: string | null;
}

export interface RealtimeToolCallCompletedEvent extends RealtimeServerEventBase<'response.tool_call.completed'> {
  response_id: string;
  tool: string;
  call_id: string | null;
  status: 'success' | 'error' | (string & {});
}

/**
 * One ~100 ms frame of response audio (base64) in the session's
 * `output_audio_format`; `text` (the chunk being spoken) rides on the first
 * frame of each chunk only. Prefer `connection.onAudio()`, which decodes this
 * and binary frames alike.
 */
export interface RealtimeAudioDeltaEvent extends RealtimeServerEventBase<'response.audio.delta'> {
  response_id: string;
  audio: string;
  format: RealtimeOutputAudioFormat;
  sample_rate: number;
  /** e.g. `audio/L16;rate=24000`, `audio/PCMU;rate=8000`. */
  content_type: string;
  text?: string;
}

/** The sentence being spoken (sent before its audio; with `audio_transport: 'binary'` it precedes the binary frames). */
export interface RealtimeAudioTranscriptDeltaEvent extends RealtimeServerEventBase<'response.audio_transcript.delta'> {
  response_id: string;
  delta: string;
}

export interface RealtimeAudioDoneEvent extends RealtimeServerEventBase<'response.audio.done'> {
  response_id: string;
}

/**
 * Per-turn latency breakdown (milliseconds). Every field is optional: the ones measured from the
 * user's speech (`turn_detection_ms`, `stt_*`, `e2e_ms`, `total_ms`) exist only when the response
 * followed detected user speech — not for the agent's own greeting, typed text, or a response created
 * after a push-to-talk commit — and `llm_*` are absent when no model ran (a `static` first message).
 */
export interface RealtimeResponseMetrics {
  /** Last user speech → end-of-turn decision. */
  turn_detection_ms?: number;
  stt_ms?: number;
  /** The speculative transcript (started on the pause) was reused. */
  stt_speculative_hit?: boolean;
  llm_first_token_ms?: number;
  llm_total_ms?: number;
  tts_first_byte_ms?: number;
  /** User speech end (VAD) → first output audio byte sent. The headline latency. Only for turns that followed detected user speech. */
  e2e_ms?: number;
  /** User speech end (VAD) → response done. Only for turns that followed detected user speech. */
  total_ms?: number;
}

export interface RealtimeResponseMetricsEvent extends RealtimeServerEventBase<'response.metrics'> {
  response_id: string;
  /** The user turn this response answers; null for text, greeting and other non-audio responses. */
  item_id?: string | null;
  metrics: RealtimeResponseMetrics;
}

export interface RealtimeResponseDoneEvent extends RealtimeServerEventBase<'response.done'> {
  response_id: string;
  status: 'completed' | 'cancelled' | 'failed' | 'blocked';
  usage?: Record<string, number> | null;
  error?: { message: string; code?: string; findings?: unknown };
  /** Cancelled by a barge-in. */
  interrupted?: boolean;
  /** Audio the user actually heard before the interruption, when known. */
  played_ms?: number;
}

/**
 * Request-level error. `code` examples: `invalid_audio`, `generator_locked`, `config_missing`,
 * `quota_exceeded`; `forbidden` — a `session.update` named another agent, model or agent version
 * without the `agents` / `models` write permission (the session goes on); `event_too_large` — a
 * non-audio event over 256 KB was dropped (the session goes on). While the session is being
 * set up the same event carries the reason the connection is refused and is followed by a close:
 * `unauthorized` (4401), `license_required` (4402), `server_busy` (1013).
 */
export interface RealtimeErrorEvent extends RealtimeServerEventBase<'error'> {
  error: { message: string; code?: string };
}

/** Server event type → typed payload. `connection.on(type, cb)` infers from this map. */
export interface RealtimeServerEventMap {
  'session.created': RealtimeSessionCreatedEvent;
  'session.updated': RealtimeSessionUpdatedEvent;
  'session.ended': RealtimeSessionEndedEvent;
  'conversation.item.created': RealtimeConversationItemCreatedEvent;
  'conversation.item.input_audio_transcription.delta': RealtimeInputTranscriptionDeltaEvent;
  'input_audio_buffer.speech_started': RealtimeSpeechStartedEvent;
  'input_audio_buffer.speech_stopped': RealtimeSpeechStoppedEvent;
  'input_audio_buffer.cleared': RealtimeInputAudioBufferClearedEvent;
  'input_audio_buffer.committed': RealtimeInputAudioBufferCommittedEvent;
  'output_audio_buffer.cleared': RealtimeOutputAudioBufferClearedEvent;
  'response.created': RealtimeResponseCreatedEvent;
  'response.output_text.delta': RealtimeOutputTextDeltaEvent;
  'response.output_text.done': RealtimeOutputTextDoneEvent;
  'response.tool_call.started': RealtimeToolCallStartedEvent;
  'response.tool_call.completed': RealtimeToolCallCompletedEvent;
  'response.audio.delta': RealtimeAudioDeltaEvent;
  'response.audio_transcript.delta': RealtimeAudioTranscriptDeltaEvent;
  'response.audio.done': RealtimeAudioDoneEvent;
  'response.metrics': RealtimeResponseMetricsEvent;
  'response.done': RealtimeResponseDoneEvent;
  error: RealtimeErrorEvent;
}

/** Union of every typed server event. */
export type RealtimeTypedServerEvent = RealtimeServerEventMap[keyof RealtimeServerEventMap];

/**
 * One decoded chunk of response audio, from either transport
 * (`response.audio.delta` JSON or a binary frame).
 */
export interface RealtimeAudioChunk {
  /** Response the audio belongs to (`null` if a binary frame arrived before any response id was seen). */
  responseId: string | null;
  /** Wire format of `bytes`. */
  format: RealtimeOutputAudioFormat;
  /** Samples per second of `bytes` / `pcm`. */
  sampleRate: number;
  /** MIME type of `bytes` (e.g. `audio/L16;rate=24000`). */
  contentType: string;
  /** Raw audio bytes as received. */
  bytes: Uint8Array;
  /** Decoded 16-bit PCM samples (G.711 is decoded too). */
  pcm: Int16Array;
  /** Sentence text, on the first chunk of each sentence. */
  text?: string;
  transport: 'json' | 'binary';
}

// ============================================================================
// Realtime telephony (outbound calls)
// ============================================================================

/** Twilio call status, as reported by status callbacks. */
export type RealtimeCallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'no-answer'
  | 'failed'
  | 'canceled'
  | (string & {});

export interface RealtimeCallCreateRequest {
  /** Number to call, E.164 (`+905551234567`). */
  to: string;
  /** Realtime model (preset) key that runs the conversation. The preset needs STT, TTS and a telephony connection. */
  model: string;
  /** Caller id, E.164. Defaults to the telephony connection's number. */
  from?: string;
  /** `{{name}}` template variables for the preset's instructions / first message. */
  variables?: RealtimeVariables;
  /**
   * Overrides the preset's first message for this call. `interruptible` is honoured — `false`
   * protects a mandatory disclosure from barge-in — and a message that does not set it keeps the
   * preset's value.
   */
  first_message?: RealtimeFirstMessage;
  /** Outbound default: `user` (wait for "Hello?" / `wait_for_user_ms`, then greet). */
  first_speaker?: RealtimeFirstSpeaker;
  /** Twilio answering-machine detection: `true` = `Enable`, or a Twilio `MachineDetection` value. */
  machine_detection?: boolean | 'Enable' | 'DetectMessageEnd';
  /**
   * Telephony connection key to dial out through. Default: the preset's
   * `telephony.connection_key`, else the project's only active connection
   * (400 when several exist and none is named).
   */
  connection?: string;
  /**
   * Seconds to let it ring before giving up (Twilio `Timeout`, 5–240; Twilio
   * default 60). Capped below the 5-minute life of the call's stream token.
   */
  ring_timeout_sec?: number;
}

/** A message sent into a running realtime session from outside its socket. */
export interface RealtimeSessionMessageRequest {
  /** The text (at most 4000 characters). */
  content: string;
  /**
   * Whether the assistant answers it. Default `true`; `false` adds it to the
   * conversation silently (the assistant sees it on its next turn).
   */
  respond?: boolean;
  /**
   * `'when_idle'` (default) queues the answer behind the one in flight; if the
   * caller speaks first the answer is dropped, though the text stays in the
   * conversation. `'now'` interrupts the current answer.
   */
  mode?: 'now' | 'when_idle';
  /** Who is speaking, shown to the assistant ("Notification from <label>"). Default `external system`. */
  label?: string;
  /** Makes a retry safe: the same key within 10 minutes adds the message once. */
  idempotencyKey?: string;
}

export interface RealtimeSessionMessage {
  object: 'realtime.session.message';
  /** Conversation item id of the added message. */
  id: string;
  session_id: string;
  /** `true` when the assistant has been asked to answer it. */
  response_queued: boolean;
  /** `true` when `idempotencyKey` had been seen: nothing was added again. */
  replayed: boolean;
}

/**
 * A telephony call and its realtime session — the same shape from
 * `calls.create`, `calls.get` and `calls.hangup`.
 */
export interface RealtimeCall {
  /** Call id (= `session_id`). */
  id: string;
  object: 'realtime.call';
  /** Realtime session id — use it with `calls.get` / `calls.hangup` and the session logs. */
  session_id: string;
  /** Twilio Call SID (`CA…`), once Twilio accepted the call. */
  call_sid: string | null;
  status: RealtimeCallStatus;
  direction: 'inbound' | 'outbound';
  from: string | null;
  to: string | null;
  /** Twilio AMD result (`human`, `machine_start`, …) when machine detection ran. */
  answered_by: string | null;
  duration_sec: number | null;
  /** Telephony connection the call went through. */
  connection_key: string | null;
  /** Realtime model (preset) key running the conversation. */
  realtime_model: string | null;
  /**
   * Realtime session status: `pending` (media not connected yet), `active`, `ended`, `error`.
   * `calls.create` answers `pending`, like a `calls.get` right after it.
   */
  session_status: 'pending' | 'active' | 'ended' | 'error' | (string & {}) | null;
  /** ISO timestamps of the session. `calls.create` already carries `started_at` (the moment the call was placed). */
  started_at: string | null;
  ended_at: string | null;
}

// ============================================================================
// Realtime models (named session presets)
// ============================================================================

/** Preset telephony settings as the server returns them (unset = `null`). */
export interface RealtimeModelTelephonyView {
  connection_key: string | null;
  from_number: string | null;
  inbound_enabled: boolean | null;
  outbound_first_speaker: RealtimeFirstSpeaker | null;
}

/** Preset telephony settings. */
export interface RealtimeModelTelephony {
  /** Telephony (Twilio) connection key used for outbound calls / inbound routing. */
  connection_key?: string | null;
  /** Default caller id, E.164. */
  from_number?: string | null;
  /** Answer inbound calls to the connection's number with this preset. */
  inbound_enabled?: boolean;
  /** Who speaks first on outbound calls (default `user`). */
  outbound_first_speaker?: RealtimeFirstSpeaker;
}

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
  tts_model_key: string | null;
  voice: string | null;
  /** Agent presets: filler line announced/spoken while the agent calls tools. */
  tool_status_message: string | null;
  /** Agent presets: soft hold sound while the agent runs tools (default `false`). */
  tool_wait_audio: boolean;
  /** `null` = not set (sessions default to `pcm16`). */
  output_audio_format: RealtimeOutputAudioFormat | null;
  /**
   * Absent = not set on the preset (sessions default to `semantic_vad`);
   * `null` = manual commit. Writing a retrieved preset back therefore never
   * changes it.
   */
  turn_detection?: RealtimeTurnDetectionView | null;
  stt_mode: 'batch' | 'streaming' | null;
  stt_language: string | null;
  /** STT vocabulary / spelling hints (brand and product names); `null` = none. */
  stt_prompt: string | null;
  first_speaker: RealtimeFirstSpeaker | null;
  first_message: RealtimeFirstMessageView | null;
  wait_for_user_ms: number | null;
  interrupt_min_ms: number | null;
  /** Agent presets: the stored version, `published` when none is stored; `null` for chat-model presets. */
  agent_version: RealtimeAgentVersion | null;
  telephony: RealtimeModelTelephonyView | null;
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
  /** Agent presets: which agent version runs (default `published`). */
  agent_version?: RealtimeAgentVersion;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  /** STT model key — required for voice input / telephony. */
  stt_model_key?: string;
  /** STT language hint, e.g. `tr`. */
  stt_language?: string;
  /**
   * STT vocabulary / spelling hints — brand, product and person names the
   * transcriber should spell correctly (e.g. `"Cognipeer, Pulse"`). Max 1000
   * characters; sessions use it as `input_audio_transcription.prompt`.
   */
  stt_prompt?: string;
  stt_mode?: 'batch' | 'streaming';
  /** TTS model key — required for spoken responses / telephony. */
  tts_model_key?: string;
  /** Optional — the TTS provider falls back to its default voice. */
  voice?: string;
  /** Default output format for sessions on this preset (default `pcm16`). */
  output_audio_format?: RealtimeOutputAudioFormat;
  turn_detection?: RealtimeTurnDetection | null;
  /** Shortcut for `turn_detection.interrupt_min_ms`. */
  interrupt_min_ms?: number;
  first_speaker?: RealtimeFirstSpeaker;
  first_message?: RealtimeFirstMessage;
  wait_for_user_ms?: number;
  telephony?: RealtimeModelTelephony;
  /** Agent presets: filler line announced/spoken while the agent calls tools. */
  tool_status_message?: string;
  /** Agent presets: soft hold sound while the agent runs tools until the answer starts (default `false`). */
  tool_wait_audio?: boolean;
  metadata?: Record<string, unknown>;
}

/** Optional preset fields an update may clear by sending `null`. */
export type RealtimeModelClearableField =
  | 'description' | 'instructions' | 'temperature' | 'max_output_tokens' | 'stt_model_key'
  | 'tts_model_key' | 'voice' | 'tool_status_message'
  | 'stt_mode' | 'stt_language' | 'stt_prompt' | 'first_speaker' | 'first_message' | 'wait_for_user_ms'
  | 'interrupt_min_ms' | 'agent_version' | 'output_audio_format' | 'telephony';

/**
 * `first_message` in an update. Merged into the stored message sub-field by
 * sub-field: a key you leave out keeps its value and a `null` removes just
 * that one (so the `null`s of a retrieved {@link RealtimeFirstMessageView}
 * write back unchanged). `mode` is required in the merged result — send it
 * when the preset has no first message yet. Send `first_message: null` to clear
 * the whole message.
 */
export interface UpdateRealtimeFirstMessage {
  mode?: RealtimeFirstMessage['mode'];
  text?: string | null;
  instructions?: string | null;
  interruptible?: boolean | null;
}

/**
 * `telephony` in an update. Merged into the stored settings sub-field by
 * sub-field, like {@link UpdateRealtimeFirstMessage}: a key you leave out keeps
 * its value and a `null` (or `''`) removes just that one. `telephony: null`
 * clears all of it.
 */
export interface UpdateRealtimeModelTelephony {
  connection_key?: string | null;
  from_number?: string | null;
  inbound_enabled?: boolean | null;
  outbound_first_speaker?: RealtimeFirstSpeaker | null;
}

/**
 * `turn_detection` in an update: the object you send replaces the preset's
 * whole setting (nothing is merged with the stored one), and one without a
 * `type` means `semantic_vad`.
 */
export type UpdateRealtimeTurnDetection =
  Omit<RealtimeTurnDetection, 'type'> & { type?: RealtimeTurnDetection['type'] };

/**
 * Fields of a retrieved {@link RealtimeModel} that an update ignores (they are
 * read-only), accepted so a retrieved preset can be sent back as it is:
 * `models.update(id, { ...retrieved, name })`.
 */
export interface RealtimeModelReadOnlyFields {
  id?: string | null;
  object?: 'realtime.model';
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Partial update: absent fields stay as they are; `null` clears an optional
 * field (e.g. `{ voice: null }` → the TTS provider's default voice;
 * `{ turn_detection: null }` → manual commit).
 *
 * - `first_message` / `telephony` are merged sub-field by sub-field (a `null`
 *   sub-field removes that key); every other field is replaced as a whole —
 *   `turn_detection` included: the object you send IS the new setting, and one
 *   without a `type` means `semantic_vad`.
 * - A retrieved preset writes back unchanged (`{ ...retrieved, name }`): the
 *   view shapes (`null` sub-fields, a fully populated `turn_detection`) and the
 *   read-only keys are accepted, and so is a `null` `chat_model_key` /
 *   `agent_key` (a preset has one generator, so the other reads `null`): it is
 *   ignored, as if the key were left out. Setting one generator replaces the
 *   other.
 */
export type UpdateRealtimeModelRequest =
  Partial<Omit<
    CreateRealtimeModelRequest,
    'key' | RealtimeModelClearableField | 'chat_model_key' | 'agent_key' | 'turn_detection'
  >>
  & { [K in Exclude<RealtimeModelClearableField, 'first_message' | 'telephony'>]?: CreateRealtimeModelRequest[K] | null }
  & RealtimeModelReadOnlyFields
  & {
    status?: 'active' | 'disabled';
    chat_model_key?: string | null;
    agent_key?: string | null;
    turn_detection?: UpdateRealtimeTurnDetection | RealtimeTurnDetectionView | null;
    first_message?: UpdateRealtimeFirstMessage | null;
    telephony?: UpdateRealtimeModelTelephony | null;
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
  /** Port preview enabled for this sandbox (default true). */
  previewEnabled?: boolean;
  /** Allow public (session-less share-link) preview; default false = private. */
  previewPublic?: boolean;
  /** Override the template's resource limits. */
  resources?: { cpuCores?: number; memoryMb?: number; diskMb?: number; pids?: number };
}

export interface SandboxPreviewPort {
  port: number;
  label?: string;
  /** Authenticated proxy URL (path on the console origin). */
  url: string;
}

export interface SandboxPreviewInfo {
  /** Per-sandbox: preview turned on at all. */
  enabled: boolean;
  /** Per-sandbox: public (share-link) access allowed vs private (login only). */
  public: boolean;
  /** Suggested/labelled ports with their proxy URLs. */
  ports: SandboxPreviewPort[];
  /**
   * ANY port can be previewed, not just `ports` — the platform provisions an
   * on-demand forwarder for ports outside the published set. Build the URL for
   * an arbitrary port with `sandbox.previewUrl(id, port)`.
   */
  allPorts?: boolean;
  /** Public share links possible (per-sandbox public AND SANDBOX_PREVIEW_SECRET). */
  sharingEnabled: boolean;
  /** True when the sandbox has network blocked (preview unavailable). */
  blocked: boolean;
}

export interface SandboxListeningPort {
  port: number;
  /** Bound only to 127.0.0.1/::1 — restart the service on 0.0.0.0 to preview it. */
  loopbackOnly: boolean;
  label?: string;
  /** Authenticated proxy URL (path on the console origin). */
  url: string;
}

export interface SandboxPreviewShareLink {
  token: string;
  port: number;
  expiresAt: string;
  /** Public, session-less share URL (path on the console origin). */
  url: string;
}

export interface SandboxSummary {
  id: string;
  name?: string;
  status: SandboxStatus;
  /** Effective resource limits (present on `get`). */
  resources?: { cpuCores?: number; memoryMb?: number; diskMb?: number; pids?: number } | null;
  /** Port-preview metadata (present on `get`). */
  preview?: SandboxPreviewInfo;
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
  /** Override the snapshot's captured CPU/RAM/Disk limits. */
  resources?: { cpuCores?: number; memoryMb?: number; diskMb?: number; pids?: number };
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

/** A streaming file download from `sandbox.fs.download()`. */
export interface SandboxFileDownload {
  /** Exact file size in bytes, as announced by the server before the body. */
  size: number;
  contentType: string;
  /** File name from Content-Disposition, when present. */
  filename?: string;
  /** The raw file bytes. Errors (never ends short) if the transfer breaks. */
  body: ReadableStream<Uint8Array>;
}

export interface SandboxDownloadOptions {
  signal?: AbortSignal;
  /**
   * Client-side cap for `downloadBytes()`: a file announced larger than this
   * is refused before its body is read. The server enforces its own limit
   * (413 `too-large`) regardless.
   */
  maxBytes?: number;
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

// ============================================================================
// Web Search Types
// ============================================================================

export type WebSearchSafeSearch = 'off' | 'moderate' | 'strict';

export interface WebSearchRequest {
  /** Search query text. */
  query: string;
  /**
   * Instance key configured in the Console. Omit only when the project has a
   * single active instance; with multiple instances the request fails.
   */
  provider?: string;
  /** Max results to return (default 10, max 50). */
  count?: number;
  /** Result offset / paging hint where the provider supports it. */
  offset?: number;
  /** ISO language override (falls back to provider settings). */
  language?: string;
  /** Country/market override (falls back to provider settings). */
  country?: string;
  /** Safe-search override (falls back to provider settings). */
  safe_search?: WebSearchSafeSearch;
  /**
   * Interpret the results with the instance's configured AI model and return
   * a synthesized `answer`. Fails if AI answers are not enabled on the
   * instance (Configuration → AI Answer in the Console).
   */
  include_answer?: boolean;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  /** 1-based rank within this response. */
  position: number;
  /** ISO date string when the provider exposes one. */
  published_at?: string;
  /** Origin engine when the provider is a metasearch (SearxNG). */
  source?: string;
  /** Provider-native relevance score when available. */
  score?: number;
}

export interface WebSearchResponse {
  id: string;
  /** Provider key that served the request. */
  provider: string;
  /** Driver behind the provider (bing, brave-search, serper, tavily, searxng, duckduckgo). */
  driver: string;
  query: string;
  /** Synthesized answer — AI interpretation or provider-native (Tavily, Serper answer box). */
  answer?: string;
  /** Model key when the answer was produced by the instance's AI model. */
  answer_model?: string;
  results: WebSearchResultItem[];
  latency_ms: number;
}

export interface WebSearchProvider {
  key: string;
  driver: string;
  label: string;
  status: 'active' | 'disabled' | 'errored';
  /** True when AI answers are enabled on this instance. */
  aiAnswer: boolean;
}

// ── Aegis (enforcement plane) — DEPRECATED ───────────────────────────────────
/**
 * The Aegis enforcement plane has been REMOVED from the Console:
 * `/api/client/v1/aegis/*` no longer exists and `client.aegis.*` throws a
 * migration error instead of issuing a request.
 *
 * These types are kept exported so 1.x builds keep compiling, and are removed
 * in the next major. The replacements:
 *
 * | Aegis                          | Guardrails                                   |
 * | ------------------------------ | -------------------------------------------- |
 * | shield                         | guardrail (`client.guardrails.list()`)        |
 * | `shieldId`                     | `guardrail_key`                               |
 * | `stage`                        | `hook` — `tool.pre` / `tool.post` /           |
 * |                                | `input.pre` / `output.pre` keep their names   |
 * | `resource.name` / `.arguments` | `tool_name` / `tool_args` (`tool_result` on   |
 * |                                | `tool.post`)                                  |
 * | `AegisEvaluation`              | {@link GuardrailHookEvaluateResponse}         |
 * | `decision` + `enforced`        | same names — read them with `shouldBlock()`   |
 *
 * `retrieval.pre` and `retrieval.post` have no hook and no replacement.
 */


/** @deprecated Aegis is removed from the Console. Hook ids replace stages: `tool.pre`, `tool.post`, `input.pre` and `output.pre` carry over unchanged as {@link HookId}; `retrieval.pre` / `retrieval.post` have no equivalent. Removed in the next major. */
export type AegisStage =
  | 'input.pre'
  | 'retrieval.pre'
  | 'retrieval.post'
  | 'tool.pre'
  | 'tool.post'
  | 'output.pre';

/** @deprecated Aegis is removed from the Console. Use {@link SafetyAction} (`allow` | `flag` | `warn` | `redact` | `block`). `require_approval` and `sandbox` have no equivalent. Removed in the next major. */
export type AegisDecision = 'allow' | 'redact' | 'require_approval' | 'sandbox' | 'block';

/** Shield lifecycle: enforce = binding, simulate = observe-only, disabled = pass-through.
 *  @deprecated Aegis is removed from the Console. Use {@link GuardrailMode} — `simulate` is now spelled `monitor`. Removed in the next major. */
export type AegisShieldMode = 'enforce' | 'simulate' | 'disabled';

/** @deprecated Aegis is removed from the Console. Use {@link GuardrailSideEffect}. Removed in the next major. */
export type AegisSideEffect = 'none' | 'read' | 'write' | 'destructive' | 'external';

/** @deprecated Aegis is removed from the Console. Fold into {@link GuardrailToolAccessPolicyConfig} (`maxArgBytes` / `maxResultBytes`); the per-minute rate limits have no equivalent. Removed in the next major. */
export interface AegisToolLimits {
  perActorPerMinute?: number;
  perToolPerMinute?: number;
  maxArgBytes?: number;
  maxResultBytes?: number;
}

/** @deprecated Aegis is removed from the Console. Use {@link GuardrailToolAccessPolicyConfig}. Removed in the next major. */
export interface AegisToolRule {
  allow?: string[];
  deny?: string[];
  sideEffects?: Record<string, AegisSideEffect>;
  allowedRoles?: Record<string, string[]>;
  allowedDomains?: string[];
  /** Deny wins over allow and also matches subdomains. */
  deniedDomains?: string[];
  allowedPathPrefixes?: string[];
  deniedPathPrefixes?: string[];
  argumentSchemas?: Record<string, unknown>;
  limits?: AegisToolLimits;
}

/** @deprecated Aegis is removed from the Console. Use {@link GuardrailCustomPolicyConfig} or {@link GuardrailModerationPolicyConfig}. Removed in the next major. */
export interface AegisJudgeConfig {
  enabled: boolean;
  stages: AegisStage[];
  threshold: number;
  failMode: 'open' | 'closed';
  onlyHighRisk: boolean;
}

/** @deprecated Aegis is removed from the Console. A shield is a guardrail — use {@link GuardrailListItem} / {@link Guardrail}. Removed in the next major. */
export interface AegisShield {
  id: string;
  name: string;
  description?: string;
  mode: AegisShieldMode;
  rules: AegisToolRule;
  dlp: { redactSecrets: boolean; redactPii: boolean; semantic?: boolean };
  llm?: { modelKey?: string; judge?: AegisJudgeConfig };
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Aegis is removed from the Console. Use {@link GuardrailHookEvaluateParams}. Removed in the next major. */
export interface AegisEvaluateRequest {
  /** Pipeline stage being evaluated. */
  stage: AegisStage;
  /** Who is making the call. */
  actor: { id: string; roles?: string[] };
  /** The tool call / content under evaluation. */
  resource: {
    type: string;
    name: string;
    arguments?: Record<string, unknown>;
    content?: unknown;
    result?: unknown;
  };
  /** Target shield; defaults to the built-in `default` shield. */
  shieldId?: string;
  /** Optional trace correlation id (one is generated when omitted). */
  traceId?: string;
  context?: {
    projectId?: string;
    model?: string;
    agent?: string;
    /** Token minted by an approved `require_approval` decision. */
    approvalToken?: string;
    /** When true, side-effectful calls decide `sandbox` instead of `require_approval`. */
    sandboxAvailable?: boolean;
    [key: string]: unknown;
  };
}

/** @deprecated Aegis is removed from the Console. Use {@link SafetyFinding}. Removed in the next major. */
export interface AegisFinding {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  path?: string;
}

/** @deprecated Aegis is removed from the Console. Use {@link GuardrailHookEvaluateResponse} (or {@link HookVerdict}); decide with `shouldBlock()`. Removed in the next major. */
export interface AegisEvaluation {
  traceId: string;
  shieldId: string;
  shieldMode: AegisShieldMode;
  decision: AegisDecision;
  /** False when the shield is simulating/disabled — the decision is advisory. */
  enforced: boolean;
  riskScore: number;
  reasons: string[];
  policyVersion: string;
  findings: AegisFinding[];
  mutations: Array<{ path: string; action: 'redact' | 'remove'; replacement?: string }>;
  /** The resource with sensitive values redacted — execute with THIS, not the original. */
  sanitizedResource?: AegisEvaluateRequest['resource'];
  /** Present on `require_approval`: approve in the Console, then re-run with `context.approvalToken`. */
  approval?: { approvalId: string; expiresAt: string; scope: 'call_bound' };
}

/** @deprecated Aegis is removed from the Console. No replacement on the client API — guardrail decisions are evaluation logs read in the Console dashboard, correlated by `trace_id`. Removed in the next major. */
export interface AegisAuditEvent {
  traceId: string;
  shieldId: string;
  actorId: string;
  stage: AegisStage;
  resourceName: string;
  decision: AegisDecision;
  riskScore: number;
  reasons: string[];
  policyVersion: string;
  at: string;
}

// ============================================================================
// Analytics API (read-only usage time-series / dashboard rollup)
// ============================================================================

export type AnalyticsUsageGroupBy = 'model' | 'user' | 'token' | 'service';
export type AnalyticsUsageInterval = 'hour' | 'day' | 'month';

export interface AnalyticsUsageQuery {
  /** ISO date — start of the reporting window. */
  from?: string;
  /** ISO date — end of the reporting window. */
  to?: string;
  /** Dimension to break usage down by. Defaults to 'model'. */
  group_by?: AnalyticsUsageGroupBy;
  /** Time-series bucket granularity (only used when group_by='model'). Defaults to 'day'. */
  interval?: AnalyticsUsageInterval;
  /** Restrict to a single model key. */
  model?: string;
}

export interface AnalyticsUsageModelEntry {
  model_key: string;
  model_name: string | null;
  category: string | null;
  provider_key: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface AnalyticsUsageTimeseriesPoint {
  period: string;
  calls: number;
  total_tokens: number;
  cost: number;
}

export interface AnalyticsUsageModelTotals {
  cost: number;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface AnalyticsUsageModelResponse {
  object: 'analytics.usage';
  group_by: 'model';
  interval: AnalyticsUsageInterval;
  from: string | null;
  to: string | null;
  currency: string;
  totals: AnalyticsUsageModelTotals;
  by_model: AnalyticsUsageModelEntry[];
  timeseries: AnalyticsUsageTimeseriesPoint[];
}

export interface AnalyticsUsageBreakdownTotals {
  requests: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface AnalyticsUsageServiceEntry {
  service: string;
  requests: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface AnalyticsUsageServiceResponse {
  object: 'analytics.usage';
  group_by: 'service';
  from: string | null;
  to: string | null;
  currency: string;
  totals: AnalyticsUsageBreakdownTotals;
  breakdown: AnalyticsUsageServiceEntry[];
}

export interface AnalyticsUsageEntityEntry {
  /** Present when group_by='user'. */
  user_id?: string;
  /** Present when group_by='token'. */
  api_token_id?: string;
  name: string | null;
  label: string | null;
  requests: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface AnalyticsUsageEntityResponse {
  object: 'analytics.usage';
  group_by: 'user' | 'token';
  from: string | null;
  to: string | null;
  currency: string;
  totals: AnalyticsUsageBreakdownTotals;
  breakdown: AnalyticsUsageEntityEntry[];
}

/** Response of `client.analytics.usage()` — shape depends on `group_by`. */
export type AnalyticsUsageResponse =
  | AnalyticsUsageModelResponse
  | AnalyticsUsageServiceResponse
  | AnalyticsUsageEntityResponse;

export interface AnalyticsOverviewQuery {
  /** ISO date — start of the reporting window. */
  from?: string;
  /** ISO date — end of the reporting window. */
  to?: string;
}

export interface AnalyticsOverviewStats {
  models: {
    total: number;
    llm: number;
    embedding: number;
  };
  vectors: {
    providers: number;
    indexes: number;
  };
  tracing: {
    totalSessions: number;
    totalTokens: number;
    activeSessions: number;
  };
  apiCalls: {
    total: number;
    /** Percentage change week-over-week. */
    trend: number;
  };
}

export interface AnalyticsOverviewSession {
  sessionId: string;
  agentName?: string;
  status?: string;
  /** ISO timestamp. */
  startedAt?: string;
  durationMs?: number;
  totalEvents?: number;
  totalTokens: number;
}

export interface AnalyticsOverviewDailyPoint {
  date: string;
  sessionsCount: number;
  totalTokens: number;
}

export interface AnalyticsOverviewResponse {
  object: 'analytics.overview';
  stats: AnalyticsOverviewStats;
  recent_sessions: AnalyticsOverviewSession[];
  daily: AnalyticsOverviewDailyPoint[];
}

// ============================================================================
// Tracing threads (read-only — sessions grouped by threadId)
// ============================================================================

export interface ListTracingThreadsQuery {
  /** Filter by agent name (case-insensitive substring). */
  agent?: string;
  /** Filter by the thread's latest status. */
  status?: string;
  /** Filter by thread id (case-insensitive substring). */
  threadId?: string;
  /** ISO date — start of the window (matched against thread start). */
  from?: string;
  /** ISO date — end of the window. */
  to?: string;
  /** Max threads to return. Defaults to 50 server-side. */
  limit?: number;
  /** Number of threads to skip (pagination). */
  skip?: number;
}

export interface TracingThreadSummary {
  threadId: string;
  sessionsCount: number;
  agents: string[];
  statuses: string[];
  latestStatus: string;
  /** ISO timestamp. */
  startedAt?: string;
  /** ISO timestamp. */
  endedAt?: string;
  totalEvents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  modelsUsed: string[];
}

export interface TracingThreadListResponse {
  threads: TracingThreadSummary[];
  total: number;
}

export interface TracingThreadSession {
  sessionId: string;
  agentName?: string;
  agentVersion?: string;
  status?: string;
  /** ISO timestamp. */
  startedAt?: string;
  /** ISO timestamp. */
  endedAt?: string;
  durationMs?: number;
  totalEvents?: number;
  totalTokens: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  modelsUsed?: string[];
  toolsUsed?: string[];
}

export interface TracingThreadDetail {
  threadId: string;
  status: string;
  agents: string[];
  sessionsCount: number;
  /** ISO timestamp. */
  startedAt?: string;
  /** ISO timestamp. */
  endedAt?: string;
  totalDurationMs: number;
  totalEvents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  modelsUsed: string[];
  toolsUsed: string[];
  sessions: TracingThreadSession[];
}

// ============================================================================
// Audit API (read-only security / administrative trail)
// ============================================================================

export type AuditOutcome = 'success' | 'failure' | 'denied';
export type AuditActorType = 'user' | 'api_token' | 'system';

export interface ListAuditLogsQuery {
  /** Filter by action level (e.g. read / write / security). */
  action?: string;
  /** Filter by acting user id. */
  actorUserId?: string;
  /** ISO date — start of the window. */
  from?: string;
  /** ISO date — end of the window. */
  to?: string;
  /** Filter by HTTP method (case-insensitive). */
  method?: string;
  /** Filter by outcome. */
  outcome?: AuditOutcome;
  /** Free-text match against event, path, and actor email. */
  q?: string;
  /** Filter by service. */
  service?: string;
  /** Max logs to return (server caps at 1000). Defaults to 100. */
  limit?: number;
  /** Number of logs to skip (pagination). */
  skip?: number;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  projectId?: string;
  requestId?: string;
  actorType: AuditActorType;
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  apiTokenId?: string;
  service: string;
  action: string;
  event: string;
  method?: string;
  path?: string;
  statusCode?: number;
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  /** ISO timestamp. */
  createdAt?: string;
}

export interface AuditLogListResponse {
  object: 'list';
  data: AuditLog[];
}

// ============================================================================
// Monitoring API (read-only inference-server metrics summary)
// ============================================================================

export type InferenceServerStatus = 'active' | 'disabled' | 'errored';
export type InferenceServerType = 'vllm' | 'llamacpp';

export interface MonitoringInferenceQuery {
  /** ISO date — start of the window. */
  from?: string;
  /** ISO date — end of the window. */
  to?: string;
}

export interface MonitoringInferenceOverview {
  active_servers: number;
  avg_gpu_cache_usage: number | null;
  disabled_servers: number;
  errored_servers: number;
  running_models_count: number;
  total_running_requests: number;
  total_servers: number;
  total_waiting_requests: number;
}

export interface MonitoringInferenceServerMetrics {
  generation_tokens_throughput?: number;
  gpu_cache_usage_percent?: number;
  num_requests_running?: number;
  num_requests_waiting?: number;
  prompt_tokens_throughput?: number;
  requests_per_second?: number;
  running_models: string[];
  time_to_first_token_seconds?: number;
  /** ISO timestamp. */
  timestamp: string;
}

export interface MonitoringInferenceServer {
  key: string;
  name: string;
  type: InferenceServerType;
  status: InferenceServerStatus;
  last_error: string | null;
  /** ISO timestamp. */
  last_polled_at: string | null;
  latest_metrics: MonitoringInferenceServerMetrics | null;
}

export interface MonitoringInferenceTypeBreakdown {
  count: number;
  type: string;
}

export interface MonitoringInferenceResponse {
  object: 'monitoring.inference';
  overview: MonitoringInferenceOverview;
  servers: MonitoringInferenceServer[];
  type_breakdown: MonitoringInferenceTypeBreakdown[];
}

// ============================================================================
// Authoring Types (create / update definitions via client v1)
// ============================================================================

// ── Agents ──────────────────────────────────────────────────────────────

/** Connected ("external") agent config — proxies to another provider. */
export interface AgentConnectionConfig {
  kind: 'external';
  connection: Record<string, unknown>;
}

/** Agent definition config accepted when creating / updating an agent. */
export type AgentDefinitionConfig = AgentConfig | AgentConnectionConfig;

export interface AgentCreateRequest {
  name: string;
  description?: string;
  config: AgentDefinitionConfig;
  status?: AgentStatus;
}

export interface AgentUpdateRequest {
  name?: string;
  description?: string;
  config?: AgentDefinitionConfig;
  status?: AgentStatus;
  metadata?: Record<string, unknown>;
}

export interface AgentPublishRequest {
  changelog?: string;
}

/** A published agent version returned by `agents.publish()`. */
export interface AgentVersion {
  version: number;
  changelog?: string;
  createdBy?: string;
  createdAt?: string;
  [key: string]: unknown;
}

// ── Tools ───────────────────────────────────────────────────────────────

export type ToolType = 'openapi' | 'mcp';

export interface ToolCreateRequest {
  name: string;
  type: ToolType;
  description?: string;
  /** OpenAPI JSON/YAML or a Postman collection (type 'openapi'). */
  openApiSpec?: string;
  /** How to interpret `openApiSpec` (default: auto-detect). */
  specFormat?: string;
  upstreamBaseUrl?: string;
  upstreamAuth?: Record<string, unknown>;
  /** MCP endpoint URL (type 'mcp'). */
  mcpEndpoint?: string;
  mcpTransport?: 'sse' | 'streamable-http';
}

export interface ToolUpdateRequest {
  name?: string;
  description?: string;
  status?: string;
  openApiSpec?: string;
  specFormat?: string;
  upstreamBaseUrl?: string;
  upstreamAuth?: Record<string, unknown>;
  mcpEndpoint?: string;
  mcpTransport?: 'sse' | 'streamable-http';
}

// ── MCP servers ─────────────────────────────────────────────────────────

export type McpSourceType = 'openapi' | 'remote' | 'stdio';
export type McpServerAuthType = 'none' | 'token' | 'header' | 'basic';

export interface McpServerAuthConfig {
  type: McpServerAuthType;
  [key: string]: unknown;
}

export interface McpRemoteConfig {
  url: string;
  transport?: 'sse' | 'streamable-http';
}

export interface McpStdioConfig {
  runtime?: 'npx' | 'uvx';
  packageName: string;
  args?: string[];
  env?: Record<string, string>;
  executionMode?: 'subprocess' | 'sandbox';
  sandbox?: {
    templateKey?: string;
    resources?: { cpuCores?: number; memoryMb?: number };
  };
}

export interface McpExposureConfig {
  protocols: Array<'streamable-http' | 'sse'>;
  accessMode: 'token' | 'public';
}

/**
 * Guardrail binding for an MCP server's tool calls.
 *
 * `mode` keeps the MCP vocabulary (`'off'`, not `'disabled'`) so this and the
 * deprecated `aegis` field are drop-in interchangeable during the release where
 * both are written; the Console folds `'off'` onto its own `GuardrailMode`.
 *
 * An OMITTED `guardrailKey` is not "no guardrail" — it selects the tenant's
 * default tool guardrail, which is what keeps a server armed with no per-server
 * setup. To turn enforcement off, send `mode: 'off'`.
 */
export interface McpGuardrailConfig {
  /** A guardrail KEY. Omit to use the tenant's default tool guardrail. */
  guardrailKey?: string;
  mode: 'off' | 'monitor' | 'enforce';
}

/**
 * @deprecated Superseded by {@link McpGuardrailConfig}. Kept because every
 * stored MCP server row still carries this object and the Console still writes
 * the column, so a client that reads `server.aegis` keeps working.
 *
 * `shieldId` values are already dead references — the Console's read-time
 * normaliser keeps only `mode` and falls back to the default tool guardrail.
 * Send `guardrail` instead; where both are sent, `guardrail` wins.
 */
export interface McpAegisConfig {
  /** @deprecated Dead reference — shields no longer exist. Use
   *  {@link McpGuardrailConfig.guardrailKey}. */
  shieldId?: string;
  mode: 'off' | 'monitor' | 'enforce';
}

/** A tenant-configured MCP server definition (secrets masked). */
export interface McpServer {
  id: string;
  tenantId: string;
  projectId?: string;
  key: string;
  name: string;
  description?: string;
  sourceType: McpSourceType;
  tools: McpToolDescriptor[];
  /** Tool names hidden from callers. */
  disabledTools: string[];
  upstreamBaseUrl?: string;
  upstreamAuth: McpServerAuthConfig;
  remoteConfig?: McpRemoteConfig;
  stdioConfig?: McpStdioConfig;
  exposure: McpExposureConfig;
  /** The guardrail bound to this server's tool calls. */
  guardrail?: McpGuardrailConfig;
  /** @deprecated Read `guardrail`. Still served for older clients. */
  aegis?: McpAegisConfig;
  status: string;
  endpointSlug: string;
  totalRequests?: number;
  metadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpServerCreateRequest {
  name: string;
  description?: string;
  /** Tool source (default 'openapi'). */
  sourceType?: McpSourceType;
  /** OpenAPI JSON/YAML or a Postman collection (sourceType 'openapi'). */
  openApiSpec?: string;
  specFormat?: string;
  upstreamAuth: McpServerAuthConfig;
  upstreamBaseUrl?: string;
  remoteConfig?: McpRemoteConfig;
  stdioConfig?: McpStdioConfig;
  exposure?: McpExposureConfig;
  guardrail?: McpGuardrailConfig;
  /** @deprecated Send `guardrail`. Accepted for one more release; where both
   *  are sent, `guardrail` wins. */
  aegis?: McpAegisConfig;
}

export interface McpServerUpdateRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'disabled';
  openApiSpec?: string;
  specFormat?: string;
  upstreamAuth?: McpServerAuthConfig;
  upstreamBaseUrl?: string;
  remoteConfig?: McpRemoteConfig;
  stdioConfig?: McpStdioConfig;
  exposure?: McpExposureConfig;
  guardrail?: McpGuardrailConfig;
  /** @deprecated Send `guardrail`. Accepted for one more release; where both
   *  are sent, `guardrail` wins. */
  aegis?: McpAegisConfig;
  /** Runtime-header passthrough policy (`null` clears it). */
  runtimeHeaders?: { allow?: boolean; allowedNames?: string[] } | null;
  disabledTools?: string[];
}

// ── Prompts ─────────────────────────────────────────────────────────────

export interface PromptCreateRequest {
  name: string;
  template: string;
  key?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  /** Comment attached to the first version. */
  versionComment?: string;
  /** Alias for `versionComment`. */
  comment?: string;
}

export interface PromptUpdateRequest {
  name?: string;
  template?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  /** Comment attached to the newly-created version. */
  versionComment?: string;
  /** Alias for `versionComment`. */
  comment?: string;
}

export interface SetPromptVersionRequest {
  /** Id of the existing version to make latest. */
  versionId: string;
}

// ── Guardrails ──────────────────────────────────────────────────────────

export type GuardrailType = 'preset' | 'custom';

/** A guardrail definition. */
export interface Guardrail {
  id: string;
  tenantId: string;
  projectId?: string;
  key: string;
  name: string;
  description?: string;
  type: GuardrailType;
  target: GuardrailTarget;
  action: GuardrailAction;
  enabled: boolean;
  failMode?: 'open' | 'closed';
  modelKey?: string;
  policy?: Record<string, unknown>;
  customPrompt?: string;
  /** The v2 hook plane. Absent on records written before it shipped. */
  hooks?: GuardrailHooksConfig;
  /** 0 / absent = `hooks` was DERIVED from the legacy columns on read and is
   *  re-derived on every read; >= 1 = an operator authored it. */
  hooksVersion?: number;
  /** Absent = derived from `enabled` (`'enforce'` when on, `'disabled'` when
   *  off). The list endpoint resolves this for you as `effectiveMode`. */
  mode?: GuardrailMode;
  createdBy: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuardrailCreateRequest {
  name: string;
  type: GuardrailType;
  action?: GuardrailAction;
  description?: string;
  enabled?: boolean;
  failMode?: 'open' | 'closed';
  modelKey?: string;
  policy?: Record<string, unknown>;
  /** Required for `type: 'custom'` — the LLM-evaluated rule. */
  customPrompt?: string;
  /**
   * The v2 hook configuration. When present the legacy `target`/`action`/
   * `policy` columns are DERIVED from it, so the two descriptions of one policy
   * can never be saved disagreeing.
   */
  hooks?: GuardrailHooksConfig;
  /** Set to >= 1 to mark `hooks` as authored, i.e. used verbatim instead of
   *  re-derived from the legacy columns on every read. */
  hooksVersion?: number;
  /** Enforcement posture. `'monitor'` evaluates and logs but neutralises the
   *  decision — see {@link HookVerdict.enforced}. */
  mode?: GuardrailMode;
}

export interface GuardrailUpdateRequest {
  name?: string;
  action?: GuardrailAction;
  description?: string;
  enabled?: boolean;
  failMode?: 'open' | 'closed';
  modelKey?: string;
  policy?: Record<string, unknown>;
  customPrompt?: string;
  /** Omit to leave the stored hook configuration untouched. */
  hooks?: GuardrailHooksConfig;
  hooksVersion?: number;
  mode?: GuardrailMode;
}

/** Filters for `client.guardrails.list(...)`. Tenant and project come from the
 *  API token — there is no `project_id` parameter. */
export interface GuardrailListQuery {
  enabled?: boolean;
  type?: GuardrailType;
  search?: string;
}

/** What a listed guardrail says about its hook plane. */
export interface GuardrailHooksSummary {
  contractVersion: number;
  /** False = this configuration was DERIVED from the legacy columns on read,
   *  and will be re-derived on the next one. */
  authored: boolean;
  /**
   * The hooks `guardrails.hooks.evaluate` will actually evaluate against this
   * guardrail — its binding is enabled AND an enabled policy dispatches on it.
   * A hook outside this list answers with a vacuous allow (`disabled: true`).
   */
  servable: HookId[];
  bindings: Partial<
    Record<
      HookId,
      {
        enabled: boolean;
        timing: 'sync' | 'async';
        onFail: 'block' | 'log';
        failMode?: 'open' | 'closed';
        timeoutMs?: number;
      }
    >
  >;
  /**
   * WHAT runs, never HOW it is configured. The Console whitelists these fields,
   * so a webhook policy's `url`, `headers` and credential references are never
   * served here — read them from the dashboard.
   */
  policies: Array<{
    id: string;
    family: GuardrailPolicyFamily;
    enabled: boolean;
    label?: string;
    hooks: HookId[];
    action?: SafetyAction;
  }>;
  stream: { enabled: boolean; holdBackChars?: number } | null;
}

/**
 * A guardrail as `list()` returns it: the create/update serialisation minus
 * the authored `hooks` blob (which can carry credentials), plus what a caller
 * needs to know what it can ask of the guardrail.
 *
 * Safe to hand straight back to `update()` — an absent `hooks` leaves the
 * stored configuration untouched.
 */
export interface GuardrailListItem extends Omit<Guardrail, 'hooks'> {
  /** `mode` with `enabled` folded in, by the rule the engine itself applies. A
   *  legacy record has no `mode`, so reading it raw cannot tell "unset,
   *  therefore enforcing" from "not enforcing". */
  effectiveMode: GuardrailMode;
  hooksSummary: GuardrailHooksSummary;
}

// ── RAG modules ─────────────────────────────────────────────────────────

export interface RagModuleCreateRequest {
  name: string;
  embeddingModelKey: string;
  vectorProviderKey: string;
  vectorIndexKey: string;
  chunkConfig: RagChunkConfig;
  key?: string;
  description?: string;
  fileBucketKey?: string;
  fileProviderKey?: string;
  metadata?: Record<string, unknown>;
  rerankerKey?: string;
  rerankerOversample?: number;
}

export interface RagModuleUpdateRequest {
  name?: string;
  description?: string;
  embeddingModelKey?: string;
  vectorProviderKey?: string;
  vectorIndexKey?: string;
  chunkConfig?: RagChunkConfig;
  fileBucketKey?: string;
  fileProviderKey?: string;
  metadata?: Record<string, unknown>;
  rerankerKey?: string;
  rerankerOversample?: number;
  status?: string;
}

// ── Rerankers ───────────────────────────────────────────────────────────

export type RerankerStrategy =
  | 'dedicated-model'
  | 'llm-judge'
  | 'llm-listwise'
  | 'heuristic';

export interface RerankerConfig {
  modelKey?: string;
  topN?: number;
  scoreThreshold?: number;
  batchSize?: number;
  temperature?: number;
  promptTemplate?: string;
  scoreNormalization?: 'none' | 'minmax';
  heuristicWeights?: {
    keyword?: number;
    recency?: number;
    originalScore?: number;
  };
}

export interface RerankerCreateRequest {
  name: string;
  strategy: RerankerStrategy;
  config: RerankerConfig;
  key?: string;
  description?: string;
  status?: 'active' | 'disabled';
  metadata?: Record<string, unknown>;
}

export interface RerankerUpdateRequest {
  name?: string;
  description?: string;
  strategy?: RerankerStrategy;
  config?: RerankerConfig;
  status?: 'active' | 'disabled';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// PII Types
// ============================================================================

export type PiiAction = 'detect' | 'redact' | 'mask' | 'block' | 'tokenize';
export type PiiLanguage =
  | 'global' | 'en' | 'tr' | 'de' | 'fr' | 'es'
  | 'it' | 'pt' | 'ar' | 'ja' | 'zh';
export type PiiSeverity = 'low' | 'medium' | 'high';

/** A tenant-defined custom regex pattern within a PII policy. */
export interface PiiCustomPattern {
  id: string;
  categoryId: string;
  label: string;
  labels?: Partial<Record<PiiLanguage, string>>;
  pattern: string;
  flags?: string;
  languages?: PiiLanguage[];
  severity?: PiiSeverity;
  enabled: boolean;
}

/** A reusable PII policy definition. */
export interface PiiPolicy {
  id: string;
  tenantId: string;
  projectId?: string;
  key: string;
  name: string;
  description?: string;
  defaultAction: PiiAction;
  categories: Record<string, boolean>;
  customPatterns?: PiiCustomPattern[];
  languages?: PiiLanguage[];
  enabled: boolean;
  metadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PiiPolicyCreateRequest {
  name: string;
  description?: string;
  defaultAction?: PiiAction;
  categories?: Record<string, boolean>;
  customPatterns?: PiiCustomPattern[];
  languages?: PiiLanguage[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PiiPolicyUpdateRequest {
  name?: string;
  description?: string;
  defaultAction?: PiiAction;
  categories?: Record<string, boolean>;
  customPatterns?: PiiCustomPattern[];
  languages?: PiiLanguage[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PiiFinding {
  category: string;
  source: 'builtin' | 'custom';
  severity: PiiSeverity;
  value: string;
  start: number;
  end: number;
  label: string;
  message: string;
  action: PiiAction;
  block: boolean;
  replacement: string;
}

export interface PiiVaultEntry {
  value: string;
  category: string;
}

/** Token -> original-value mapping returned by tokenize; pass back to detokenize. */
export type PiiVault = Record<string, PiiVaultEntry>;

export interface PiiScanRequest {
  policy_key: string;
  text: string;
  locale?: PiiLanguage;
  /** Only honored by `scan()` — overrides the policy's default action. */
  action?: PiiAction;
}

export interface PiiScanResponse {
  policy_key: string;
  policy_name: string;
  action: PiiAction;
  findings: PiiFinding[];
  output_text: string;
  input_length: number;
  has_blocking: boolean;
  languages: PiiLanguage[];
  /** Present only for `tokenize` (or scan with action 'tokenize'). */
  vault?: PiiVault;
}

export interface PiiDetokenizeRequest {
  text: string;
  vault: PiiVault;
}

export interface PiiDetokenizeResponse {
  output_text: string;
}
