# Vector API

The Vector API provides a unified interface for managing vector databases and performing similarity search.

## Supported Providers

- Pinecone
- Chroma
- Qdrant
- Weaviate
- Milvus

## Quick Start

```typescript
// Create a provider
await client.vectors.providers.create({
  key: 'my-pinecone',
  driver: 'pinecone',
  label: 'Production Pinecone',
  credentials: {
    apiKey: 'your-pinecone-key',
    environment: 'us-east-1',
  },
});

// Create an index
await client.vectors.indexes.create('my-pinecone', {
  name: 'products',
  dimension: 1536,
  metric: 'cosine',
});

// Upsert vectors
await client.vectors.upsert('my-pinecone', 'products', {
  vectors: [
    {
      id: 'prod-1',
      values: [0.1, 0.2, ...], // 1536 dimensions
      metadata: {
        name: 'Product A',
        category: 'electronics',
      },
    },
  ],
});

// Query vectors
const results = await client.vectors.query('my-pinecone', 'products', {
  query: {
    vector: [0.1, 0.2, ...],
    topK: 10,
    filter: { category: 'electronics' },
  },
});

console.log(results.result.matches);
```

## Provider Management

### List Providers

```typescript
const { providers } = await client.vectors.providers.list();

// Filter by status
const active = await client.vectors.providers.list({ 
  status: 'active' 
});

// Filter by driver
const pinecone = await client.vectors.providers.list({ 
  driver: 'pinecone' 
});
```

### Create Provider

```typescript
await client.vectors.providers.create({
  key: 'my-provider',
  driver: 'pinecone',
  label: 'My Vector Store',
  description: 'Production vector database',
  status: 'active',
  credentials: {
    apiKey: 'your-api-key',
    environment: 'us-east-1',
  },
  settings: {
    // Provider-specific settings
  },
  metadata: {
    region: 'us-east',
    environment: 'production',
  },
});
```

## Index Management

### List Indexes

```typescript
const { indexes } = await client.vectors.indexes.list('my-provider');
```

### Create Index

```typescript
const { index, reused } = await client.vectors.indexes.create('my-provider', {
  name: 'my-index',
  dimension: 1536,
  metric: 'cosine', // 'cosine' | 'euclidean' | 'dotproduct'
  metadata: {
    description: 'Product embeddings',
  },
});

if (reused) {
  console.log('Index already exists, reusing');
}
```

### Get Index

```typescript
const { index, provider } = await client.vectors.indexes.get(
  'my-provider',
  'my-index'
);
```

### Update Index

```typescript
await client.vectors.indexes.update('my-provider', 'my-index', {
  name: 'updated-name',
  metadata: {
    version: '2.0',
  },
});
```

### Delete Index

```typescript
await client.vectors.indexes.delete('my-provider', 'my-index');
```

## Vector Operations

### Upsert Vectors

Insert or update vectors:

```typescript
await client.vectors.upsert('my-provider', 'my-index', {
  vectors: [
    {
      id: 'vec-1',
      values: [0.1, 0.2, 0.3, ...],
      metadata: {
        text: 'Hello world',
        category: 'greeting',
        timestamp: Date.now(),
      },
    },
    {
      id: 'vec-2',
      values: [0.4, 0.5, 0.6, ...],
      metadata: {
        text: 'Goodbye world',
        category: 'farewell',
      },
    },
  ],
});
```

### Query Vectors

Search for similar vectors:

```typescript
const results = await client.vectors.query('my-provider', 'my-index', {
  query: {
    vector: [0.1, 0.2, 0.3, ...],
    topK: 10,
    filter: {
      category: 'greeting',
    },
  },
});

for (const match of results.result.matches) {
  console.log('ID:', match.id);
  console.log('Score:', match.score);
  console.log('Metadata:', match.metadata);
}
```

### Delete Vectors

Delete specific vectors by ID:

```typescript
await client.vectors.delete('my-provider', 'my-index', [
  'vec-1',
  'vec-2',
  'vec-3',
]);
```

## RAG Example

Complete RAG (Retrieval Augmented Generation) workflow:

```typescript
// 1. Create embeddings
const embeddingResponse = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'What is machine learning?',
});

const queryVector = embeddingResponse.data[0].embedding;

// 2. Search for relevant context
const searchResults = await client.vectors.query('my-provider', 'knowledge-base', {
  query: {
    vector: queryVector,
    topK: 5,
  },
});

// 3. Build context from results
const context = searchResults.result.matches
  .map(match => match.metadata?.text)
  .join('\n\n');

// 4. Generate response with context
const chatResponse = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: `Answer based on this context:\n\n${context}`,
    },
    {
      role: 'user',
      content: 'What is machine learning?',
    },
  ],
});

console.log(chatResponse.choices[0].message.content);
```

## Batch Operations

Process vectors in batches for efficiency:

```typescript
const BATCH_SIZE = 100;

async function upsertInBatches(vectors: Vector[]) {
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    
    await client.vectors.upsert('my-provider', 'my-index', {
      vectors: batch,
    });
    
    console.log(`Processed ${Math.min(i + BATCH_SIZE, vectors.length)} / ${vectors.length}`);
  }
}
```

## Metrics

### Cosine Similarity

Measures angle between vectors (range: -1 to 1):

```typescript
metric: 'cosine' // Most common for text embeddings
```

### Euclidean Distance

Measures straight-line distance:

```typescript
metric: 'euclidean'
```

### Dot Product

Measures vector alignment:

```typescript
metric: 'dotproduct'
```

## Best Practices

1. **Dimension Consistency**: Ensure all vectors have the same dimension
2. **Metadata Indexing**: Use metadata for filtering
3. **Batch Operations**: Process vectors in batches for better performance
4. **Error Handling**: Always handle potential errors
5. **Token Usage**: Monitor embedding API costs

## See Also

- [Embeddings API](/api/embeddings)
- [RAG Example](/examples/rag)
- [Vector Examples](/examples/vectors)
