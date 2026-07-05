# Crawler API

Programmatic access to scheduled and ad-hoc web crawls. Crawlers are reusable
containers that bundle config + a URL list; jobs are individual runs and
hold the crawled pages as results.

## Resource shape

```typescript
client.crawler.list / create / get / update / delete / run / crawlWithCrawler / crawlUrl / runAdhoc
client.crawler.listUrls / addUrls / removeUrls
client.crawler.jobs.list / get / listResults / getResult / cancel
```

## Ad-hoc crawl

```typescript
const job = await client.crawler.runAdhoc({
  seeds: ['https://docs.example.com'],
  metadata: { source: 'demo' },
});

console.log(job.jobId, job.status);
```

`runAdhoc` returns `{ jobId, crawlerKey?, status, urlCount? }` as soon as the
crawl has been queued. Poll the job until it finishes:

```typescript
let status = job.status;
while (status === 'queued' || status === 'running') {
  await new Promise((r) => setTimeout(r, 1500));
  const live = await client.crawler.jobs.get(job.jobId);
  status = live.status;
}

const pages = await client.crawler.jobs.listResults(job.jobId, { limit: 100 });
for (const page of pages) {
  console.log(page.url, '\n', page.markdown?.slice(0, 200));
}
```

## Managing crawlers

```typescript
const crawler = await client.crawler.create({
  name: 'Docs',
  seeds: ['https://docs.example.com'],
  schedule: '0 6 * * *', // daily at 06:00
});

await client.crawler.addUrls(crawler.key, ['https://docs.example.com/changelog']);
const run = await client.crawler.run(crawler.key);
console.log(run.jobId);
```

## Crawl using an existing crawler's config

```typescript
// Async (default): enqueue and get notified via callbackUrl
await client.crawler.crawlWithCrawler('docs', {
  urls: ['https://docs.example.com/v2/intro'],
  callbackUrl: 'https://your-app.example.com/crawler/webhook',
});

// Sync: block until done, results (markdown) inlined in the response
const done = await client.crawler.crawlWithCrawler('docs', {
  urls: ['https://docs.example.com/v2/intro'],
  mode: 'sync',
});
console.log(done.status, done.results[0]?.bodyMarkdown);

// Single URL convenience — request in, markdown out
const page = await client.crawler.crawlUrl('docs', 'https://docs.example.com/v2/intro');
console.log(page?.bodyMarkdown);
```

## Cancel a job

```typescript
await client.crawler.jobs.cancel(jobId);
```

## Types

```typescript
interface CrawlJob {
  _id: string;
  crawlerKey?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string;
  urlCount?: number;
  resultCount?: number;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface CrawlResult {
  id?: string;
  jobId: string;
  url: string;
  type?: string;
  httpStatus?: number;
  contentType?: string;
  title?: string;
  bodyMarkdown?: string;   // page content as markdown
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

// mode: 'sync' container runs return:
interface CrawlRunSyncResponse {
  jobId: string;
  status: CrawlJobStatus;
  pagesProcessed?: number;
  filesProcessed?: number;
  errorsCount?: number;
  results: CrawlResult[];
}
```
