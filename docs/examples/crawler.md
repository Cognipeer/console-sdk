# Crawler Example (ad-hoc crawl)

Run a one-off crawl, poll the job until it finishes, then read the crawled
pages back.

## Run the example

```bash
cd examples
export COGNIPEER_API_KEY=your-api-key
export COGNIPEER_BASE_URL=https://your-console.example.com  # optional
export COGNIPEER_CRAWL_URLS=https://docs.example.com,https://docs.example.com/v2
npm run example:crawler
```

## Code

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

const run = await client.crawler.runAdhoc({
  urls: ['https://docs.example.com'],
  metadata: { source: 'console-sdk-example' },
});

let status = run.status;
while (status === 'queued' || status === 'running') {
  await new Promise((r) => setTimeout(r, 1500));
  const live = await client.crawler.jobs.get(run.jobId);
  status = live.status;
}

const pages = await client.crawler.jobs.listResults(run.jobId, { limit: 20 });
for (const page of pages) {
  console.log(page.url, page.markdown?.slice(0, 160));
}
```

## Persistent crawlers

If you want a recurring job instead of an ad-hoc run:

```typescript
const crawler = await client.crawler.create({
  name: 'Docs',
  seeds: ['https://docs.example.com'],
  schedule: '0 6 * * *', // daily at 06:00 UTC
});

await client.crawler.addUrls(crawler.key, ['https://docs.example.com/changelog']);
await client.crawler.run(crawler.key);
```
