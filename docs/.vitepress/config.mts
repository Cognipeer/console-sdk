import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Cognipeer Console SDK',
  description: 'Official TypeScript SDK for Cognipeer Console',
  base: '/console-sdk/',
  ignoreDeadLinks: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/client' },
      { text: 'Examples', link: '/examples/' },
      {
        text: 'v1.0.0',
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
            { text: 'Chat', link: '/api/chat' },
            { text: 'Embeddings', link: '/api/embeddings' },
            { text: 'Config', link: '/api/config' },
            { text: 'Guardrails', link: '/api/guardrails' },
            { text: 'LangGraph', link: '/api/langgraph' },
            { text: 'Tools', link: '/api/tools' },
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
            { text: 'Streaming Chat', link: '/examples/streaming' },
            { text: 'Embeddings', link: '/examples/embeddings' },
            { text: 'RAG with Vectors', link: '/examples/rag' },
            { text: 'File Upload', link: '/examples/files' },
            { text: 'Agent Tracing', link: '/examples/tracing' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Cognipeer/console-sdk' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 CognipeerAI',
    },
    search: {
      provider: 'local',
    },
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/console-sdk/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'CG SDK Documentation' }],
  ],
});
