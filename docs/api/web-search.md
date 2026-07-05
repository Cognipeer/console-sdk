# Web Search API

Run web searches through Web Search instances configured in the Console — an
instance is a named search engine backed by Bing, Brave Search, Serper
(Google SERP), Tavily, self-hosted SearxNG, or keyless DuckDuckGo. A project
can have several instances; create and manage them in the dashboard under
**Data → Web Search**, where each instance also has a query playground, usage
stats and its own search logs. When the project has exactly one active
instance you may omit the key; with multiple instances the request must name
one.

Instances can also interpret results with an AI model (like Tavily's
synthesized answers): enable it per instance under **Configuration → AI
Answer** and pick a model, then pass `include_answer: true`. If the instance
does not have AI answers enabled, such requests fail.

## Methods

```typescript
// List web search instances visible to the token's project
const instances = await client.webSearch.providers.list();

// Search (works without a key only when a single active instance exists)
const res = await client.webSearch.search({ query: 'latest LLM benchmarks' });

// Search on a named instance
const r = await client.webSearch.searchWith('brave-main', { query: 'fastify hooks' });

// AI-interpreted answer (instance must have AI answers enabled)
const a = await client.webSearch.searchWith('brave-main', {
  query: 'what changed in fastify v5?',
  include_answer: true,
});
console.log(a.answer, a.answer_model);

// Search with a specific instance and options
const res2 = await client.webSearch.search({
  query: 'espresso extraction pressure profiling',
  provider: 'brave-main',
  count: 5,
  country: 'US',
  language: 'en',
  safe_search: 'moderate',
});

for (const r of res2.results) {
  console.log(r.position, r.title, r.url);
  console.log('  ', r.snippet);
}

// Providers like Tavily can return a synthesized answer
if (res2.answer) console.log('Answer:', res2.answer);
```

## Types

```typescript
type WebSearchSafeSearch = 'off' | 'moderate' | 'strict';

interface WebSearchRequest {
  query: string;
  provider?: string;        // instance key; omit only with a single active instance
  count?: number;           // default 10, max 50
  offset?: number;
  language?: string;        // ISO language override
  country?: string;         // country/market override
  safe_search?: WebSearchSafeSearch;
  include_answer?: boolean; // AI answer; requires instance AI Answer enabled
}

interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  position: number;         // 1-based rank
  published_at?: string;    // ISO date when the provider exposes one
  source?: string;          // origin engine for metasearch (SearxNG)
  score?: number;           // provider-native relevance score
}

interface WebSearchResponse {
  id: string;
  provider: string;         // instance key that served the request
  driver: string;           // bing | brave-search | serper | tavily | searxng | duckduckgo
  query: string;
  answer?: string;          // synthesized answer (AI or provider-native)
  answer_model?: string;    // model key when AI-interpreted
  results: WebSearchResultItem[];
  latency_ms: number;
}

interface WebSearchProvider {
  key: string;
  driver: string;
  label: string;
  status: 'active' | 'disabled' | 'errored';
  aiAnswer: boolean;        // AI answers enabled on this instance
}
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/client/v1/websearch/providers` | List instances visible to the token |
| `POST` | `/api/client/v1/websearch/search` | Run a web search (default or `provider` in body) |
| `POST` | `/api/client/v1/websearch/:key/search` | Run a web search on a named instance |
