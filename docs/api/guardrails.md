# Guardrails API

Use Guardrails API to evaluate content against your configured tenant guardrails.

## `client.guardrails.evaluate(data)`

Evaluate text against a named guardrail.

### Parameters

```typescript
interface GuardrailEvaluateRequest {
  guardrail_key: string;
  text: string;
  target?: 'input' | 'output' | 'both';
}
```

### Returns

```typescript
interface GuardrailEvaluateResponse {
  passed: boolean;
  guardrail_key: string;
  guardrail_name: string;
  action: 'block' | 'warn' | 'flag';
  findings: Array<{
    type: 'pii' | 'moderation' | 'prompt_shield' | 'custom';
    category: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    action: 'block' | 'warn' | 'flag';
    block: boolean;
    value?: string;
  }>;
  message: string | null;
}
```

### JavaScript Example

```javascript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_TOKEN,
  baseURL: 'https://your-cognipeer-host',
});

const result = await client.guardrails.evaluate({
  guardrail_key: 'pii-shield',
  text: 'My SSN is 123-45-6789',
});

if (!result.passed) {
  console.log('Blocked:', result.message);
  for (const finding of result.findings) {
    console.log(`[${finding.severity}] ${finding.category}: ${finding.message}`);
  }
}
```

### TypeScript Example

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_TOKEN as string,
  baseURL: 'https://your-cognipeer-host',
});

const result = await client.guardrails.evaluate({
  guardrail_key: 'pii-shield',
  text: 'My SSN is 123-45-6789',
  target: 'input',
});

if (!result.passed) {
  result.findings.forEach((finding) => {
    console.log(`[${finding.severity}] ${finding.category}: ${finding.message}`);
  });
}
```
