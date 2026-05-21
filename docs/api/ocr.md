# OCR API

Extract text, tables, layout, and key/value pairs from PDFs or images.

## `client.ocr.extract(params)`

Pass either a remote URL or a base64-encoded payload as the `document` field.
When a base64 payload is supplied, the SDK sends the request as
`multipart/form-data`.

```typescript
import { readFileSync } from 'node:fs';
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
  baseURL: process.env.COGNIPEER_BASE_URL,
});

// 1. From a buffer (multipart upload)
const result = await client.ocr.extract({
  model: 'cognipeer-ocr',
  document: {
    data: readFileSync('invoice.pdf').toString('base64'),
    fileName: 'invoice.pdf',
    contentType: 'application/pdf',
  },
  features: ['text', 'tables', 'kv_pairs'],
  pages: [1, 2],
});

console.log(result.text);

// 2. From a public URL
const remote = await client.ocr.extract({
  model: 'cognipeer-ocr',
  document: { url: 'https://example.com/receipt.png' },
  features: ['text'],
});
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `model` | `string` | OCR model key. |
| `document` | `{ url: string; contentType?: string } \| { data: string; fileName?: string; contentType?: string }` | Document source. |
| `pages` | `number[]` | 1-based page numbers to OCR. |
| `language` | `string` | Source language hint. |
| `features` | `Array<'text' \| 'tables' \| 'kv_pairs' \| 'layout' \| 'reading_order' \| 'handwriting'>` | OCR features to enable. |
| `prompt` | `string` | Optional natural-language extraction instructions. |

### Response shape

```typescript
interface OcrExtractResponse {
  text?: string;
  pages?: Array<{
    page: number;
    text?: string;
    blocks?: Array<Record<string, unknown>>;
  }>;
  language?: string;
  features?: Record<string, unknown>;
  request_id?: string;
}
```
