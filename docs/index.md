---
layout: home

hero:
  name: Cognipeer Console SDK
  text: Cognipeer Console SDK
  tagline: Official TypeScript/JavaScript SDK for integrating with Cognipeer Console
  image:
    src: /console-sdk/logo.svg
    alt: Cognipeer Console SDK
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Console Docs
      link: https://cognipeer.github.io/cognipeer-console/
    - theme: alt
      text: View on GitHub
      link: https://github.com/Cognipeer/console-sdk

features:
  - icon: 🤖
    title: Chat Completions
    details: OpenAI-compatible chat API with full streaming support. Build conversational AI applications with ease.
  - icon: 🤝
    title: Agents
    details: Invoke AI agents via the Responses API with multi-turn conversations, tool bindings, and version pinning.
  - icon: 🔧
    title: Tools
    details: List, execute, and convert unified tools (OpenAPI/MCP) into Agent SDK-compatible objects.
  - icon: 📊
    title: Embeddings
    details: Convert text into vector representations for semantic search and similarity matching.
  - icon: 🗄️
    title: Vector Operations
    details: Manage vector databases (Pinecone, Qdrant, Weaviate, S3 Vectors) with a unified API.
  - icon: ⚙️
    title: Config Management
    details: Manage secrets and configuration with groups, encryption, resolution, and audit logs.
  - icon: 📁
    title: File Management
    details: Upload files with automatic markdown conversion for document processing.
  - icon: 🔍
    title: Agent Tracing
    details: Built-in observability for agent executions and debugging.
  - icon: 🔒
    title: Type Safe
    details: Full TypeScript support with comprehensive type definitions.
  - icon: ⚡
    title: Modern & Fast
    details: ESM and CommonJS support. Works in Node.js and browsers.
---

## Quick Start

## Where This Fits

Use the SDK when you are writing application code that talks to an existing Cognipeer Console deployment.

- Need deployment, tenant model, providers, or raw API semantics? Go to the [Cognipeer Console docs](https://cognipeer.github.io/cognipeer-console/).
- Need TypeScript or JavaScript examples, client configuration, and resource methods? Stay in the SDK docs.

## Choose Your Entry Point

| Start with | Best for | What you get |
| --- | --- | --- |
| [Working with Console](/guide/working-with-console) | Teams deciding how Console and the SDK fit together | Clear responsibility split between platform operations and app integration |
| [Getting Started](/guide/getting-started) | Developers wiring the SDK into an app | Install, auth, base URL, first request |
| [Console API Mapping](/api/console-mapping) | Teams migrating from raw HTTP calls or reviewing API ownership | Direct mapping between SDK methods and Console endpoints |

::: code-group

```bash [npm]
npm install @cognipeer/console-sdk
```

```bash [yarn]
yarn add @cognipeer/console-sdk
```

```bash [pnpm]
pnpm add @cognipeer/console-sdk
```

:::

## Basic Usage

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: 'your-api-key',
});

// Chat completion
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## Why Cognipeer Console SDK?

- **OpenAI Compatible**: Drop-in replacement for OpenAI SDK with extended features
- **Multi-Provider**: Support for multiple LLM and vector database providers
- **Enterprise Ready**: Built for multi-tenant SaaS with complete data isolation
- **Production Tested**: Used in production by Cognipeer customers
- **Active Development**: Regular updates and new features

## Learn More

::: tip 📖 Documentation
Check out the [Getting Started Guide](/guide/getting-started) to learn more.
:::

::: info 💡 Examples
Explore our [Examples](/examples/) for common use cases and patterns.
:::

::: warning 🆘 Support
Need help? [Open an issue](https://github.com/Cognipeer/console-sdk/issues) on GitHub.
:::
