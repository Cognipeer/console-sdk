# Agent Sandbox API

Remote, API-driven runtime sandboxes — spin up an isolated container, run commands and code, manage files and git, and stream long-running output. Designed for AI-agent callers. The surface lives on `client.sandbox`.

::: info JS Sandbox vs Agent Sandbox
This is **not** the [JS Sandbox](/api/js-sandbox) (which runs short JavaScript snippets in-process). The Agent Sandbox boots a full Linux container you drive over its whole lifecycle.
:::

## Overview

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({ apiKey: process.env.COGNIPEER_API_KEY! });
```

## Create, run, tear down

A sandbox starts automatically; poll `waitUntilRunning()` before driving it.

```typescript
const sbx = await client.sandbox.create({ template: 'node-20' });
await client.sandbox.waitUntilRunning(sbx.id);

const res = await client.sandbox.exec(sbx.id, { command: 'node --version' });
console.log(res.exitCode, res.stdout);

await client.sandbox.delete(sbx.id);
```

### Run code

```typescript
const out = await client.sandbox.code(sbx.id, {
  language: 'python',
  code: 'print(sum(range(10)))',
});
```

### Lifecycle

```typescript
await client.sandbox.stop(sbx.id);   // keep a persistent sandbox around
await client.sandbox.start(sbx.id);  // resume it later
const all = await client.sandbox.list();
```

## Files (filesystem)

`client.sandbox.fs.*` operates on the **live container filesystem** with absolute paths.

```typescript
await client.sandbox.fs.write(sbx.id, '/workspace/app.js', 'console.log(1)');
const entries = await client.sandbox.fs.list(sbx.id, '/workspace');
const file = await client.sandbox.fs.read(sbx.id, '/workspace/app.js');
await client.sandbox.fs.mkdir(sbx.id, '/workspace/src');
await client.sandbox.fs.move(sbx.id, '/workspace/app.js', '/workspace/src/app.js');
await client.sandbox.fs.delete(sbx.id, '/workspace/tmp', true /* recursive */);
const hits = await client.sandbox.fs.find(sbx.id, '/workspace', 'TODO');
await client.sandbox.fs.replace(sbx.id, ['/workspace/src/app.js'], 'console', 'logger');
```

## Files (volume)

`uploadFiles` / `listFiles` / `downloadFile` operate on the sandbox's **attached volume** (object storage) — they work whether or not the container is running, and require a volume to be attached.

```typescript
await client.sandbox.uploadFiles(sbx.id, [
  { path: 'data/input.csv', data: base64Csv, contentType: 'text/csv' },
]);
const { items } = await client.sandbox.listFiles(sbx.id, { limit: 100 });
const { data } = await client.sandbox.downloadFile(sbx.id, 'data/input.csv');
```

## Git

`client.sandbox.git.*` runs git inside the container; `path` is the repo root.

```typescript
await client.sandbox.git.clone(sbx.id, { url: 'https://github.com/acme/repo', path: '/workspace/repo' });
const status = await client.sandbox.git.status(sbx.id, '/workspace/repo');
await client.sandbox.git.checkout(sbx.id, '/workspace/repo', 'feature');
await client.sandbox.git.add(sbx.id, '/workspace/repo', ['.']);
const { hash } = await client.sandbox.git.commit(sbx.id, {
  path: '/workspace/repo', message: 'wip', author: 'Agent', email: 'agent@acme.dev',
});
await client.sandbox.git.push(sbx.id, { path: '/workspace/repo', username: 'x', password: token });
```

Also available: `branches`, `createBranch`, `deleteBranch`, `pull`, `log`.

## Detached command sessions

Run long-running commands in the background and poll their logs.

```typescript
const { sessionId } = await client.sandbox.sessions.create(sbx.id);
const { commandId } = await client.sandbox.sessions.exec(sbx.id, sessionId, 'npm run build');

const logs = await client.sandbox.sessions.logs(sbx.id, sessionId, commandId);
console.log(logs.stdout, logs.exitCode, logs.running);
```

## Snapshots, fork, restore

```typescript
const snap = await client.sandbox.snapshot(sbx.id, { name: 'baseline', export: true });
const clone = await client.sandbox.fork(sbx.id, { name: 'experiment', persist: true });

const snapshots = await client.sandbox.listSnapshots();
const resumed = await client.sandbox.restoreSnapshot(snap.id, { name: 'from-baseline' });
```

## Method reference

### `client.sandbox`

| Method | Description |
| --- | --- |
| `create(data?)` | Create a sandbox (auto-starts) |
| `list()` / `get(id)` / `delete(id)` | List, fetch status, remove |
| `exec(id, data)` | Run a shell command synchronously |
| `code(id, data)` | Run a code snippet |
| `start(id)` / `stop(id)` | Resume / stop a persistent sandbox |
| `uploadFiles(id, files)` / `listFiles(id, opts?)` / `downloadFile(id, path)` | Volume file IO |
| `snapshot(id, data?)` / `fork(id, data?)` | Capture / clone |
| `listSnapshots()` / `restoreSnapshot(id, data?)` | List / resume snapshots |
| `waitUntilRunning(id, opts?)` | Poll until `running` (throws on terminal state/timeout) |

### `client.sandbox.fs`

`list`, `info`, `read`, `write`, `mkdir`, `delete`, `move`, `find`, `replace`

### `client.sandbox.git`

`clone`, `status`, `branches`, `createBranch`, `deleteBranch`, `checkout`, `add`, `commit`, `push`, `pull`, `log`

### `client.sandbox.sessions`

`create`, `list`, `delete`, `exec`, `logs`

See the console-side [Agent Sandbox guide](https://cognipeer.github.io/cognipeer-console/guide/sandbox) for the dashboard, runners, and templates that back this API.
