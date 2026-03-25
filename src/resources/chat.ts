import { HttpClient } from '../http';
import {
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
   * Create a chat completion
   * @param params - Chat completion parameters
   * @returns Chat completion response or async generator for streaming
   */
  async create(
    params: ChatCompletionRequest & { stream?: false }
  ): Promise<ChatCompletionResponse>;
  async create(
    params: ChatCompletionRequest & { stream: true }
  ): Promise<AsyncGenerator<ChatCompletionChunk, void, undefined>>;
  async create(
    params: ChatCompletionRequest
  ): Promise<ChatCompletionResponse | AsyncGenerator<ChatCompletionChunk, void, undefined>> {
    if (params.stream) {
      return this.http.stream<ChatCompletionChunk>('POST', '/api/client/v1/chat/completions', {
        body: params,
      });
    }

    return this.http.request<ChatCompletionResponse>('POST', '/api/client/v1/chat/completions', {
      body: params,
    });
  }
}
