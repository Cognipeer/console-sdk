import { ConsoleClient } from '@cognipeer/console-sdk';

/**
 * Complete RAG (Retrieval Augmented Generation) example
 */

interface Document {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

class RAGSystem {
  constructor(
    private client: ConsoleClient,
    private providerKey: string,
    private indexId: string
  ) {}

  /**
   * Add documents to the knowledge base
   */
  async addDocuments(documents: Document[]) {
    console.log(`Adding ${documents.length} documents to knowledge base...`);

    // Create embeddings for all documents
    const texts = documents.map((doc) => doc.text);
    const embeddingResponse = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    // Prepare vectors for upsert
    const vectors = documents.map((doc, i) => ({
      id: doc.id,
      values: embeddingResponse.data[i].embedding,
      metadata: {
        text: doc.text,
        ...doc.metadata,
      },
    }));

    // Upsert vectors in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await this.client.vectors.upsert(this.providerKey, this.indexId, {
        vectors: batch,
      });
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, vectors.length)} / ${vectors.length}`);
    }

    console.log('Documents added successfully!\n');
  }

  /**
   * Search for relevant documents
   */
  async search(query: string, topK = 5) {
    // Create embedding for query
    const embeddingResponse = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    // Search vector database
    const results = await this.client.vectors.query(this.providerKey, this.indexId, {
      query: {
        vector: embeddingResponse.data[0].embedding,
        topK,
      },
    });

    return results.result.matches;
  }

  /**
   * Answer a question using RAG
   */
  async answer(question: string, topK = 5) {
    console.log(`Question: ${question}\n`);

    // Search for relevant context
    console.log('Searching knowledge base...');
    const matches = await this.search(question, topK);
    console.log(`Found ${matches.length} relevant documents\n`);

    // Build context from search results
    const context = matches
      .map((match, i) => {
        return `[${i + 1}] (Score: ${match.score.toFixed(3)})\n${match.metadata?.text}`;
      })
      .join('\n\n');

    console.log('Retrieved Context:');
    console.log('---');
    console.log(context);
    console.log('---\n');

    // Generate answer using chat completion
    console.log('Generating answer...\n');
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant. Answer the user's question based on the provided context.
If the context doesn't contain relevant information, say so.

Context:
${context}`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content;
    console.log('Answer:', answer);
    console.log('\nTokens used:', response.usage.total_tokens);

    return {
      answer,
      sources: matches,
      usage: response.usage,
    };
  }

  /**
   * Answer with streaming response
   */
  async answerStream(question: string, topK = 5) {
    console.log(`Question: ${question}\n`);

    // Search for relevant context
    const matches = await this.search(question, topK);
    const context = matches
      .map((match) => match.metadata?.text)
      .filter(Boolean)
      .join('\n\n');

    console.log('Answer: ');

    // Stream the answer
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Answer based on this context:\n\n${context}`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      stream: true,
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
        fullAnswer += content;
      }
    }

    console.log('\n');
    return fullAnswer;
  }
}

// Example usage
async function main() {
  const client = new ConsoleClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  // Initialize RAG system
  const rag = new RAGSystem(client, 'my-pinecone', 'knowledge-base');

  // Sample documents (in production, load from your data source)
  const documents: Document[] = [
    {
      id: 'doc-1',
      text: 'TypeScript is a strongly typed programming language that builds on JavaScript. It adds optional static typing to JavaScript.',
      metadata: { category: 'programming', topic: 'typescript' },
    },
    {
      id: 'doc-2',
      text: 'React is a JavaScript library for building user interfaces. It lets you compose complex UIs from small, isolated pieces of code called components.',
      metadata: { category: 'programming', topic: 'react' },
    },
    {
      id: 'doc-3',
      text: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine. It uses an event-driven, non-blocking I/O model.',
      metadata: { category: 'programming', topic: 'nodejs' },
    },
    {
      id: 'doc-4',
      text: 'Machine learning is a subset of artificial intelligence that focuses on training algorithms to learn from and make predictions on data.',
      metadata: { category: 'ai', topic: 'machine-learning' },
    },
    {
      id: 'doc-5',
      text: 'Vector databases store data as high-dimensional vectors, making it easy to find similar items based on semantic meaning rather than exact matches.',
      metadata: { category: 'databases', topic: 'vectors' },
    },
  ];

  try {
    // Add documents to knowledge base
    await rag.addDocuments(documents);

    // Ask questions
    console.log('=== Question 1 ===');
    await rag.answer('What is TypeScript?', 3);

    console.log('\n=== Question 2 (Streaming) ===');
    await rag.answerStream('Explain vector databases', 3);

    console.log('\n=== Question 3 ===');
    await rag.answer('What are the benefits of machine learning?', 3);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
