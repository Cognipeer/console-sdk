import { describe, it, expect } from 'vitest';
import { FilesResource, FileBucketsResource, FileProvidersResource } from './files';
import { createMockHttp } from '../test/mockHttp';
import type {
  CreateFileProviderRequest,
  FileBucket,
  FileObject,
  FileProvider,
  UploadFileRequest,
} from '../types';

describe('FilesResource', () => {
  it('downloads a file via GET .../buckets/{bucketKey}/objects/{objectKey}/download using requestBinary', async () => {
    const http = createMockHttp();
    http.requestBinary.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      contentType: 'application/octet-stream',
      requestId: 'req_1',
    });
    const resource = new FilesResource(http);

    const result = await resource.download('bucket_1', 'object_1');

    expect(result).toEqual({ data: new Uint8Array([1, 2, 3]), contentType: 'application/octet-stream' });
    expect(http.requestBinary).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/files/buckets/bucket_1/objects/object_1/download',
    );
  });

  it('encodes bucket and object keys when downloading', async () => {
    const http = createMockHttp();
    http.requestBinary.mockResolvedValue({
      data: new Uint8Array([]),
      contentType: 'application/octet-stream',
      requestId: 'req_1',
    });
    const resource = new FilesResource(http);

    await resource.download('bucket/with space', 'object/with space');

    expect(http.requestBinary).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/files/buckets/${encodeURIComponent('bucket/with space')}/objects/${encodeURIComponent('object/with space')}/download`,
    );
  });

  it('lists files in a bucket with query filters via GET .../buckets/{bucketKey}/objects', async () => {
    const http = createMockHttp();
    const response = { files: [] as FileObject[], count: 0, nextCursor: null };
    http.request.mockResolvedValue(response);
    const resource = new FilesResource(http);

    const query = { search: 'report', limit: 10 };
    const result = await resource.list('bucket_1', query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/files/buckets/bucket_1/objects',
      { query },
    );
  });

  it('passes an undefined query through to list when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ files: [], count: 0 });
    const resource = new FilesResource(http);

    await resource.list('bucket_1');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/files/buckets/bucket_1/objects',
      { query: undefined },
    );
  });

  it('uploads a file via POST .../buckets/{bucketKey}/objects', async () => {
    const http = createMockHttp();
    const file: FileObject = {
      _id: 'obj_1',
      key: 'object_1',
      bucketKey: 'bucket_1',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      size: 1024,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const response = { file, message: 'uploaded' };
    http.request.mockResolvedValue(response);
    const resource = new FilesResource(http);

    const data: UploadFileRequest = { fileName: 'report.pdf', data: 'base64data==' };
    const result = await resource.upload('bucket_1', data);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/files/buckets/bucket_1/objects',
      { body: data },
    );
  });

  it('does not encode the bucket key for list/upload paths', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ files: [], count: 0 });
    const resource = new FilesResource(http);

    await resource.list('bucket with space');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/files/buckets/bucket with space/objects',
      { query: undefined },
    );
  });

  it('gets a file object via GET .../buckets/{bucketKey}/objects/{objectKey}', async () => {
    const http = createMockHttp();
    const response = {
      file: {
        _id: 'obj_1',
        key: 'object_1',
        bucketKey: 'bucket_1',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        size: 1024,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      } as FileObject,
    };
    http.request.mockResolvedValue(response);
    const resource = new FilesResource(http);

    const result = await resource.get('bucket_1', 'object_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/api/client/v1/files/buckets/bucket_1/objects/object_1',
    );
  });

  it('encodes bucket and object keys when getting', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ file: {} as FileObject });
    const resource = new FilesResource(http);

    await resource.get('bucket/with space', 'object/with space');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `/api/client/v1/files/buckets/${encodeURIComponent('bucket/with space')}/objects/${encodeURIComponent('object/with space')}`,
    );
  });

  it('deletes a file object via DELETE .../buckets/{bucketKey}/objects/{objectKey}', async () => {
    const http = createMockHttp();
    const response = { message: 'deleted', bucketKey: 'bucket_1', objectKey: 'object_1' };
    http.request.mockResolvedValue(response);
    const resource = new FilesResource(http);

    const result = await resource.delete('bucket_1', 'object_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      '/api/client/v1/files/buckets/bucket_1/objects/object_1',
    );
  });

  it('encodes bucket and object keys when deleting', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ message: 'deleted', bucketKey: 'b', objectKey: 'o' });
    const resource = new FilesResource(http);

    await resource.delete('bucket/with space', 'object/with space');

    expect(http.request).toHaveBeenCalledWith(
      'DELETE',
      `/api/client/v1/files/buckets/${encodeURIComponent('bucket/with space')}/objects/${encodeURIComponent('object/with space')}`,
    );
  });
});

describe('FileBucketsResource', () => {
  it('lists all buckets via GET /api/client/v1/files/buckets', async () => {
    const http = createMockHttp();
    const response = { buckets: [] as FileBucket[], count: 0 };
    http.request.mockResolvedValue(response);
    const resource = new FileBucketsResource(http);

    const result = await resource.list();

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/files/buckets');
  });

  it('gets bucket details via GET /api/client/v1/files/buckets/{bucketKey} without encoding', async () => {
    const http = createMockHttp();
    const bucket: FileBucket = {
      _id: 'bucket_1',
      key: 'bucket_1',
      name: 'Reports',
      provider: 'default',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const response = { bucket };
    http.request.mockResolvedValue(response);
    const resource = new FileBucketsResource(http);

    const result = await resource.get('bucket_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/files/buckets/bucket_1');
  });
});

describe('FileProvidersResource', () => {
  it('lists file providers with query filters via GET /api/client/v1/files/providers', async () => {
    const http = createMockHttp();
    const providers: FileProvider[] = [
      { _id: 'p1', key: 's3-main', driver: 's3', label: 'Main S3', status: 'active' },
    ];
    http.request.mockResolvedValue({ providers });
    const resource = new FileProvidersResource(http);

    const query = { driver: 's3' };
    const result = await resource.list(query);

    expect(result).toBe(providers);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/files/providers', { query });
  });

  it('returns an empty array when the providers envelope has no providers', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new FileProvidersResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/files/providers', {
      query: undefined,
    });
  });

  it('creates a file provider via POST /api/client/v1/files/providers', async () => {
    const http = createMockHttp();
    const provider: FileProvider = {
      _id: 'p1',
      key: 's3-main',
      driver: 's3',
      label: 'Main S3',
      status: 'active',
    };
    http.request.mockResolvedValue({ provider });
    const resource = new FileProvidersResource(http);

    const data: CreateFileProviderRequest = {
      key: 's3-main',
      driver: 's3',
      label: 'Main S3',
      credentials: { accessKeyId: 'AKIA...' },
    };
    const result = await resource.create(data);

    expect(result).toBe(provider);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/files/providers', {
      body: data,
    });
  });
});
