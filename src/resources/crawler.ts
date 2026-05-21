import { HttpClient } from '../http';
import {
  AdhocCrawlRequest,
  CrawlJob,
  CrawlOnContainerRequest,
  CrawlResult,
  CrawlRunAcceptedResponse,
  Crawler,
  CrawlerUrlEntry,
  CreateCrawlerRequest,
  ListCrawlJobResultsQuery,
  ListCrawlJobsQuery,
  ListCrawlersQuery,
  RunCrawlerRequest,
  UpdateCrawlerRequest,
} from '../types';

/**
 * Crawler API resource — programmatic access to scheduled and ad-hoc web crawls.
 *
 * @example
 * ```typescript
 * // Run an ad-hoc crawl
 * const job = await client.crawler.runAdhoc({
 *   urls: ['https://docs.example.com'],
 * });
 *
 * // Wait until the job is done
 * const status = await client.crawler.jobs.get(job.jobId);
 *
 * // Read the crawled pages
 * const results = await client.crawler.jobs.listResults(job.jobId);
 * ```
 */
export class CrawlerResource {
  private http: HttpClient;
  public jobs: CrawlerJobsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.jobs = new CrawlerJobsResource(http);
  }

  /** List all crawlers visible to the current token. */
  async list(query?: ListCrawlersQuery): Promise<Crawler[]> {
    const res = await this.http.request<{ crawlers: Crawler[] }>(
      'GET',
      '/api/client/v1/crawler/crawlers',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.crawlers ?? [];
  }

  /** Create a new crawler. */
  async create(data: CreateCrawlerRequest): Promise<Crawler> {
    const res = await this.http.request<{ crawler: Crawler }>(
      'POST',
      '/api/client/v1/crawler/crawlers',
      { body: data },
    );
    return res.crawler;
  }

  /** Get a crawler by id or key. */
  async get(idOrKey: string): Promise<Crawler> {
    const res = await this.http.request<{ crawler: Crawler }>(
      'GET',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}`,
    );
    return res.crawler;
  }

  /** Patch an existing crawler. */
  async update(idOrKey: string, data: UpdateCrawlerRequest): Promise<Crawler> {
    const res = await this.http.request<{ crawler: Crawler }>(
      'PATCH',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}`,
      { body: data },
    );
    return res.crawler;
  }

  /** Delete a crawler. */
  async delete(idOrKey: string): Promise<void> {
    await this.http.request(
      'DELETE',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}`,
    );
  }

  /** Manually trigger a crawler run. */
  async run(
    idOrKey: string,
    options: RunCrawlerRequest = {},
  ): Promise<CrawlRunAcceptedResponse> {
    return this.http.request<CrawlRunAcceptedResponse>(
      'POST',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}/run`,
      { body: options },
    );
  }

  /**
   * "Give me the markdown for these URLs using this crawler's config."
   * Same as `run`, but always against a fixed URL list.
   */
  async crawlWithCrawler(
    idOrKey: string,
    options: CrawlOnContainerRequest,
  ): Promise<CrawlRunAcceptedResponse> {
    return this.http.request<CrawlRunAcceptedResponse>(
      'POST',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}/crawl`,
      { body: options },
    );
  }

  /** Run an ad-hoc crawl without provisioning a persistent crawler. */
  async runAdhoc(options: AdhocCrawlRequest): Promise<CrawlRunAcceptedResponse> {
    return this.http.request<CrawlRunAcceptedResponse>(
      'POST',
      '/api/client/v1/crawler/run',
      { body: options },
    );
  }

  /** List URLs configured on a crawler. */
  async listUrls(idOrKey: string): Promise<CrawlerUrlEntry[]> {
    const res = await this.http.request<{ urls: CrawlerUrlEntry[] }>(
      'GET',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}/urls`,
    );
    return res.urls ?? [];
  }

  /** Add URLs to a crawler's container list. */
  async addUrls(idOrKey: string, urls: string[]): Promise<CrawlerUrlEntry[]> {
    const res = await this.http.request<{ urls: CrawlerUrlEntry[] }>(
      'POST',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}/urls`,
      { body: { urls } },
    );
    return res.urls ?? [];
  }

  /** Remove URLs from a crawler's container list. */
  async removeUrls(idOrKey: string, urls: string[]): Promise<CrawlerUrlEntry[]> {
    const res = await this.http.request<{ urls: CrawlerUrlEntry[] }>(
      'DELETE',
      `/api/client/v1/crawler/crawlers/${encodeURIComponent(idOrKey)}/urls`,
      { body: { urls } },
    );
    return res.urls ?? [];
  }
}

export class CrawlerJobsResource {
  private http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List recent crawl jobs. */
  async list(query?: ListCrawlJobsQuery): Promise<CrawlJob[]> {
    const res = await this.http.request<{ jobs: CrawlJob[] }>(
      'GET',
      '/api/client/v1/crawler/jobs',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.jobs ?? [];
  }

  /** Fetch a single crawl job. */
  async get(jobId: string): Promise<CrawlJob> {
    const res = await this.http.request<{ job: CrawlJob }>(
      'GET',
      `/api/client/v1/crawler/jobs/${encodeURIComponent(jobId)}`,
    );
    return res.job;
  }

  /** List the crawled pages produced by a job. */
  async listResults(
    jobId: string,
    query?: ListCrawlJobResultsQuery,
  ): Promise<CrawlResult[]> {
    const res = await this.http.request<{ results: CrawlResult[] }>(
      'GET',
      `/api/client/v1/crawler/jobs/${encodeURIComponent(jobId)}/results`,
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.results ?? [];
  }

  /** Fetch a single crawled page. */
  async getResult(jobId: string, resultId: string): Promise<CrawlResult> {
    const res = await this.http.request<{ result: CrawlResult }>(
      'GET',
      `/api/client/v1/crawler/jobs/${encodeURIComponent(jobId)}/results/${encodeURIComponent(resultId)}`,
    );
    return res.result;
  }

  /** Cancel a running crawl job. */
  async cancel(jobId: string): Promise<{ ok: boolean }> {
    return this.http.request<{ ok: boolean }>(
      'POST',
      `/api/client/v1/crawler/jobs/${encodeURIComponent(jobId)}/cancel`,
    );
  }
}
