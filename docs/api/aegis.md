# Aegis API

Enforcement-plane policy evaluation, exposed as `client.aegis`. Aegis evaluates tool calls, retrievals and model I/O against a **shield** — an enforcement instance with its own policy (tool allow/deny lists, egress domain and path rules, side-effect classes) and DLP settings (secret and PII redaction).

Shields are created and configured in the Console dashboard (`/dashboard/aegis`), where each shield also carries rate/size limits, per-tool argument schemas, an optional LLM judge (prompt-injection / intent-mismatch detection) and semantic PII redaction. The client surface evaluates against them and reads them back; it cannot modify policies.

::: info Enterprise module
Aegis is part of the Enterprise edition. On a tenant without an active ENTERPRISE license the endpoints return `402`.
:::

## Evaluate a call

```ts
const decision = await client.aegis.evaluate({
  stage: 'tool.pre',
  actor: { id: 'my-agent', roles: ['developer'] },
  resource: {
    type: 'tool',
    name: 'sandbox.git.push',
    arguments: { path: '/workspace/repo' },
  },
  // shieldId: 'default'  ← omit to use the built-in default shield
});

switch (decision.decision) {
  case 'allow':
  case 'redact':
    // Execute with the sanitized resource — secrets/PII are already redacted.
    await runTool(decision.sanitizedResource ?? request.resource);
    break;
  case 'sandbox':
    // Execute, but inside an isolated sandbox.
    break;
  case 'require_approval':
    // decision.approval.approvalId — a human approves it in the Console,
    // then re-run the SAME call with context.approvalToken.
    break;
  case 'block':
    throw new Error(`Blocked by policy: ${decision.reasons.join(', ')}`);
}
```

The response (`AegisEvaluation`) carries `decision`, `enforced` (false when the shield is simulating), `riskScore` (0–100), `findings` (each with `code`, `severity`, `reason`), `mutations`, the `sanitizedResource`, and `approval` when a human sign-off is required.

### Approval round-trip

A `require_approval` decision mints a **call-bound** approval: it is valid only for the identical call (same shield, tool, arguments and actor) and expires after 10 minutes.

```ts
const pending = await client.aegis.evaluate(request);
if (pending.decision === 'require_approval') {
  // → a human approves pending.approval.approvalId in the Console
  const approved = await client.aegis.evaluate({
    ...request,
    context: { ...request.context, approvalToken },
  });
  // approved.decision === 'allow'
}
```

## Shields

```ts
const shields = await client.aegis.shields.list();
// [{ id: 'default', name: 'Default', mode: 'enforce', rules: {...}, dlp: {...} }, ...]

const events = await client.aegis.shields.audit('default', { limit: 50, decision: 'block' });
// newest-first decision trail: stage, resourceName, decision, riskScore, reasons
```

## Stages

| Stage | Evaluated content |
| --- | --- |
| `input.pre` | User input before it reaches the model |
| `retrieval.pre` / `retrieval.post` | RAG queries and retrieved chunks |
| `tool.pre` / `tool.post` | Tool arguments before execution, results after |
| `output.pre` | Model output before it reaches the user |

Deterministic policy checks (tool allow/deny, roles, argument schemas, egress domains, path prefixes, side effects) run on `tool.pre`; DLP redaction runs on every stage. In `tool.pre`, e-mail addresses are flagged but never rewritten, so functional arguments like a git author stay intact.

## Types

`AegisEvaluateRequest`, `AegisEvaluation`, `AegisFinding`, `AegisShield`, `AegisToolRule`, `AegisAuditEvent`, `AegisStage`, `AegisDecision`, `AegisShieldMode`, `AegisSideEffect` — see [Types](/api/types).
