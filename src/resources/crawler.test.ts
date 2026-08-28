import { describe, it, expect } from 'vitest';
import { CrawlerResource, CrawlerJobsResource } from './crawler';
import { createMockHttp } from '../test/mockHttp';

describe('CrawlerResource', () => {
  it('exposes a nested CrawlerJobsResource', () => {
    const http = createMockHttp();
    const resource = new CrawlerResource(http);

    expect(resource.jobs).toBeInstanceOf(CrawlerJobsResource);
  });

  it('lists crawlers, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new CrawlerResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/crawlers', {
      query: undefined,
    });
  });

  it('lists crawlers passing the query through', async () => {
    const http = createMockHttp();
    const crawlers = [{ id: 'c1' }];
    http.request.mockResolvedValue({ crawlers });
    const resource = new CrawlerResource(http);

    const result = await resource.list({ status: 'active' } as never);

    expect(result).toBe(crawlers);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/crawlers', {
      query: { status: 'active' },
    });
  });

  it('creates a crawler', async () => {
    const http = createMockHttp();
    const crawler = { id: 'c1', name: 'Docs crawler' };
    http.request.mockResolvedValue({ crawler });
    const resource = new CrawlerResource(http);

    const result = await resource.create({ name: 'Docs crawler' } as never);

    expect(result).toBe(crawler);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/crawlers', {
      body: { name: 'Docs crawler' },
    });
  });

  it('gets a crawler by id, url-encoding the key', async () => {
    const http = createMockHttp();
    const crawler = { id: 'c 1' };
    http.request.mockResolvedValue({ crawler });
    const resource = new CrawlerResource(http);

    const result = await resource.get('c 1');

    expect(result).toBe(crawler);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/crawlers/c%201');
  });

  it('updates a crawler', async () => {
    const http = createMockHttp();
    const crawler = { id: 'c1', name: 'Renamed' };
    http.request.mockResolvedValue({ crawler });
    const resource = new CrawlerResource(http);

    const result = await resource.update('c1', { name: 'Renamed' } as never);

    expect(result).toBe(crawler);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/crawler/crawlers/c1', {
      body: { name: 'Renamed' },
    });
  });

  it('deletes a crawler', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(undefined);
    const resource = new CrawlerResource(http);

    await resource.delete('c1');

    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/crawler/crawlers/c1');
  });

  it('runs a crawler with the given options', async () => {
    const http = createMockHttp();
    const response = { jobId: 'job1' };
    http.request.mockResolvedValue(response);
    const resource = new CrawlerResource(http);

    const result = await resource.run('c1', { mode: 'sync' } as never);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/crawlers/c1/run', {
      body: { mode: 'sync' },
    });
  });

  it('runs a crawler with default (empty) options', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ jobId: 'job1' });
    const resource = new CrawlerResource(http);

    await resource.run('c1');

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/crawlers/c1/run', {
      body: {},
    });
  });

  it('crawls a fixed URL list with a crawler config', async () => {
    const http = createMockHttp();
    const response = { results: [{ url: 'https://example.com' }] };
    http.request.mockResolvedValue(response);
    const resource = new CrawlerResource(http);

    const result = await resource.crawlWithCrawler('c1', { urls: ['https://example.com'] } as never);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/crawlers/c1/crawl', {
      body: { urls: ['https://example.com'] },
    });
  });

  it('crawlUrl wraps crawlWithCrawler in sync mode and returns the first result', async () => {
    const http = createMockHttp();
    const firstResult = { url: 'https://example.com', markdown: '# Hi' };
    http.request.mockResolvedValue({ results: [firstResult] });
    const resource = new CrawlerResource(http);

    const result = await resource.crawlUrl('c1', 'https://example.com');

    expect(result).toBe(firstResult);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/crawlers/c1/crawl', {
      body: { urls: ['https://example.com'], mode: 'sync' },
    });
  });

  it('crawlUrl returns null when there are no results', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ results: [] });
    const resource = new CrawlerResource(http);

    const result = await resource.crawlUrl('c1', 'https://example.com');

    expect(result).toBeNull();
  });

  it('runs an ad-hoc crawl', async () => {
    const http = createMockHttp();
    const response = { jobId: 'job2' };
    http.request.mockResolvedValue(response);
    const resource = new CrawlerResource(http);

    const result = await resource.runAdhoc({ urls: ['https://example.com'] });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/run', {
      body: { urls: ['https://example.com'] },
    });
  });

  it('lists urls, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new CrawlerResource(http);

    const result = await resource.listUrls('c1');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/crawlers/c1/urls');
  });

  it('adds urls to a crawler', async () => {
    const http = createMockHttp();
    const urls = [{ url: 'https://example.com' }];
    http.request.mockResolvedValue({ urls });
    const resource = new CrawlerResource(http);

    const result = await resource.addUrls('c1', ['https://example.com']);

    expect(result).toBe(urls);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/crawlers/c1/urls', {
      body: { urls: ['https://example.com'] },
    });
  });

  it('removes urls from a crawler', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ urls: [] });
    const resource = new CrawlerResource(http);

    const result = await resource.removeUrls('c1', ['https://example.com']);

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/crawler/crawlers/c1/urls', {
      body: { urls: ['https://example.com'] },
    });
  });
});

describe('CrawlerJobsResource', () => {
  it('lists jobs, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new CrawlerJobsResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/jobs', {
      query: undefined,
    });
  });

  it('gets a job by id', async () => {
    const http = createMockHttp();
    const job = { jobId: 'job1' };
    http.request.mockResolvedValue({ job });
    const resource = new CrawlerJobsResource(http);

    const result = await resource.get('job1');

    expect(result).toBe(job);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/jobs/job1');
  });

  it('lists job results with an optional query', async () => {
    const http = createMockHttp();
    const results = [{ url: 'https://example.com' }];
    http.request.mockResolvedValue({ results });
    const resource = new CrawlerJobsResource(http);

    const result = await resource.listResults('job1', { limit: 5 } as never);

    expect(result).toBe(results);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/crawler/jobs/job1/results', {
      query: { limit: 5 },
    });
  });

  it('gets a single crawl result', async () => {
    const http = createMockHttp();
    const crawlResult = { url: 'https://example.com' };
    http.request.mockResolvedValue({ result: crawlResult });
    const resource = new CrawlerJobsResource(http);

    const result = await resource.getResult('job1', 'result1');

    expect(result).toBe(crawlResult);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/crawler/jobs/job1/results/result1',
    );
  });

  it('cancels a job', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new CrawlerJobsResource(http);

    const result = await resource.cancel('job1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/crawler/jobs/job1/cancel');
  });
});
