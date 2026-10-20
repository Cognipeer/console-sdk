import { HttpClient } from '../http';
import {
  ChatCompletionOptions,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from '../types';

/**
 * Chat API resource
 */
export class ChatResource {
  public completions: ChatCompletionsResource;

  constructor(http: HttpClient) {
    this.completions = new ChatCompletionsResource(http);
  }
}

/**
 * Chat completions resource
 */
export class ChatCompletionsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a chat completion. `model` is a model key, or an agent (`agent:<key>` or its
   * key): the agent runs its published version and its answer is `message.content`
   * (a JSON string with `response_format`).
   *
   * A non-streaming agent call that outlives the Console's wait window answers `202`
   * with `choices: []`: it does not throw, `cognipeer.status` is `in_progress` and
   * `cognipeer.run_id` is the run to follow with `client.agents.runs.wait()`.
   *
   * @param params - Chat completion parameters
   * @param options - Session / idempotency / abort
   * @returns Chat completion response or async generator for streaming
   */
  async create(
    params: ChatCompletionRequest & { stream?: false },
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse>;
  async create(
    params: ChatCompletionRequest & { stream: true },
    options?: ChatCompletionOptions,
  ): Promise<AsyncGenerator<ChatCompletionChunk, void, undefined>>;
  async create(
    params: ChatCompletionRequest,
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse | AsyncGenerator<ChatCompletionChunk, void, undefined>>;
  async create(
    params: ChatCompletionRequest,
    options: ChatCompletionOptions = {},
  ): Promise<ChatCompletionResponse | AsyncGenerator<ChatCompletionChunk, void, undefined>> {
    const headers: Record<string, string> = {
      ...(options.sessionId ? { 'X-Cognipeer-Session-Id': options.sessionId } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    };
    const request = {
      body: params,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    };
    if (params.stream) {
      return this.http.stream<ChatCompletionChunk>('POST', '/api/client/v1/chat/completions', request);
    }

    return this.http.request<ChatCompletionResponse>('POST', '/api/client/v1/chat/completions', request);
  }
}
