# Files API

The Files API is bucket-based. Files live in **buckets**, and buckets are
backed by **providers** (S3-compatible storage, Azure Blob, etc).

```text
files.providers   → manage the underlying storage providers (admin-level)
files.buckets     → list / inspect available buckets
files                → CRUD on objects inside a bucket
```

## Buckets

### `client.files.buckets.list()`

```typescript
const { buckets, count } = await client.files.buckets.list();
```

### `client.files.buckets.get(bucketKey)`

```typescript
const { bucket } = await client.files.buckets.get('user-uploads');
```

## Objects

### `client.files.list(bucketKey, query?)`

```typescript
const { files, count, nextCursor } = await client.files.list('user-uploads', {
  limit: 50,
  search: 'invoice',
});
```

### `client.files.upload(bucketKey, data)`

Upload a file using a base64 / data-URL payload. Set `convertToMarkdown: true`
to ask the server to extract markdown text from PDFs and other documents.

```typescript
import { readFileSync } from 'node:fs';

const pdf = readFileSync('./report.pdf');

const { file } = await client.files.upload('user-uploads', {
  fileName: 'report.pdf',
  contentType: 'application/pdf',
  data: pdf.toString('base64'),
  convertToMarkdown: true,
});

console.log(file.markdownContent?.slice(0, 200));
```

### `client.files.get(bucketKey, objectKey)`

```typescript
const { file } = await client.files.get('user-uploads', 'report.pdf');
```

### `client.files.delete(bucketKey, objectKey)`

```typescript
await client.files.delete('user-uploads', 'report.pdf');
```

### `client.files.download(bucketKey, objectKey)`

Returns the raw bytes plus the response `Content-Type` header.

```typescript
import { writeFileSync } from 'node:fs';

const { data, contentType } = await client.files.download('user-uploads', 'report.pdf');
writeFileSync('./local-report.pdf', data);
console.log(contentType); // application/pdf
```

## Providers

### `client.files.providers.list(query?)`

```typescript
const providers = await client.files.providers.list({ status: 'active' });
```

### `client.files.providers.create(data)`

```typescript
const provider = await client.files.providers.create({
  key: 'tenant-s3',
  driver: 's3',
  label: 'Tenant S3 bucket',
  credentials: {
    accessKeyId: '…',
    secretAccessKey: '…',
    region: 'eu-central-1',
    bucket: 'tenant-files',
  },
});
```

## Types

```typescript
interface FileBucket {
  _id: string;
  key: string;
  name: string;
  description?: string;
  provider: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface FileObject {
  _id: string;
  key: string;
  bucketKey: string;
  fileName: string;
  contentType: string;
  size: number;
  metadata?: Record<string, unknown>;
  markdownContent?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UploadFileRequest {
  fileName: string;
  contentType?: string;
  data: string;             // base64 or data URL
  metadata?: Record<string, unknown>;
  convertToMarkdown?: boolean;
  keyHint?: string;
}

interface FileProvider {
  _id: string;
  key: string;
  driver: string;
  label: string;
  description?: string;
  status: string;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  capabilities?: string[] | Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
```

## Related

- [RAG API](/api/rag) — indexed knowledge bases on top of buckets.
- [OCR API](/api/ocr) — extract text from files without persisting them.
- [Chat API](/api/chat) — feed file contents into conversations.
