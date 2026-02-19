# Files API

The Files API allows you to upload and manage files, with automatic markdown conversion for document processing.

## Methods

### `files.upload(params)`

Upload a file to Cognipeer Console.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params.file` | `File \| Buffer \| Blob` | Yes | The file to upload |
| `params.filename` | `string` | Yes | Name of the file |
| `params.purpose` | `'assistants' \| 'vision' \| 'batch'` | No | Purpose of the file |

**Returns:** `Promise<FileObject>`

**Example (Node.js):**

```typescript
import { readFileSync } from 'fs';

const fileContent = readFileSync('./document.pdf');

const file = await client.files.upload({
  file: fileContent,
  filename: 'document.pdf',
  purpose: 'assistants',
});

console.log('File ID:', file.id);
console.log('Markdown content:', file.markdown);
```

**Example (Browser):**

```typescript
// From file input
const input = document.querySelector('input[type="file"]');
const file = input.files[0];

const uploadedFile = await client.files.upload({
  file: file,
  filename: file.name,
  purpose: 'assistants',
});

console.log('Uploaded:', uploadedFile);
```

### `files.list(params?)`

List all uploaded files.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params.purpose` | `string` | No | Filter by purpose |
| `params.limit` | `number` | No | Maximum number of files to return |

**Returns:** `Promise<FileListResponse>`

**Example:**

```typescript
const files = await client.files.list({ limit: 10 });

files.data.forEach(file => {
  console.log(`${file.filename}: ${file.bytes} bytes`);
});
```

### `files.retrieve(fileId)`

Retrieve information about a specific file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileId` | `string` | Yes | The file ID |

**Returns:** `Promise<FileObject>`

**Example:**

```typescript
const file = await client.files.retrieve('file_abc123');
console.log(file);
```

### `files.delete(fileId)`

Delete a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileId` | `string` | Yes | The file ID |

**Returns:** `Promise<DeleteFileResponse>`

**Example:**

```typescript
const result = await client.files.delete('file_abc123');
console.log('Deleted:', result.deleted);
```

## Response Types

### `FileObject`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique file identifier |
| `object` | `'file'` | Object type |
| `bytes` | `number` | File size in bytes |
| `created_at` | `number` | Unix timestamp |
| `filename` | `string` | Original filename |
| `purpose` | `string` | File purpose |
| `markdown` | `string` | Markdown conversion (if available) |
| `status` | `'uploaded' \| 'processed' \| 'error'` | Processing status |

### `FileListResponse`

| Field | Type | Description |
|-------|------|-------------|
| `object` | `'list'` | Object type |
| `data` | `FileObject[]` | Array of files |

### `DeleteFileResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | File ID |
| `object` | `'file'` | Object type |
| `deleted` | `boolean` | Deletion status |

## Automatic Markdown Conversion

When you upload document files (PDF, DOCX, etc.), they are automatically converted to markdown format for easy text extraction and processing.

**Supported formats:**
- PDF (`.pdf`)
- Microsoft Word (`.docx`, `.doc`)
- Plain text (`.txt`)
- Markdown (`.md`)

**Example:**

```typescript
const file = await client.files.upload({
  file: pdfBuffer,
  filename: 'report.pdf',
  purpose: 'assistants',
});

// Use the markdown content
console.log(file.markdown);
// Output: "# Report Title\n\n## Section 1\n\nContent here..."
```

## Use Cases

### Document Q&A

```typescript
// 1. Upload document
const doc = await client.files.upload({
  file: documentBuffer,
  filename: 'manual.pdf',
});

// 2. Extract text
const content = doc.markdown;

// 3. Use with chat
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: `Answer questions based on this document:\n\n${content}`,
    },
    {
      role: 'user',
      content: 'What is the warranty period?',
    },
  ],
});
```

### RAG System

```typescript
// 1. Upload and convert documents
const files = await Promise.all(
  documents.map(doc => client.files.upload({
    file: doc.buffer,
    filename: doc.name,
  }))
);

// 2. Create embeddings from markdown
const embeddings = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: files.map(f => f.markdown),
});

// 3. Store in vector database
await client.vectors.upsert({
  // ... vector storage
});
```

## Error Handling

```typescript
import { CognipeerError } from '@cognipeer/console-sdk';

try {
  const file = await client.files.upload({
    file: fileBuffer,
    filename: 'document.pdf',
  });
} catch (error) {
  if (error instanceof CognipeerError) {
    if (error.status === 413) {
      console.error('File too large');
    } else if (error.status === 415) {
      console.error('Unsupported file type');
    }
  }
}
```

## Best Practices

1. **File Size**: Keep files under 10MB for optimal processing
2. **Naming**: Use descriptive filenames for easy identification
3. **Cleanup**: Delete files when no longer needed to save storage
4. **Error Handling**: Always handle upload errors gracefully
5. **Validation**: Validate file types before uploading

## Related

- [Chat API](/api/chat) - Use file content in conversations
- [Embeddings API](/api/embeddings) - Create embeddings from file content
- [File Upload Example](/examples/files) - Complete upload example
