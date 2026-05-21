# Crawler API

Programmatic access to scheduled and ad-hoc web crawls. Crawlers are reusable
containers that bundle config + a URL list; jobs are individual runs and
hold the crawled pages as results.

## Resource shape

```typescript
client.crawler.list / create / get / update / delete / run / crawlWithCrawler / runAdhoc
client.crawler.listUrls / addUrls / removeUrls
client.crawler.jobs.list / get / listResults / getResult / cancel
```

## Ad-hoc crawl

```typescript
const job = await client.crawler.runAdhoc({
  urls: ['https://docs.example.com'],
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
await client.crawler.crawlWithCrawler('docs', {
  urls: ['https://docs.example.com/v2/intro'],
  callbackUrl: 'https://your-app.example.com/crawler/webhook',
});
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
  _id: string;
  jobId: string;
  url: string;
  status?: string;
  contentType?: string;
  markdown?: string;
  html?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}
```
