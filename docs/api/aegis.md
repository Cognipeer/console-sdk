# Aegis API — removed

::: danger This surface no longer exists
The Aegis enforcement plane has been removed from the Console.
`/api/client/v1/aegis/*` is gone, and every `client.aegis.*` method now **throws**
instead of issuing a request that would fail. `client.aegis` itself is kept only so
a 1.x build keeps compiling; it is deleted in the next major.

Guardrails replaced it. This page is the migration.
:::

## What maps to what

| Aegis | Guardrails |
| --- | --- |
| a **shield** | a **guardrail** |
| `shieldId` | `guardrail_key` |
| `client.aegis.shields.list()` | [`client.guardrails.list()`](/api/guardrails) |
| `client.aegis.evaluate({ stage, resource })` | `client.guardrails.hooks.evaluate({ hook, tool_name, tool_args })` |
| `stage: 'tool.pre' \| 'tool.post' \| 'input.pre' \| 'output.pre'` | the same names, as `hook` — unchanged |
| `stage: 'retrieval.pre' \| 'retrieval.post'` | **no equivalent** — there is no retrieval hook |
| `client.aegis.shields.audit(id)` | **no client-API equivalent** — see below |
| `decision.decision` | `verdict.decision`, but read it with `shouldBlock()` |

## Evaluating a call

```ts
import { shouldBlock } from '@cognipeer/console-sdk';

const verdict = await client.guardrails.hooks.evaluate({
  hook: 'tool.pre',
  guardrail_key: 'corporate-policy',
  tool_name: 'sandbox.git.push',
  tool_args: { path: '/workspace/repo' },
});

if (shouldBlock(verdict)) {
  throw new Error(verdict.message?.body ?? 'Blocked by policy.');
}
await runTool(verdict.subject ?? request.resource);
```

### Read the decision with `shouldBlock`, never with `decision === 'block'`

A guardrail in **monitor** mode still reports what it *would* have done. Its verdict
carries `decision: 'block'` with `enforced: false`, and acting on the first field
alone turns every monitoring policy into an enforcing one the day someone switches
it on to observe. `shouldBlock(verdict)` reads both.

The same trap has a second face: `passed` means "no blocking finding existed", not
"the request was allowed". The two diverge in monitor mode, which is exactly when
someone reads the wrong one.

## Audit trails

`shields.audit()` has **no client-API replacement**. Guardrail decisions are written
as evaluation logs and read in the Console dashboard. Every verdict carries
`trace_id` and `policy_version`, which is how you correlate a call you made with the
row the Console recorded for it.

## MCP servers

`McpServer.aegis` is deprecated in favour of `guardrail`:

```ts
await client.mcp.update(serverId, {
  guardrail: { guardrailKey: 'corporate-policy', mode: 'enforce' },
});
```

Omitting `guardrailKey` selects the tenant's default tool guardrail, which is what
keeps a server armed with no per-server setup — to turn enforcement off, send
`mode: 'off'`. The `aegis` field is still accepted for one more release; where both
are sent, `guardrail` wins.

## What has no replacement

Be direct about these rather than discovering them at runtime:

- **`retrieval.pre` / `retrieval.post`.** The hook plane has six hooks and neither of
  these is one of them.
- **`shields.audit()`.** Dashboard only, as above.
- **`/dashboard/aegis`.** The screens are gone; guardrails live at
  `/dashboard/guardrails`.

See [Guardrails](/api/guardrails) for the full surface.
