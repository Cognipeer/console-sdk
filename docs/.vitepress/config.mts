import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Cognipeer Console SDK',
  description: 'Official TypeScript SDK for Cognipeer Console',
  base: '/console-sdk/',
  ignoreDeadLinks: true,
  markdown: {
    // Code blocks stay dark in both themes, so a single dark Shiki theme is
    // used — the default light theme would render dark tokens on dark bg.
    // `-default` over `github-dark`: its comment gray clears AA on near-black.
    theme: 'github-dark-default',
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Console Docs', link: 'https://cognipeer.github.io/cognipeer-console/' },
      { text: 'API Reference', link: '/api/client' },
      { text: 'Examples', link: '/examples/' },
      {
        text: 'v1.3.1',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Authentication', link: '/guide/authentication' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Working with Console', link: '/guide/working-with-console' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Error Handling', link: '/guide/error-handling' },
            { text: 'Streaming', link: '/guide/streaming' },
            { text: 'Type Safety', link: '/guide/type-safety' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Client', link: '/api/client' },
            { text: 'Console API Mapping', link: '/api/console-mapping' },
            { text: 'Chat', link: '/api/chat' },
            { text: 'Embeddings', link: '/api/embeddings' },
            { text: 'Moderations', link: '/api/moderations' },
            { text: 'Batches', link: '/api/batches' },
            { text: 'Agents', link: '/api/agents' },
            { text: 'Realtime', link: '/api/realtime' },
            { text: 'Audio', link: '/api/audio' },
            { text: 'OCR', link: '/api/ocr' },
            { text: 'Browser', link: '/api/browser' },
            { text: 'Crawler', link: '/api/crawler' },
            { text: 'Automations', link: '/api/automations' },
            { text: 'Agent Sandbox', link: '/api/sandbox' },
            { text: 'Rerankers', link: '/api/rerankers' },
            { text: 'Web Search', link: '/api/web-search' },
            { text: 'Aegis', link: '/api/aegis' },
            { text: 'MCP', link: '/api/mcp' },
            { text: 'Tools', link: '/api/tools' },
            { text: 'Config', link: '/api/config' },
            { text: 'Spend & Budgets', link: '/api/spend' },
            { text: 'Guardrails', link: '/api/guardrails' },
            { text: 'Memory', link: '/api/memory' },
            { text: 'LangGraph', link: '/api/langgraph' },
            { text: 'LangChain', link: '/api/langchain' },
            { text: 'OpenTelemetry', link: '/api/opentelemetry' },
            { text: 'Vectors', link: '/api/vectors' },
            { text: 'Files', link: '/api/files' },
            { text: 'Prompts', link: '/api/prompts' },
            { text: 'Tracing', link: '/api/tracing' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Chat Completions', link: '/examples/chat' },
            { text: 'Memory', link: '/examples/memory' },
            { text: 'Agent Tracing', link: '/examples/tracing' },
            { text: 'Streaming Tracing', link: '/examples/tracing-stream' },
            { text: 'Audio (TTS/STT)', link: '/examples/audio' },
            { text: 'Crawler', link: '/examples/crawler' },
            { text: 'Rerankers', link: '/examples/reranker' },
            { text: 'MCP Console', link: '/examples/mcp-console' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Cognipeer/console-sdk' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Cognipeer',
    },
    search: {
      provider: 'local',
    },
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/console-sdk/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Lexend+Deca:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap' }],
    ['meta', { name: 'theme-color', content: '#0fba94' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Cognipeer Console SDK Documentation' }],
  ],
});
