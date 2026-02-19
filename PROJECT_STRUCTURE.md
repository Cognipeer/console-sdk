# Cognipeer Console SDK - Project Structure

Complete overview of the Cognipeer Console SDK project.

## 📁 Project Structure

```
console-sdk/
├── src/                          # Source code
│   ├── index.ts                  # Main entry point & exports
│   ├── client.ts                 # ConsoleClient class
│   ├── http.ts                   # HTTP client utilities
│   ├── types.ts                  # TypeScript type definitions
│   ├── client.test.ts            # Unit tests
│   └── resources/                # API resource modules
│       ├── chat.ts               # Chat completions API
│       ├── embeddings.ts         # Embeddings API
│       ├── vectors.ts            # Vector operations API
│       ├── files.ts              # File management API
│       └── tracing.ts            # Agent tracing API
│
├── docs/                         # Documentation (VitePress)
│   ├── .vitepress/
│   │   └── config.ts             # VitePress configuration
│   ├── index.md                  # Documentation homepage
│   ├── guide/                    # User guides
│   │   ├── getting-started.md
│   │   ├── installation.md
│   │   ├── authentication.md
│   │   └── configuration.md
│   ├── api/                      # API reference
│   │   ├── client.md
│   │   ├── chat.md
│   │   ├── embeddings.md
│   │   ├── vectors.md
│   │   ├── files.md
│   │   └── tracing.md
│   └── examples/                 # Example documentation
│       └── index.md
│
├── examples/                     # Code examples
│   ├── package.json
│   ├── README.md
│   ├── chat-basic.ts             # Basic chat examples
│   ├── chat-streaming.ts         # Streaming examples
│   └── rag-example.ts            # RAG system example
│
├── dist/                         # Build output (generated)
│   ├── index.js                  # CommonJS build
│   ├── index.mjs                 # ESM build
│   └── index.d.ts                # Type definitions
│
├── package.json                  # Package configuration
├── tsconfig.json                 # TypeScript configuration
├── tsup.config.ts                # Build configuration
├── vitest.config.ts              # Test configuration
├── .eslintrc.json                # ESLint configuration
├── .prettierrc                   # Prettier configuration
├── .gitignore                    # Git ignore rules
├── setup.sh                      # Quick setup script
├── README.md                     # Main README
├── CHANGELOG.md                  # Version history
├── CONTRIBUTING.md               # Contribution guide
└── LICENSE                       # MIT License
```

## 🎯 Key Features

### Core SDK Features
- ✅ Chat completions with streaming
- ✅ Text embeddings
- ✅ Vector database operations
- ✅ File upload and management
- ✅ Agent tracing and observability
- ✅ Full TypeScript support
- ✅ Error handling with custom classes
- ✅ Automatic retries with exponential backoff
- ✅ Configurable timeouts and base URLs

### Documentation Features
- ✅ VitePress-based documentation site
- ✅ GitHub Pages compatible
- ✅ Interactive code examples
- ✅ API reference documentation
- ✅ User guides and tutorials
- ✅ Search functionality
- ✅ Mobile-responsive design

### Developer Experience
- ✅ ESM and CommonJS support
- ✅ Tree-shakeable builds
- ✅ Comprehensive type definitions
- ✅ Unit tests with Vitest
- ✅ Code linting and formatting
- ✅ Quick setup script

## 🚀 Quick Start

### 1. Setup Development Environment

```bash
# Clone and setup
git clone https://github.com/Cognipeer/console-sdk.git
cd console-sdk

# Run setup script
./setup.sh

# Or manually:
npm install
npm run build
npm test
```

### 2. Development Workflow

```bash
# Watch mode for development
npm run dev

# Run tests
npm test
npm run test:coverage

# Lint and format
npm run lint
npm run format

# Build
npm run build

# Preview documentation
npm run docs:dev
```

### 3. Build Documentation

```bash
# Development server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

### 4. Run Examples

```bash
cd examples
npm install
export COGNIPEER_API_KEY=your-api-key
npm run example:chat
npm run example:streaming
npm run example:rag
```

## 📦 Build Outputs

The SDK builds to multiple formats:

- **CommonJS** (`dist/index.js`) - For Node.js `require()`
- **ESM** (`dist/index.mjs`) - For modern `import`
- **TypeScript Types** (`dist/index.d.ts`) - Full type definitions

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage
```

## 📚 Documentation Structure

### User Guides (`docs/guide/`)
- Getting started guide
- Installation instructions
- Authentication setup
- Configuration options
- Error handling patterns
- Streaming guide
- Type safety guide

### API Reference (`docs/api/`)
- Client API reference
- Chat completions API
- Embeddings API
- Vectors API
- Files API
- Tracing API
- Type definitions

### Examples (`docs/examples/` & `examples/`)
- Basic chat completion
- Streaming responses
- RAG system implementation
- File upload and processing
- Agent tracing
- Function calling
- Error handling patterns

## 🔧 Configuration Files

### `package.json`
- Project metadata
- Dependencies
- Build scripts
- Publishing configuration

### `tsconfig.json`
- TypeScript compiler options
- Module resolution
- Strict type checking

### `tsup.config.ts`
- Build configuration
- Output formats (CJS/ESM)
- Bundling options

### `vitest.config.ts`
- Test environment setup
- Coverage configuration

### `.eslintrc.json` & `.prettierrc`
- Code style rules
- Formatting preferences

## 🌐 Documentation Deployment

The documentation is GitHub Pages compatible:

```bash
# Build docs
npm run docs:build

# Output in docs/.vitepress/dist
# Deploy to GitHub Pages via repository settings
```

## 📝 API Design Principles

1. **OpenAI Compatible**: Drop-in replacement for OpenAI SDK
2. **Type Safe**: Full TypeScript support
3. **Modular**: Resources organized by functionality
4. **Intuitive**: Clear method names and parameters
5. **Error Friendly**: Descriptive error messages
6. **Future Proof**: Extensible architecture

## 🎨 Code Organization

### Resource Pattern
Each API resource (chat, embeddings, vectors, etc.) is a separate class:

```typescript
client.chat.completions.create()      // ChatResource
client.embeddings.create()            // EmbeddingsResource
client.vectors.upsert()               // VectorsResource
client.files.upload()                 // FilesResource
client.tracing.ingest()               // TracingResource
```

### Type Safety
All requests and responses are fully typed:

```typescript
const request: ChatCompletionRequest = {...};
const response: ChatCompletionResponse = await client.chat.completions.create(request);
```

### Error Handling
Custom error classes for better error management:

```typescript
try {
  await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof CognipeerAPIError) {
    console.error(error.statusCode, error.errorType);
  }
}
```

## 🚢 Publishing Workflow

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Build: `npm run build`
4. Test: `npm test`
5. Publish: `npm publish`

## 📄 License

MIT License - See [LICENSE](./LICENSE) file

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines

## 🆘 Support

- 📖 [Documentation](https://cognipeer.github.io/console-sdk)
- 🐛 [Issues](https://github.com/Cognipeer/console-sdk/issues)
- 📧 [Email](mailto:support@cognipeer.com)

---

**Version**: 1.0.0  
**Last Updated**: October 9, 2025  
**Maintained by**: CognipeerAI Team
