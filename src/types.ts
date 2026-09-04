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
  /** Free-form attribution tags reported alongside `agent` (e.g. `{ complexity: 'complex' }`),
   *  usable as a dynamic `group_by`/`group_by_entity=metadata.<key>` dimension in spend/analytics. */
  metadata?: Record<string, string>;
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
  /** Runtime context (downstream headers/metadata) for this invocation */
  runtime_context?: RuntimeContext;
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
  /** IANA zone, e.g. `Europe/Istanbul`. */
  timezoneId?: string;
  maxLifetimeMs?: number;
  idleTimeoutMs?: number;
  actionTimeoutMs?: number;
  navigationTimeoutMs?: number;
  access?: BrowserAccessRules;
  /** Route the session through an egress proxy. */
  proxy?: { server: string; username?: string; password?: string; bypass?: string };
  extraHTTPHeaders?: Record<string, string>;
  httpCredentials?: { username: string; password: string };
  /** Off by default — an automated browser that accepts files is an ingest path. */
  acceptDownloads?: boolean;
  /** DANGER: disables TLS verification. */
  ignoreHTTPSErrors?: boolean;
  /** How `alert` / `confirm` / `prompt` are answered. An unanswered dialog blocks the page. */
  dialogPolicy?: 'accept' | 'dismiss';
  /** Cookies + origin storage to start from (a Playwright storageState export). */
  storageState?: Record<string, unknown>;
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

/**
 * How an action names the element it acts on.
 *
 * TWO CLASSES OF FIELD. `ref` is VOLATILE: it is a marker the browser mints
 * for one `snapshot()` and renumbers on the next, so it addresses an element
 * only within the turn that produced it. Everything else is DURABLE — it
 * describes the element the way a person would ("the button labelled Sign
 * in") and still resolves after a re-render or a deploy.
 *
 * A live script uses `ref`. Anything SAVED — a flow step, a fixture — must
 * use the durable fields; `resolvedTarget` on every action result hands you
 * exactly that for whatever the action just touched.
 */
export interface BrowserTarget {
  /** Volatile aria marker from the most recent snapshot. Never save this. */
  ref?: string;
  /** ARIA role, paired with `name`. */
  role?: string;
  /** Accessible name. Exact unless `nameContains` is set. */
  name?: string;
  nameContains?: boolean;
  /** `data-testid` value — the most durable target when the app provides one. */
  testId?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  /** CSS selector. Last resort: breaks on markup changes. */
  selector?: string;
  /** Disambiguates when the chosen strategy matches several elements. */
  nth?: number;
  /** CSS selector of an iframe to resolve inside. */
  frame?: string | string[];
}

export type BrowserTargetStrategy =
  | 'ref' | 'testId' | 'role' | 'label' | 'placeholder' | 'text' | 'selector';

export interface BrowserActionGoto {
  type: 'goto';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}
export interface BrowserActionClick extends BrowserTarget {
  type: 'click';
  button?: 'left' | 'right' | 'middle';
  clickCount?: 1 | 2;
  timeout?: number;
}
export interface BrowserActionHover extends BrowserTarget {
  type: 'hover';
  timeout?: number;
}
export interface BrowserActionType extends BrowserTarget {
  type: 'type';
  text: string;
  delay?: number;
  clear?: boolean;
  /** Press Enter after typing. */
  submit?: boolean;
  timeout?: number;
}
export interface BrowserActionPress extends BrowserTarget {
  type: 'press';
  key: string;
  timeout?: number;
}
export interface BrowserActionSelect extends BrowserTarget {
  type: 'select';
  values?: string[];
  labels?: string[];
  timeout?: number;
}
export interface BrowserActionCheck extends BrowserTarget {
  type: 'check';
  /** false unchecks. Idempotent either way, unlike a click. */
  checked?: boolean;
  timeout?: number;
}
export interface BrowserActionUpload extends BrowserTarget {
  type: 'upload';
  /** Files-service ids, not filesystem paths. */
  fileIds: string[];
  timeout?: number;
}
export interface BrowserActionDrag {
  type: 'drag';
  from: BrowserTarget;
  to: BrowserTarget;
  timeout?: number;
}
export interface BrowserActionHistory {
  type: 'back' | 'forward' | 'reload';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}
export interface BrowserActionWait {
  type: 'wait';
  ms?: number;
  text?: string;
  selector?: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}
export interface BrowserActionScroll extends BrowserTarget {
  type: 'scroll';
  x?: number;
  y?: number;
  timeout?: number;
}
export interface BrowserActionTab {
  type: 'tab';
  op: 'list' | 'new' | 'switch' | 'close';
  index?: number;
  url?: string;
}
export type BrowserAction =
  | BrowserActionGoto
  | BrowserActionClick
  | BrowserActionHover
  | BrowserActionType
  | BrowserActionPress
  | BrowserActionSelect
  | BrowserActionCheck
  | BrowserActionUpload
  | BrowserActionDrag
  | BrowserActionHistory
  | BrowserActionWait
  | BrowserActionScroll
  | BrowserActionTab;

export interface BrowserActionResult {
  ok: boolean;
  url?: string;
  pageTitle?: string;
  ariaSnapshot?: string;
  /**
   * DURABLE description of the element the action actually hit — save this,
   * not the `ref` you passed in.
   */
  resolvedTarget?: BrowserTarget;
  targetStrategy?: BrowserTargetStrategy;
  tabs?: Array<{ index: number; url: string; title?: string; active: boolean }>;
  artifact?: BrowserArtifactRef;
  errorMessage?: string;
}

export interface BrowserExtractInput extends BrowserTarget {
  mode?: 'text' | 'html' | 'attr' | 'value';
  attribute?: string;
  multiple?: boolean;
}

export interface BrowserExtractResult {
  ok: boolean;
  values: string[];
  resolvedTarget?: BrowserTarget;
  errorMessage?: string;
}

export interface BrowserFindResult {
  ok: boolean;
  matches: Array<{ text: string; target: BrowserTarget }>;
  errorMessage?: string;
}

export interface BrowserObservations {
  console: Array<{ type: string; text: string; at: string }>;
  networkFailures: Array<{ url: string; method?: string; failure?: string; at: string }>;
  lastDialog?: { type: string; message: string; action: string; at: string };
}

export interface BrowserSnapshotResult {
  ariaSnapshot: string;
  url: string;
}

export interface BrowserArtifactResult {
  artifact: BrowserArtifactRef;
  eventId: string;
}

export interface BrowserScreenshotInput extends BrowserTarget {
  fullPage?: boolean;
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
  /**
   * Non-secret description of the attached signed-in profile.
   *
   * The profile itself (cookies + origin storage) is encrypted server-side
   * and is never returned — upload it with `browsers.setProfile`.
   */
  storageStateMeta?: BrowserProfileSummary;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrowserProfileSummary {
  uploadedAt: string;
  uploadedBy?: string;
  cookieCount: number;
  origins: string[];
  /** Earliest cookie expiry — warn before a profile goes stale. */
  earliestExpiry?: string;
  sourceFileName?: string;
}

// ── Browser flows (record once, replay deterministically) ───────────────

export type BrowserFlowStatus = 'draft' | 'active' | 'disabled';
export type BrowserFlowRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type BrowserFlowTrigger = 'manual' | 'agent' | 'api' | 'schedule';

export interface BrowserFlowInput {
  name: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
  required?: boolean;
  /** Never set for `secret` — a default would be a credential in the flow. */
  default?: string | number | boolean;
  description?: string;
}

export interface BrowserFlowStepPolicy {
  /** Attempts beyond the first. Default 0. */
  retries?: number;
  /** Delay between attempts (ms), doubling. Default 500. */
  retryDelayMs?: number;
  timeoutMs?: number;
  /** A failing optional step is recorded and skipped instead of aborting. */
  optional?: boolean;
}

export interface BrowserFlowStep {
  id: string;
  label?: string;
  /** A BrowserAction payload — with no volatile `ref`; the API rejects one. */
  action: Record<string, unknown>;
  /** Store this step's output under a name, for `{{step.name}}` later. */
  captureAs?: string;
  policy?: BrowserFlowStepPolicy;
  /** Skip the step unless this expression is truthy. */
  when?: string;
}

export interface BrowserFlow {
  id: string;
  tenantId: string;
  projectId?: string;
  key: string;
  name: string;
  description?: string;
  status: BrowserFlowStatus;
  browserId: string;
  inputs?: BrowserFlowInput[];
  steps: BrowserFlowStep[];
  sessionConfig?: BrowserSessionConfig;
  recordedFromSessionId?: string;
  /** Bumped on every step change; a run pins the version it executed. */
  version: number;
  lastRun?: { runId: string; status: BrowserFlowRunStatus; startedAt: string; durationMs?: number };
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrowserFlowStepResult {
  stepId: string;
  index: number;
  status: 'succeeded' | 'failed' | 'skipped';
  attempts: number;
  durationMs?: number;
  url?: string;
  action?: Record<string, unknown>;
  captured?: unknown;
  artifact?: BrowserArtifactRef;
  errorMessage?: string;
}

export interface BrowserFlowRun {
  id: string;
  tenantId: string;
  projectId?: string;
  flowId: string;
  flowKey: string;
  flowVersion: number;
  status: BrowserFlowRunStatus;
  trigger: BrowserFlowTrigger;
  sessionId?: string;
  sessionKey?: string;
  /** Non-secret inputs only; `secret` parameters are never persisted. */
  inputs?: Record<string, unknown>;
  stepResults?: BrowserFlowStepResult[];
  outputs?: Record<string, unknown>;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  failedStepIndex?: number;
  createdBy?: string;
  createdAt?: string;
}

export interface BrowserFlowCreateInput {
  key?: string;
  name: string;
  description?: string;
  status?: BrowserFlowStatus;
  browserId: string;
  inputs?: BrowserFlowInput[];
  steps?: Array<Partial<BrowserFlowStep> & { action: Record<string, unknown> }>;
  sessionConfig?: BrowserSessionConfig;
  metadata?: Record<string, unknown>;
}

export type BrowserFlowUpdateInput = Partial<BrowserFlowCreateInput>;

export interface BrowserFlowRecordInput {
  /** The driven session to turn into steps. */
  sessionId: string;
  name: string;
  key?: string;
  description?: string;
  /** Defaults to `draft` so a recording is reviewed before anything runs it. */
  status?: 'draft' | 'active';
  excludeTypes?: string[];
}

export interface BrowserFlowRunInput {
  inputs?: Record<string, string | number | boolean>;
  /** Keep the session open on failure, for debugging. */
  keepSessionOpen?: boolean;
  maxSteps?: number;
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
  /** Free-form attribution tags reported alongside `agent` (e.g. `{ complexity: 'complex' }`),
   *  usable as a dynamic `group_by`/`group_by_entity=metadata.<key>` dimension in spend/analytics. */
  metadata?: Record<string, string>;
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
  /**
   * Agent sessions: filler line sent on `response.tool_call.started` (and
   * spoken, when TTS is configured) the first time the agent starts calling
   * tools within a response.
   */
  tool_status_message?: string;
  /**
   * Downstream auth/data for agent tool calls (see {@link RuntimeContext}).
   * Re-send to refresh short-lived tokens mid-session; `null` clears it.
   */
  runtime_context?: RuntimeContext | null;
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
    | 'response.tool_call.started'
    | 'response.tool_call.completed'
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
  /** Agent presets: filler line announced/spoken while the agent calls tools. */
  tool_status_message: string | null;
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
  /** Agent presets: filler line announced/spoken while the agent calls tools. */
  tool_status_message?: string;
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
