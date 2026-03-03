import { HttpClient } from './http';
import { ConsoleClientOptions } from './types';
import { ChatResource } from './resources/chat';
import { EmbeddingsResource } from './resources/embeddings';
import { VectorsResource } from './resources/vectors';
import { FilesResource } from './resources/files';
import { TracingResource } from './resources/tracing';
import { ToolsResource } from './resources/tools';
import { PromptsResource } from './resources/prompts';
import { GuardrailsResource } from './resources/guardrails';
import { MemoryResource } from './resources/memory';
import { RagResource } from './resources/rag';
import { ConfigResource } from './resources/config';
import { AgentsResource } from './resources/agents';

/**
 * Default configuration values
 */
const DEFAULT_BASE_URL = 'https://api.cognipeer.com/api/client/v1';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;

/**
 * CognipeerAI Gateway Client
 * 
 * Main entry point for interacting with the CG API
 * 
 * @example
 * ```typescript
 * const client = new ConsoleClient({
 *   apiKey: 'your-api-key',
 *   baseURL: 'https://api.cognipeer.com', // optional
 * });
 * 
 * // Chat completions
 * const response = await client.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * 
 * // Streaming chat
 * const stream = await client.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   stream: true,
 * });
 * 
 * for await (const chunk of stream) {
 *   console.log(chunk.choices[0]?.delta?.content);
 * }
 * ```
 */
export class ConsoleClient {
  private http: HttpClient;

  /** Chat completions API */
  public chat: ChatResource;

  /** Embeddings API */
  public embeddings: EmbeddingsResource;

  /** Vector operations API */
  public vectors: VectorsResource;

  /** File management API */
  public files: FilesResource;

  /** Prompt templates API */
  public prompts: PromptsResource;

  /** Agent tracing API */
  public tracing: TracingResource;

  /** Tools API */
  public tools: ToolsResource;

  /** Guardrails API */
  public guardrails: GuardrailsResource;

  /** Memory API */
  public memory: MemoryResource;

  /** RAG (Retrieval-Augmented Generation) API */
  public rag: RagResource;

  /** Config (secrets and configuration management) API */
  public config: ConfigResource;

  /** Agents API */
  public agents: AgentsResource;

  /**
   * Create a new CG client
   * @param options - Client configuration
   */
  constructor(options: ConsoleClientOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required');
    }

    const baseURL = options.baseURL || DEFAULT_BASE_URL;
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.http = new HttpClient(baseURL, options.apiKey, timeout, maxRetries, options.fetch);

    // Initialize resources
    this.chat = new ChatResource(this.http);
    this.embeddings = new EmbeddingsResource(this.http);
    this.vectors = new VectorsResource(this.http);
    this.files = new FilesResource(this.http);
    this.prompts = new PromptsResource(this.http);
    this.tracing = new TracingResource(this.http);
    this.tools = new ToolsResource(this.http);
    this.guardrails = new GuardrailsResource(this.http);
    this.memory = new MemoryResource(this.http);
    this.rag = new RagResource(this.http);
    this.config = new ConfigResource(this.http);
    this.agents = new AgentsResource(this.http);
  }

  /**
   * Get the configured base URL
   */
  getBaseURL(): string {
    return this.http['baseURL'];
  }
}
