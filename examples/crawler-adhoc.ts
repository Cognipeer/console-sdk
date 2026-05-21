import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  if (!apiKey) throw new Error('COGNIPEER_API_KEY is required');

  const client = new ConsoleClient({
    apiKey,
    ...(process.env.COGNIPEER_BASE_URL ? { baseURL: process.env.COGNIPEER_BASE_URL } : {}),
  });

  const urls = (process.env.COGNIPEER_CRAWL_URLS || 'https://example.com')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  console.log('Starting ad-hoc crawl:', urls);

  const run = await client.crawler.runAdhoc({
    urls,
    metadata: { source: 'console-sdk-example' },
  });

  console.log('Queued job:', run);

  let status = run.status;
  while (status === 'queued' || status === 'running') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const live = await client.crawler.jobs.get(run.jobId);
    status = live.status;
    console.log('  …', status, `(${live.resultCount ?? 0} results so far)`);
  }

  const results = await client.crawler.jobs.listResults(run.jobId, { limit: 20 });
  console.log(`\nGot ${results.length} pages:`);
  for (const page of results) {
    const preview = (page.markdown || page.text || page.html || '').slice(0, 160);
    console.log(`- ${page.url}\n  ${preview.replace(/\s+/g, ' ')}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
