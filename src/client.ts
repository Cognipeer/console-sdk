import { HttpClient } from './http';
import { ConsoleClientOptions } from './types';
import { ChatResource } from './resources/chat';
import { BatchesResource } from './resources/batches';
import { ModerationsResource } from './resources/moderations';
import { BudgetsResource, SpendResource } from './resources/spend';
import { RealtimeResource } from './resources/realtime';
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
import { BrowserMcpResource, BrowserSessionsResource, BrowsersResource } from './resources/browser';
import { AudioResource, OcrResource } from './resources/audio';
import { AutomationsResource } from './resources/automations';
import { CrawlerResource } from './resources/crawler';
import { SandboxResource } from './resources/sandbox';
import { RerankerResource } from './resources/reranker';
import { WebSearchResource } from './resources/webSearch';
import { McpResource } from './resources/mcp';

/**
 * Default configuration values
 */
const DEFAULT_BASE_URL = 'https://api.cognipeer.com';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;

/**
 * Cognipeer Console Client
 *
 * Main entry point for interacting with the Console API.
 *
 * @example
 * ```typescript
 * const client = new ConsoleClient({
 *   apiKey: 'your-api-key',
 *   baseURL: 'https://your-console.example.com', // optional; without /api/client/v1
 * });
 *
 * const response = await client.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 *
 * Note on `baseURL`: pass the host root (e.g. `https://api.cognipeer.com`).
 * Older versions of this SDK accepted a base URL that already included
 * `/api/client/v1`. To stay backwards-compatible the trailing
 * `/api/client/v1` (with or without trailing slash) is stripped automatically.
 */
export class ConsoleClient {
  private http: HttpClient;

  /** Chat completions API */
  public chat: ChatResource;

  /** Batch API (OpenAI-compatible async bulk inference) */
  public batches: BatchesResource;

  /** Moderations API (OpenAI-compatible, backed by guardrails) */
  public moderations: ModerationsResource;

  /** Spend reporting API */
  public spend: SpendResource;

  /** Budget (spend cap) management API */
  public budgets: BudgetsResource;

  /** Realtime API (WebSocket streaming chat with optional voice) */
  public realtime: RealtimeResource;

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

  /** Browser sessions (Playwright) API */
  public browserSessions: BrowserSessionsResource;

  /** Browsers (parent profiles for sessions and Browser Use / MCP integration) */
  public browsers: BrowsersResource;

  /** Browser MCP helper API */
  public browserMcp: BrowserMcpResource;

  /** Audio (STT / TTS / translation) API */
  public audio: AudioResource;

  /** OCR (document extraction) API */
  public ocr: OcrResource;

  /** Built-in automations API */
  public automations: AutomationsResource;

  /** Crawler API (scheduled + ad-hoc web crawls) */
  public crawler: CrawlerResource;

  /** JS Sandbox API (managed isolate execution) */

  /** Agent Sandbox API (remote runtime sandboxes: exec, code, fs, git, sessions) */
  public sandbox: SandboxResource;

  /** Reranker API (Cohere-compatible reranking) */
  public rerankers: RerankerResource;

  /** Web Search API (Bing, Brave, Serper, Tavily, SearxNG, DuckDuckGo providers) */
  public webSearch: WebSearchResource;

  /** MCP API (tenant + built-in console MCP servers) */
  public mcp: McpResource;

  /**
   * Create a new Console client
   * @param options - Client configuration
   */
  constructor(options: ConsoleClientOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required');
    }

    const baseURL = normalizeBaseUrl(options.baseURL || DEFAULT_BASE_URL);
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.http = new HttpClient(baseURL, options.apiKey, timeout, maxRetries, options.fetch);

    // Initialize resources
    this.chat = new ChatResource(this.http);
    this.batches = new BatchesResource(this.http);
    this.moderations = new ModerationsResource(this.http);
    this.spend = new SpendResource(this.http);
    this.budgets = new BudgetsResource(this.http);
    this.realtime = new RealtimeResource(baseURL, options.apiKey, this.http);
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
    this.browserSessions = new BrowserSessionsResource(this.http);
    this.browsers = new BrowsersResource(this.http);
    this.browserMcp = new BrowserMcpResource(this.http);
    this.audio = new AudioResource(this.http);
    this.ocr = new OcrResource(this.http);
    this.automations = new AutomationsResource(this.http);
    this.crawler = new CrawlerResource(this.http);
    this.sandbox = new SandboxResource(this.http);
    this.rerankers = new RerankerResource(this.http);
    this.webSearch = new WebSearchResource(this.http);
    this.mcp = new McpResource(this.http);
  }

  /**
   * Get the configured base URL
   */
  getBaseURL(): string {
    return this.http['baseURL'];
  }
}

/**
 * Normalise the base URL. Resources include the full `/api/client/v1/...`
 * path, so the base URL should be the host root only. If callers pass a
 * legacy base URL that already ends in `/api/client/v1`, strip it so we
 * don't end up with a duplicated `/api/client/v1/api/client/v1/...` path.
 */
function normalizeBaseUrl(input: string): string {
  const trimmed = input.replace(/\/+$/, '');
  return trimmed.replace(/\/api\/client\/v1$/, '');
}
