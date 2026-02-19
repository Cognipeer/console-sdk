# Cognipeer Console SDK Examples

This directory contains practical examples for using the Cognipeer Console SDK.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set your API key:

```bash
export COGNIPEER_API_KEY=your-api-key
```

## Running Examples

### Chat Examples

```bash
# Basic chat completion
npm run example:chat

# Streaming chat
npm run example:streaming
```

### RAG Example

```bash
# Complete RAG system with vector search
npm run example:rag
```

### File Upload

```bash
# Upload and process files
npm run example:file
```

## Available Examples

- `chat-basic.ts` - Basic chat completions and multi-turn conversations
- `chat-streaming.ts` - Streaming responses with real-time updates
- `rag-example.ts` - Complete RAG implementation with vector search
- `file-upload.ts` - File upload and markdown conversion

## Prerequisites

- Node.js 18+
- Cognipeer Console account
- API key from your dashboard

## Documentation

See the [full documentation](https://cognipeer.github.io/console-sdk) for more details.
