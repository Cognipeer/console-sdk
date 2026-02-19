# Embeddings API

The Embeddings API allows you to convert text into vector representations for semantic search and similarity matching.

## Methods

### `embeddings.create(params)`

Create embeddings for the given input text.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params.model` | `string` | Yes | The embedding model to use |
| `params.input` | `string \| string[]` | Yes | Text or array of texts to embed |
| `params.encoding_format` | `'float' \| 'base64'` | No | Format of the embedding vectors |
| `params.dimensions` | `number` | No | Number of dimensions for the embeddings |
| `params.user` | `string` | No | Unique identifier for end-user tracking |

**Returns:** `Promise<EmbeddingResponse>`

**Example:**

```typescript
// Single text embedding
const response = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'The quick brown fox jumps over the lazy dog',
});

console.log(response.data[0].embedding);
```

```typescript
// Multiple text embeddings
const response = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: [
    'First document',
    'Second document',
    'Third document',
  ],
});

response.data.forEach((item, index) => {
  console.log(`Embedding ${index}:`, item.embedding);
});
```

## Response Format

### `EmbeddingResponse`

| Field | Type | Description |
|-------|------|-------------|
| `object` | `'list'` | Object type identifier |
| `data` | `EmbeddingObject[]` | Array of embedding objects |
| `model` | `string` | The model used for embeddings |
| `usage` | `EmbeddingUsage` | Token usage information |

### `EmbeddingObject`

| Field | Type | Description |
|-------|------|-------------|
| `object` | `'embedding'` | Object type identifier |
| `embedding` | `number[]` | The embedding vector |
| `index` | `number` | Index of the embedding in the list |

### `EmbeddingUsage`

| Field | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | `number` | Number of tokens in the input |
| `total_tokens` | `number` | Total tokens used |

## Error Handling

```typescript
import { CognipeerError } from '@cognipeer/console-sdk';

try {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'Hello world',
  });
  console.log(response.data);
} catch (error) {
  if (error instanceof CognipeerError) {
    console.error('Status:', error.status);
    console.error('Message:', error.message);
  }
}
```

## Available Models

Common embedding models:
- `text-embedding-3-small` - Fast and efficient (1536 dimensions)
- `text-embedding-3-large` - Higher quality (3072 dimensions)
- `text-embedding-ada-002` - Legacy model (1536 dimensions)

::: tip
Use smaller models for faster processing and lower costs. Use larger models when you need higher quality embeddings for complex semantic tasks.
:::

## Use Cases

### Semantic Search

```typescript
// 1. Embed your documents
const docs = ['Document 1', 'Document 2', 'Document 3'];
const docEmbeddings = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: docs,
});

// 2. Embed the search query
const queryEmbedding = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'search query',
});

// 3. Calculate similarity and find best match
// (Use cosine similarity or store in vector database)
```

### Text Similarity

```typescript
const texts = [
  'The cat sat on the mat',
  'A dog played in the park',
];

const embeddings = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: texts,
});

// Compare embeddings to measure similarity
```

## Best Practices

1. **Batch Processing**: Embed multiple texts at once to reduce API calls
2. **Caching**: Store embeddings to avoid re-computing for the same text
3. **Normalization**: Normalize embeddings before calculating similarity
4. **Model Selection**: Choose the right model based on your accuracy/speed requirements

## Related

- [Chat API](/api/chat) - Generate text with language models
- [Vectors API](/api/vectors) - Store and query embeddings in vector databases
- [RAG Example](/examples/rag) - Build Retrieval Augmented Generation systems
