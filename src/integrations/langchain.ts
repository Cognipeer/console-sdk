import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseChatModel, BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import { BaseLanguageModelCallOptions } from '@langchain/core/language_models/base';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from '@langchain/core/outputs';
import { AgentMiddleware, createMiddleware } from 'langchain';
import { ConsoleClient } from '../client';
import {
  ConsoleClientOptions,
  ChatCompletionRequest,
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatMessage,
  ChatRole,
  ToolCall,
  TracingAgent,
  TracingEvent,
  TracingSessionRequest,
  TracingSummary,
  Usage,
} from '../types';

/**
 * LangChain call options accepted by the Cognipeer chat model.
 */
export type CognipeerChatCallOptions = BaseLanguageModelCallOptions &
  Partial<Omit<ChatCompletionRequest, 'model' | 'messages'>>;

export interface CognipeerLangChainChatModelParams extends BaseChatModelParams {
  /** Target model name on Cognipeer Console. */
  model: string;
  /** SDK client or configuration used to build one. */
  client: ConsoleClient | ConsoleClientOptions;
  /** Default temperature applied when omitted per-call. */
  temperature?: number;
  /** Default top_p applied when omitted per-call. */
  topP?: number;
  /** Default max_tokens applied when omitted per-call. */
  maxTokens?: number;
  /** Default presence_penalty applied when omitted per-call. */
  presencePenalty?: number;
  /** Default frequency_penalty applied when omitted per-call. */
  frequencyPenalty?: number;
  /** Default tool_choice applied when omitted per-call. */
  toolChoice?: ChatCompletionRequest['tool_choice'];
}

/**
 * LangChain chat model that proxies to Cognipeer Console chat completions.
 */
export class CognipeerLangChainChatModel extends BaseChatModel<CognipeerChatCallOptions> {
  lc_serializable = false;

  private client: ConsoleClient;
  private model: string;
  private defaults: Partial<Omit<ChatCompletionRequest, 'model' | 'messages'>>;

  constructor(params: CognipeerLangChainChatModelParams) {
    super(params);
    this.client = params.client instanceof ConsoleClient ? params.client : new ConsoleClient(params.client);
    this.model = params.model;
    this.defaults = {
      temperature: params.temperature,
      top_p: params.topP,
      max_tokens: params.maxTokens,
      presence_penalty: params.presencePenalty,
      frequency_penalty: params.frequencyPenalty,
      tool_choice: params.toolChoice,
    };
  }

  _llmType(): string {
    return 'cognipeer-chat';
  }

  /** Generate a non-streaming chat response. */
  async _generate(
    messages: BaseMessage[],
    options?: CognipeerChatCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const payload: ChatCompletionRequest & { stream?: false } = {
      ...this.buildBasePayload(messages, options),
      stream: false,
    };
    const response = (await this.client.chat.completions.create(payload)) as ChatCompletionResponse;
    const choice = response.choices[0];
    const message = choice?.message;

    const aiMessage = new AIMessage({
      content: message?.content ?? '',
      additional_kwargs: message?.tool_calls ? { tool_calls: message.tool_calls } : undefined,
    });

    const generation: ChatGeneration = {
      text: message?.content ?? '',
      message: aiMessage,
      generationInfo: {
        finish_reason: choice?.finish_reason,
        request_id: response.request_id,
        model: response.model,
        usage: response.usage,
      },
    };

    const llmOutput = {
      tokenUsage: this.mapUsage(response.usage),
      model: response.model,
      requestId: response.request_id,
    } as const;

    // Surface the final token for callbacks when present.
    if (runManager && message?.content) {
      await runManager.handleLLMNewToken?.(message.content);
    }

    return { generations: [generation], llmOutput };
  }

  /** Stream chat response chunks. */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: CognipeerChatCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const payload: ChatCompletionRequest & { stream: true } = {
      ...this.buildBasePayload(messages, options),
      stream: true,
    };

    const stream = (await this.client.chat.completions.create(payload)) as AsyncGenerator<ChatCompletionChunk>;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const content = delta?.content ?? '';
      const toolCalls = delta?.tool_calls;

      if (runManager && content) {
        await runManager.handleLLMNewToken?.(content);
      }

      const messageChunk = new AIMessageChunk({
        content,
        additional_kwargs: toolCalls ? { tool_calls: toolCalls } : undefined,
      });

      const generationChunk = new ChatGenerationChunk({
        text: content,
        message: messageChunk,
        generationInfo: {
          finish_reason: chunk.choices[0]?.finish_reason,
          id: chunk.id,
        },
      });

      yield generationChunk;
    }
  }

  private buildBasePayload(
    messages: BaseMessage[],
    options?: CognipeerChatCallOptions
  ): Omit<ChatCompletionRequest, 'stream'> {
    const {
      signal: _signal,
      callbacks: _callbacks,
      tags: _tags,
      metadata: _metadata,
      temperature,
      top_p,
      max_tokens,
      presence_penalty,
      frequency_penalty,
      stop,
      user,
      request_id,
      tools,
      tool_choice,
      ..._rest
    } = options || {};

    return {
      model: this.model,
      messages: this.mapMessages(messages),
      ...this.defaults,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(top_p !== undefined ? { top_p } : {}),
      ...(max_tokens !== undefined ? { max_tokens } : {}),
      ...(presence_penalty !== undefined ? { presence_penalty } : {}),
      ...(frequency_penalty !== undefined ? { frequency_penalty } : {}),
      ...(stop !== undefined ? { stop } : {}),
      ...(user !== undefined ? { user } : {}),
      ...(request_id !== undefined ? { request_id } : {}),
      ...(tools !== undefined ? { tools } : {}),
      ...(tool_choice !== undefined ? { tool_choice } : {}),
      ...(_rest as Partial<Omit<ChatCompletionRequest, 'model' | 'messages' | 'stream'>>),
    } as Omit<ChatCompletionRequest, 'stream'>;
  }

  private mapMessages(messages: BaseMessage[]): ChatMessage[] {
    return messages.map((message) => {
      const role = this.mapRole(message._getType());
      const base: ChatMessage = {
        role,
        content: this.renderContent(message.content),
      };

      if (role === 'assistant') {
        const toolCalls = (message as AIMessage).additional_kwargs?.tool_calls as ToolCall[] | undefined;
        if (toolCalls?.length) {
          base.tool_calls = toolCalls;
        }
      }

      if (role === 'tool') {
        const toolMessage = message as ToolMessage;
        const toolCallId = (toolMessage as unknown as { tool_call_id?: string }).tool_call_id;
        if (toolCallId) {
          base.tool_call_id = toolCallId;
        }
      }

      return base;
    });
  }

  private mapRole(type: string): ChatRole {
    switch (type) {
      case 'human':
        return 'user';
      case 'ai':
        return 'assistant';
      case 'tool':
        return 'tool';
      default:
        return type as ChatRole;
    }
  }

  private renderContent(content: BaseMessage['content']): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if ('text' in part && typeof part.text === 'string') return part.text;
          return JSON.stringify(part);
        })
        .join('');
    }

    return String(content);
  }

  private mapUsage(usage?: Usage) {
    if (!usage) return undefined;
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cachedTokens: usage.cached_tokens,
    };
  }
}

export interface CognipeerTracingCallbackOptions {
  /** SDK client or configuration used to build one. */
  client: ConsoleClient | ConsoleClientOptions;
  /** Session identifier; autogenerated if omitted. */
  sessionId?: string;
  /** Thread identifier; groups multiple sessions into a single thread. */
  threadId?: string;
  /** Agent descriptor stored with the session. */
  agent?: TracingAgent;
  /** Initial summary to send alongside events. */
  summary?: TracingSummary;
  /** Optional config blob stored on the session. */
  config?: Record<string, unknown>;
  /** Auto flush events on chain/tool completion. */
  autoFlush?: boolean;
  /** Enable debug mode for detailed logging */
  debug?: boolean;
  /** Optional logger; defaults to console.log */
  logger?: (...args: unknown[]) => void;
}

/**
 * LangChain callback handler that converts run events into Cognipeer tracing sessions.
 */
export class CognipeerTracingCallbackHandler extends BaseCallbackHandler {
  readonly name = 'cognipeer-tracing';

  private client: ConsoleClient;
  private sessionId: string;
  private threadId?: string;
  private agent?: TracingAgent;
  private autoFlush: boolean;
  private summary?: TracingSummary;
  private config?: Record<string, unknown>;
  private events: TracingEvent[] = [];
  private debug: boolean;
  private logger: (...args: unknown[]) => void;

  constructor(options: CognipeerTracingCallbackOptions) {
    super();
    this.client = options.client instanceof ConsoleClient ? options.client : new ConsoleClient(options.client);
    this.sessionId = options.sessionId || CognipeerTracingCallbackHandler.generateId();
    this.threadId = options.threadId;
    this.agent = options.agent;
    this.summary = options.summary;
    this.config = options.config;
    this.autoFlush = options.autoFlush ?? true;
    this.debug = options.debug ?? false;
    this.logger = options.logger || ((...args: unknown[]) => console.log('[cognipeer]', ...args));
  }

  /** Expose the session id so callers can correlate logs. */
  getSessionId(): string {
    return this.sessionId;
  }

  async handleChainStart(chain: unknown, inputs: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'chain_start',
      label: this.readLabel(chain),
      metadata: { inputs },
    });
  }

  async handleChainEnd(outputs: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'chain_end',
      status: 'completed',
      metadata: { outputs },
    });
    if (this.autoFlush) {
      await this.flush('running');
    }
  }

  async handleChainError(error: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'chain_error',
      status: 'error',
      metadata: { error: this.stringifyError(error) },
    });
    await this.flush('error');
  }

  async handleLLMStart(llm: unknown, prompts: string[], runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'llm_start',
      label: this.readLabel(llm),
      metadata: { prompts },
    });
  }

  async handleLLMEnd(output: unknown, runId: string): Promise<void> {
    const usage = this.extractUsage(output);
    this.recordEvent({
      id: runId,
      type: 'llm_end',
      status: 'completed',
      usage,
      metadata: usage ? { usage } : undefined,
    });
    if (usage) {
      this.addUsageToSummary(usage);
    }
    if (this.autoFlush) {
      await this.flush('running');
    }
  }

  async handleLLMError(error: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'llm_error',
      status: 'error',
      metadata: { error: this.stringifyError(error) },
    });
    await this.flush('error');
  }

  async handleToolStart(tool: { name?: string }, input: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'tool_start',
      label: tool?.name,
      metadata: { input },
    });
  }

  async handleToolEnd(output: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'tool_end',
      status: 'completed',
      metadata: { output },
    });
    if (this.autoFlush) {
      await this.flush('running');
    }
  }

  async handleToolError(error: unknown, runId: string): Promise<void> {
    this.recordEvent({
      id: runId,
      type: 'tool_error',
      status: 'error',
      metadata: { error: this.stringifyError(error) },
    });
    await this.flush('error');
  }

  /** Flush buffered events to the tracing API. */
  async flush(status: string = 'running'): Promise<void> {
    if (!this.events.length) return;

    const payload: TracingSessionRequest = {
      sessionId: this.sessionId,
      threadId: this.threadId,
      agent: this.agent,
      config: this.config,
      summary: this.summary,
      status,
      events: this.events,
    };

    const url = '/api/client/v1/tracing/sessions';
    if (this.debug) {
      this.logger('[debug] tracing:flush', {
        url,
        payload: JSON.stringify(payload, null, 2),
      });
    }

    await this.client.tracing.ingest(payload);
    this.events = [];
  }

  /** Close the session and submit any buffered events. */
  async endSession(status: string = 'completed'): Promise<void> {
    await this.flush(status);
  }

  private recordEvent(event: TracingEvent): void {
    this.events.push({
      ...event,
      id: event.id || CognipeerTracingCallbackHandler.generateId(),
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  private addUsageToSummary(usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }): void {
    if (!usage) return;
    if (!this.summary) {
      this.summary = {};
    }
    this.summary.totalInputTokens = (this.summary.totalInputTokens || 0) + (usage.promptTokens || 0);
    this.summary.totalOutputTokens = (this.summary.totalOutputTokens || 0) + (usage.completionTokens || 0);
  }

  private extractUsage(output: unknown): { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined {
    const usage = (output as { llmOutput?: { tokenUsage?: Record<string, number> } })?.llmOutput?.tokenUsage;
    if (!usage) return undefined;
    return {
      promptTokens: usage.promptTokens ?? usage.prompt_tokens,
      completionTokens: usage.completionTokens ?? usage.completion_tokens,
      totalTokens: usage.totalTokens ?? usage.total_tokens,
    };
  }

  private readLabel(obj: unknown): string | undefined {
    if (typeof obj === 'string') return obj;
    if (obj && typeof obj === 'object' && 'name' in obj && typeof (obj as { name?: unknown }).name === 'string') {
      return (obj as { name: string }).name;
    }
    return undefined;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  static generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `cognipeer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export interface CognipeerAgentTracingBinding {
  /** Callbacks array to pass to LangChain agent/graph creation. */
  callbacks: BaseCallbackHandler[];
  /** Underlying tracing handler instance. */
  handler: CognipeerTracingCallbackHandler;
  /** Active session id. */
  sessionId: string;
  /** Flush buffered events manually. */
  flush: (status?: string) => Promise<void>;
  /** End the session and flush. */
  end: (status?: string) => Promise<void>;
}

/**
 * Helper to bind Cognipeer tracing to LangChain agents created via createAgent / AgentExecutor.
 *
 * Usage:
 * const tracing = createCognipeerAgentTracing({ client, sessionId: 'abc' });
 * const agent = await createAgent(..., { callbacks: tracing.callbacks });
 */
export function createCognipeerAgentTracing(options: CognipeerTracingCallbackOptions): CognipeerAgentTracingBinding {
  const handler = new CognipeerTracingCallbackHandler(options);
  return {
    callbacks: [handler],
    handler,
    sessionId: handler.getSessionId(),
    flush: (status?: string) => handler.flush(status),
    end: (status?: string) => handler.endSession(status),
  };
}

export interface CognipeerTracingMiddlewareBinding {
  /** Middleware instance to pass into createAgent middleware array. (Returned as unknown to allow flexible usage.) */
  middleware: AgentMiddleware;
  /** Underlying tracing handler reused by the middleware. */
  handler: CognipeerTracingCallbackHandler;
  /** Active session id for correlation. */
  sessionId: string;
  /** Flush buffered events manually. */
  flush: (status?: string) => Promise<void>;
  /** End the session and flush. */
  end: (status?: string) => Promise<void>;
}

/** Alias for middleware options - same as callback options. */
export type CognipeerTracingMiddlewareOptions = CognipeerTracingCallbackOptions;

/**
 * LangChain middleware that logs model/tool events and ingests them into Cognipeer tracing.
 */
export function createCognipeerTracingMiddleware(
  options: CognipeerTracingMiddlewareOptions
): CognipeerTracingMiddlewareBinding {
  const handler = new CognipeerTracingCallbackHandler(options);
  const debug = options.debug ?? false;
  const log = options.logger || ((...args: unknown[]) => console.log('[cognipeer]', ...args));
  const debugLog = (...args: unknown[]) => {
    if (debug) log('[debug]', ...args);
  };

  const middleware = createMiddleware({
    name: 'CognipeerTracingMiddleware',

    beforeAgent: async (state: Record<string, unknown>) => {
      const runId = generateId();
      log('agent:start', { runId });
      debugLog('agent:start:state', JSON.stringify(state, null, 2));
      await handler.handleChainStart('agent', state, runId);
      return undefined;
    },

    afterAgent: async (state: Record<string, unknown>) => {
      const runId = generateId();
      log('agent:end', { runId });
      debugLog('agent:end:state', JSON.stringify(state, null, 2));
      await handler.handleChainEnd(state, runId);
      await handler.flush('completed');
      return undefined;
    },

    beforeModel: async (state: Record<string, unknown>) => {
      const runId = generateId();
      const messages = (state?.messages as Array<{ content?: string }>) ?? [];
      log('model:start', { runId, messageCount: messages.length });
      debugLog('model:start:messages', JSON.stringify(messages, null, 2));
      await handler.handleLLMStart('model', messages.map((m) => m.content ?? ''), runId);
      return undefined;
    },

    afterModel: async (_state: Record<string, unknown>) => {
      const runId = generateId();
      log('model:end', { runId });
      debugLog('model:end:state', JSON.stringify(_state, null, 2));
      await handler.handleLLMEnd({ llmOutput: {} }, runId);
      return undefined;
    },

    wrapModelCall: async (request, next) => {
      const runId = generateId();
      const startTime = Date.now();
      debugLog('model:wrap:request', { runId, request: JSON.stringify(request, null, 2) });
      try {
        const result = await next(request);
        const duration = Date.now() - startTime;
        await handler.handleLLMEnd(result, runId);
        log('model:wrap:success', { runId, durationMs: duration });
        debugLog('model:wrap:result', { runId, result: JSON.stringify(result, null, 2) });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        log('model:wrap:error', { runId, durationMs: duration, error: String(error) });
        debugLog('model:wrap:error:full', { runId, error });
        await handler.handleLLMError(error, runId);
        throw error;
      }
    },

    wrapToolCall: async (request, next) => {
      const runId = generateId();
      const toolName = request.toolCall?.name;
      const toolArgs = request.toolCall?.args;
      const startTime = Date.now();
      await handler.handleToolStart({ name: toolName }, toolArgs, runId);
      log('tool:start', { runId, name: toolName });
      debugLog('tool:start:args', { runId, name: toolName, args: JSON.stringify(toolArgs, null, 2) });
      try {
        const result = await next(request);
        const duration = Date.now() - startTime;
        log('tool:success', { runId, name: toolName, durationMs: duration });
        debugLog('tool:success:result', { runId, name: toolName, result: JSON.stringify(result, null, 2) });
        await handler.handleToolEnd(result, runId);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        log('tool:error', { runId, name: toolName, durationMs: duration, error: String(error) });
        debugLog('tool:error:full', { runId, name: toolName, error });
        await handler.handleToolError(error, runId);
        throw error;
      }
    },
  });

  return {
    middleware,
    handler,
    sessionId: handler.getSessionId(),
    flush: (status?: string) => handler.flush(status),
    end: (status?: string) => handler.endSession(status),
  };
}

/** Generate unique ID for tracing events. */
function generateId(): string {
  return CognipeerTracingCallbackHandler.generateId();
}
