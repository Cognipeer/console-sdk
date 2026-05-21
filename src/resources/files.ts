import { HttpClient } from '../http';
import {
  CreateFileProviderRequest,
  FileBucket,
  FileObject,
  FileProvider,
  ListFileProvidersQuery,
  ListFilesQuery,
  UploadFileRequest,
} from '../types';

/**
 * Files API resource
 */
export class FilesResource {
  private http: HttpClient;
  public buckets: FileBucketsResource;
  public providers: FileProvidersResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.buckets = new FileBucketsResource(http);
    this.providers = new FileProvidersResource(http);
  }

  /**
   * Download a file's bytes. The server streams the underlying object as-is,
   * so the response is binary.
   */
  async download(
    bucketKey: string,
    objectKey: string,
  ): Promise<{ data: Uint8Array; contentType: string }> {
    const { data, contentType } = await this.http.requestBinary(
      'GET',
      `/api/client/v1/files/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}/download`,
    );
    return { data, contentType };
  }

  /**
   * List files in a bucket
   * @param bucketKey - Bucket identifier
   * @param query - Optional filters and pagination
   */
  async list(
    bucketKey: string,
    query?: ListFilesQuery
  ): Promise<{ files: FileObject[]; count: number; nextCursor?: string | null }> {
    return this.http.request('GET', `/api/client/v1/files/buckets/${bucketKey}/objects`, {
      query: query as Record<string, string | number | boolean | undefined>,
    });
  }

  /**
   * Upload a file to a bucket
   * @param bucketKey - Bucket identifier
   * @param data - File data
   */
  async upload(
    bucketKey: string,
    data: UploadFileRequest
  ): Promise<{ file: FileObject; message?: string }> {
    return this.http.request('POST', `/api/client/v1/files/buckets/${bucketKey}/objects`, {
      body: data,
    });
  }

  /**
   * Get a file object metadata
   * @param bucketKey - Bucket identifier
   * @param objectKey - Object identifier
   */
  async get(bucketKey: string, objectKey: string): Promise<{ file: FileObject }> {
    return this.http.request(
      'GET',
      `/api/client/v1/files/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}`,
    );
  }

  /**
   * Delete a file object from bucket
   * @param bucketKey - Bucket identifier
   * @param objectKey - Object identifier
   */
  async delete(
    bucketKey: string,
    objectKey: string,
  ): Promise<{ message: string; bucketKey: string; objectKey: string }> {
    return this.http.request(
      'DELETE',
      `/api/client/v1/files/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}`,
    );
  }
}

/**
 * File buckets resource
 */
export class FileBucketsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List all file buckets
   */
  async list(): Promise<{ buckets: FileBucket[]; count: number }> {
    return this.http.request('GET', '/api/client/v1/files/buckets');
  }

  /**
   * Get bucket details
   * @param bucketKey - Bucket identifier
   */
  async get(bucketKey: string): Promise<{ bucket: FileBucket }> {
    return this.http.request('GET', `/api/client/v1/files/buckets/${bucketKey}`);
  }
}

/**
 * File providers resource (admin-level: storage backends behind buckets).
 */
export class FileProvidersResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List configured file providers. */
  async list(query?: ListFileProvidersQuery): Promise<FileProvider[]> {
    const res = await this.http.request<{ providers: FileProvider[] }>(
      'GET',
      '/api/client/v1/files/providers',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.providers ?? [];
  }

  /** Create a new file provider. */
  async create(data: CreateFileProviderRequest): Promise<FileProvider> {
    const res = await this.http.request<{ provider: FileProvider }>(
      'POST',
      '/api/client/v1/files/providers',
      { body: data },
    );
    return res.provider;
  }
}
