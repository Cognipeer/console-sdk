import { HttpClient } from '../http';
import {
  RagIngestRequest,
  RagIngestFileRequest,
  RagIngestResponse,
  RagQueryRequest,
  RagQueryResponse,
  RagDeleteDocumentResponse,
  RagReingestRequest,
  RagReingestFileRequest,
  RagReingestResponse,
  RagModule,
  RagDocument,
} from '../types';

/**
 * RAG (Retrieval-Augmented Generation) API resource
 *
 * Provides document ingestion, semantic search, and document management
 * for knowledge-base modules.
 *
 * @example
 * ```typescript
 * // Ingest a document
 * const doc = await client.rag.ingest('my-kb', {
 *   fileName: 'manual.txt',
 *   content: 'Your document text…',
 * });
 *
 * // Query the knowledge base
 * const result = await client.rag.query('my-kb', {
 *   query: 'How do I reset my password?',
 *   topK: 5,
 * });
 *
 * // Delete a document
 * await client.rag.deleteDocument('my-kb', doc.document._id);
 * ```
 */
export class RagResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Ingest a document into a RAG module.
   * The content will be chunked, embedded, and indexed according to the module configuration.
   *
   * @param moduleKey - RAG module key
   * @param data - Document data (fileName + content)
   */
  async ingest(
    moduleKey: string,
    data: RagIngestRequest,
  ): Promise<RagIngestResponse> {
    return this.http.request(
      'POST',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/ingest`,
      { body: data },
    );
  }

  /**
   * Ingest a file into a RAG module.
   * The file will be converted to text (using to-markdown for binary formats),
   * then chunked, embedded, and indexed.
   *
   * @param moduleKey - RAG module key
   * @param data - File data (fileName + base64/data-URL encoded content)
   *
   * @example
   * ```typescript
   * import { readFileSync } from 'fs';
   *
   * const buf = readFileSync('report.pdf');
   * const doc = await client.rag.ingestFile('my-kb', {
   *   fileName: 'report.pdf',
   *   data: buf.toString('base64'),
   *   contentType: 'application/pdf',
   * });
   * ```
   */
  async ingestFile(
    moduleKey: string,
    data: RagIngestFileRequest,
  ): Promise<RagIngestResponse> {
    return this.http.request(
      'POST',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/ingest`,
      { body: data },
    );
  }

  /**
   * Query a RAG module with a natural-language question.
   * Returns the most relevant document chunks with scores.
   *
   * @param moduleKey - RAG module key
   * @param data - Query parameters (query text, topK, optional filter)
   */
  async query(
    moduleKey: string,
    data: RagQueryRequest,
  ): Promise<RagQueryResponse> {
    return this.http.request(
      'POST',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/query`,
      { body: data },
    );
  }

  /**
   * Delete a document and all its chunks from a RAG module.
   *
   * @param moduleKey - RAG module key
   * @param documentId - Document ID to delete
   */
  async deleteDocument(
    moduleKey: string,
    documentId: string,
  ): Promise<RagDeleteDocumentResponse> {
    return this.http.request(
      'DELETE',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/documents/${encodeURIComponent(documentId)}`,
    );
  }

  /**
   * Re-ingest a document. Deletes old chunks and re-processes.
   *
   * When called without data, it re-uses the existing chunk content.
   * You can optionally provide new text content or a file to replace
   * the document content.
   *
   * @param moduleKey - RAG module key
   * @param documentId - Document ID to re-ingest
   * @param data - Optional new content / file to replace the document with
   *
   * @example
   * ```typescript
   * // Re-ingest using existing chunks (e.g. after config change)
   * await client.rag.reingestDocument('my-kb', 'doc123');
   *
   * // Re-ingest with updated content
   * await client.rag.reingestDocument('my-kb', 'doc123', {
   *   content: 'Updated document text…',
   * });
   * ```
   */
  async reingestDocument(
    moduleKey: string,
    documentId: string,
    data?: RagReingestRequest,
  ): Promise<RagReingestResponse> {
    const normalizedBody = data
      ? {
          ...data,
          data: data.data ?? data.base64,
        }
      : {};

    return this.http.request(
      'POST',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/documents/${encodeURIComponent(documentId)}`,
      { body: normalizedBody },
    );
  }

  /**
   * Re-ingest a document with a base64/data-URL encoded file payload.
   *
   * @param moduleKey - RAG module key
   * @param documentId - Document ID to re-ingest
   * @param data - File payload (base64/data-URL)
   */
  async reingestFile(
    moduleKey: string,
    documentId: string,
    data: RagReingestFileRequest,
  ): Promise<RagReingestResponse> {
    const normalizedBody = {
      fileName: data.fileName,
      data: data.data ?? data.base64,
      contentType: data.contentType,
      metadata: data.metadata,
    };

    return this.http.request(
      'POST',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/documents/${encodeURIComponent(documentId)}`,
      { body: normalizedBody },
    );
  }

  /**
   * List documents in a RAG module.
   *
   * @param moduleKey - RAG module key
   * @param query - Optional filters
   */
  async listDocuments(
    moduleKey: string,
    query?: { status?: string; limit?: number },
  ): Promise<{ documents: RagDocument[] }> {
    return this.http.request(
      'GET',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/documents`,
      { query: query as Record<string, string | number | boolean | undefined> },
    );
  }

  /**
   * Get RAG module metadata.
   *
   * @param moduleKey - RAG module key
   */
  async getModule(moduleKey: string): Promise<{ module: RagModule }> {
    return this.http.request(
      'GET',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}`,
    );
  }

  /**
   * List available RAG modules.
   */
  async listModules(): Promise<{ modules: RagModule[] }> {
    return this.http.request('GET', '/api/client/v1/rag/modules');
  }

  /**
   * Delete a RAG module.
   *
   * @param moduleKey - RAG module key
   */
  async deleteModule(moduleKey: string): Promise<{ success: boolean }> {
    return this.http.request(
      'DELETE',
      `/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}`,
    );
  }
}
