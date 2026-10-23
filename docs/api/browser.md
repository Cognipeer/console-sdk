# Browser API

Use the browser surface when you need one of these paths:

- direct browser automation from your application code,
- a **flow**: a task you drive once, record, and then replay without a model in the loop,
- a Browser MCP server, published from the Console's MCP module, that exposes the Browser Use toolset.

The old standalone `client.browserAgents` API has been removed. If you want a Console-managed agent to browse the web, attach the `Browser Use` system tool in Console and invoke that agent through `client.agents`.

## Browser Profiles

Browser profiles are reusable parent containers. They hold the default session config, artifact bucket, and metadata used by browser sessions and by a Browser MCP server that publishes the profile.

### `client.browsers.create(input)`

Create a browser profile.

```ts
const browser = await client.browsers.create({
  name: 'research-browser',
  defaultSessionConfig: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    idleTimeoutMs: 120000,
  },
});
```

### `client.browsers.list(query?)`

List browser profiles. Supports `status` filtering.

### `client.browsers.get(idOrKey)`

Fetch one browser profile by id or key.

### `client.browsers.update(idOrKey, input)`

Update browser profile metadata, defaults, or status.

### `client.browsers.delete(idOrKey)`

Delete a browser profile.

### `client.browsers.setProfile(idOrKey, storageState, fileName?)`

Attach a **signed-in profile** so every session this browser opens starts already authenticated, instead of pushing credentials through a login form on each run.

Pass a Playwright `storageState` export: the object `context.storageState()` writes, or what `browserSessions.exportProfile()` returns after you sign in by hand. It must carry cookies and/or origin storage. The profile is encrypted on the server and **never readable back**: the call returns only a summary, and the same summary is on `browser.storageStateMeta`.

```ts
import { readFile } from 'node:fs/promises';

const state = JSON.parse(await readFile('profile.json', 'utf8'));
const summary = await client.browsers.setProfile('research-browser', state, 'profile.json');

console.log(summary.cookieCount, summary.origins, summary.earliestExpiry);
```

`earliestExpiry` is the soonest cookie expiry (session cookies are ignored): warn before the profile goes stale. `fileName` is kept on the summary as `sourceFileName`.

A profile is the lowest-priority source of session state: the browser's `defaultSessionConfig` and the session's own `config` are applied on top of it.

### `client.browsers.clearProfile(idOrKey)`

Remove the signed-in profile. New sessions start signed out.

## Browser Sessions

Browser sessions are the direct automation surface. You create a session under a browser profile, drive it with discrete actions, and optionally persist screenshots or PDFs.

### `client.browserSessions.create(input)`

```ts
const session = await client.browserSessions.create({
  browserId: browser.id,
  name: 'akbank-research',
});
```

`browserId` is the browser's `id`, not its key.

### Addressing elements

An action names the element it acts on in one of two ways, and only one of them survives being saved.

- **`ref`**: a marker from the latest `snapshot()` (the `[ref=e4]` tokens in the aria snapshot). It is the cheapest, least ambiguous handle for the turn you are in, but the browser renumbers refs on the next snapshot, so it is valid only until then.
- **Durable fields**: they describe the element the way a person would, and keep resolving after a re-render or a deploy.

| Field | Use when |
|---|---|
| `testId` | the app sets `data-testid`: the most stable target there is |
| `role` + `name` | almost always: `{ role: 'button', name: 'Sign in' }`. Add `nameContains: true` to match part of the name |
| `label` | a form field with a `<label>` |
| `placeholder` | an input with placeholder text and no label |
| `text` | a link or element identified by its visible text |
| `selector` | last resort: CSS breaks when the markup changes |
| `nth` | picks one when the chosen strategy matches several elements |
| `frame` | CSS selector of an iframe to look inside |

Every action result carries `resolvedTarget`, the durable description of whatever the action actually hit, and `targetStrategy`, the strategy that found it. **Save `resolvedTarget`, not the `ref` you passed in:**

```ts
const result = await client.browserSessions.action(session.sessionKey, { type: 'click', ref: 'e12' });

console.log(result.resolvedTarget); // { role: 'button', name: 'Sign in' }
```

Supplying a durable target next to a `ref` is the robust form: a stale `ref` is probed briefly and then abandoned in favour of the durable one. The same target fields work on `extract()` and on `screenshot()` (which then captures just that element).

A failed action is still an HTTP `200`: check `result.ok` and read `result.errorMessage`.

### `client.browserSessions.action(sessionKey, action)`

```ts
await client.browserSessions.action(session.sessionKey, {
  type: 'goto',
  url: 'https://www.akbank.com',
  waitUntil: 'networkidle',
});

await client.browserSessions.action(session.sessionKey, {
  type: 'type',
  label: 'Search',
  text: 'credit card',
  submit: true,
});
```

Supported action shapes:

- `goto`
- `click` (`clickCount: 2` double-clicks), `hover`
- `type` (`clear`, `submit` to press Enter afterwards, `delay`), `press`
- `select` (give `values` or `labels`), `check` (`checked: false` unchecks), `upload` (`fileIds` from the Files service, not paths)
- `drag` (`from` and `to`, each a target)
- `back`, `forward`, `reload`
- `wait` (one of `ms`, `selector`, `text` or `loadState`)
- `scroll` (an element target, or `x` / `y`)
- `tab` (`op`: `list`, `new`, `switch` or `close`; `index` for the last two)

Targeted actions accept a per-action `timeout` in milliseconds.

### `client.browserSessions.snapshot(sessionKey)`

Capture the current aria snapshot.

```ts
const snapshot = await client.browserSessions.snapshot(session.sessionKey);
console.log(snapshot.ariaSnapshot);
```

### `client.browserSessions.extract(sessionKey, input)`

Extract text, HTML, attributes or a form field's value from the current page. Name the element with any target field.

```ts
const headings = await client.browserSessions.extract(session.sessionKey, {
  selector: 'h1',
  mode: 'text',
  multiple: true,
});

const total = await client.browserSessions.extract(session.sessionKey, {
  label: 'Total',
  mode: 'value',
});
```

`mode` is `text` (default), `html`, `attr` (needs `attribute`) or `value`. The result also carries `resolvedTarget`.

### `client.browserSessions.find(sessionKey, text, options?)`

Find visible text on the page and get a **durable target** for each hit. Cheaper than another snapshot when you already know what you are looking for, and each target can be spread straight into an action or saved into a flow step.

```ts
const { ok, matches } = await client.browserSessions.find(session.sessionKey, 'Sign in', { limit: 5 });

await client.browserSessions.action(session.sessionKey, { type: 'click', ...matches[0].target });
```

A hit's `target` is `{ text }`, plus `nth` when the text appears more than once. `limit` caps the hits (10 by default). A search that fails is `ok: false` with `errorMessage`, not a rejected promise.

### `client.browserSessions.diagnostics(sessionKey)`

What the page itself reported: console messages, failed requests and the last dialog. Use it when an action succeeded but the page did not do what you expected.

```ts
const { console: messages, networkFailures, lastDialog } =
  await client.browserSessions.diagnostics(session.sessionKey);
```

### `client.browserSessions.exportProfile(sessionKey)`

Export the session's cookies and origin storage as a Playwright `storageState`. This is the "sign in once" half of unattended automation: drive a login by hand, export it here, and attach it with `browsers.setProfile()`.

```ts
const state = await client.browserSessions.exportProfile(session.sessionKey);
await client.browsers.setProfile(browser.id, state, 'signed-in.json');
```

The export holds live session cookies: treat it like a password.

### `client.browserSessions.screenshot(sessionKey, input?)`

Persist a screenshot artifact and get back its file reference. With `inline: true` the image also comes back as a base64 content block, and `persist: false` skips saving it.

### `client.browserSessions.screenshotLive(sessionKey, query?)`

Fetch raw image bytes without persistence.

### `client.browserSessions.pdf(sessionKey, input?)`

Export the page as a persisted PDF artifact.

### `client.browserSessions.list(query?)`

List browser sessions. Supports `status` and `browserId` filters.

### `client.browserSessions.get(sessionId)`

Fetch one session by id.

### `client.browserSessions.listEvents(sessionId, query?)`

Read the stored event trail for a session. Supports `limit` and `skip`.

### `client.browserSessions.close(sessionKey)`

Close a live session.

### `client.browserSessions.delete(sessionId)`

Delete a stored session record.

### Session settings

`config` on `browserSessions.create()` and `defaultSessionConfig` on a browser take the same settings. They are merged in this order, later winning: the browser's signed-in profile, the browser's `defaultSessionConfig`, the session's `config`.

| Setting | Notes |
|---|---|
| `viewport` | `{ width, height }`: 320 to 8192 by 240 to 8192 |
| `userAgent`, `locale` | strings |
| `timezoneId` | IANA zone, e.g. `Europe/Istanbul`. Pages that render dates read it |
| `idleTimeoutMs`, `maxLifetimeMs` | the session closes after this much inactivity / at most this long |
| `actionTimeoutMs`, `navigationTimeoutMs` | default per-action (1 to 120000) and `goto` (1 to 300000) timeouts |
| `access` | `allowList` / `blockList`: host patterns the session may and may not reach |
| `proxy` | `{ server, username?, password?, bypass? }`: route traffic through an egress proxy |
| `extraHTTPHeaders` | sent on every request, e.g. an API key for an internal app |
| `httpCredentials` | `{ username, password }` for HTTP basic auth |
| `acceptDownloads` | off by default: an automated browser that accepts files is an ingest path |
| `ignoreHTTPSErrors` | **disables TLS verification.** Only for a known-broken internal chain |
| `dialogPolicy` | `accept` or `dismiss` for `alert` / `confirm` / `prompt`. An unanswered dialog blocks the page |
| `storageState` | cookies + origin storage for this session only. Prefer `setProfile()` for a reusable sign-in |

A stored session record keeps no `storageState`, `httpCredentials` or `proxy.password`.

## Browser Flows

Driving a browser with a model is **discovery**: it reads the page, guesses, backtracks and bills tokens for every step. Replaying a flow is **execution**: no model, no guessing, the same steps every time. A flow is an ordered list of steps with durable targets, declared inputs and a per-step retry policy. Drive the task once (an agent, or by hand), record it, then run it as often as you like.

Flows need a Console that serves the browser flows API.

```ts
const browser = await client.browsers.get('research-browser');
const session = await client.browserSessions.create({ browserId: browser.id });

// 1. Drive it however you like.
await client.browserSessions.action(session.sessionKey, { type: 'goto', url: 'https://portal.example.com' });
await client.browserSessions.action(session.sessionKey, { type: 'type', label: 'Purchase order', text: 'PO-1' });
await client.browserSessions.action(session.sessionKey, { type: 'click', role: 'button', name: 'Look up' });
await client.browserSessions.close(session.sessionKey);

// 2. Freeze it into a flow. The typed value becomes a declared input.
const flow = await client.browserFlows.record({
  sessionId: session.id,
  name: 'Look up a PO',
  status: 'active',
});
console.log(flow.inputs); // [{ name: 'purchase_order', type: 'string', required: true, ... }]

// 3. Replay it with different values, any number of times.
const run = await client.browserFlows.run(flow.key, { inputs: { purchase_order: 'PO-2' } });
console.log(run.status, run.outputs);
```

### `client.browserFlows.record(input)`

Turn a driven session's action log into a replayable flow. `sessionId` is the session's `id`, not its `sessionKey`.

- Volatile `ref`s are replaced by the durable `resolvedTarget` each action produced.
- **Every typed value becomes a declared input**, not a literal: the recorder cannot tell a search term from a password. The step keeps a <code v-pre>{{input.name}}</code> placeholder, and the input is a required `string` named after the element.
- Failed actions, and `snapshot`, `screenshot` and `pdf` events, are left out (`excludeTypes` adds more). `upload` and `drag` are not recorded: add those steps with `update()`.
- The flow lands as a `draft` unless you pass `status: 'active'`, so a recording is reviewed before anything runs it.

It rejects when the session holds nothing replayable.

### `client.browserFlows.run(idOrKey, input?)`

Run a flow and wait for the result.

```ts
const run = await client.browserFlows.run('look-up-a-po', {
  inputs: { purchase_order: 'PO-2' },
  keepSessionOpen: true, // on failure, leave the page open to look at
});

if (run.status === 'failed') {
  const step = run.stepResults?.[run.failedStepIndex ?? -1];
  console.error(run.errorMessage, step?.attempts, step?.artifact); // artifact: screenshot of the page it gave up on
} else {
  console.log(run.outputs);
}
```

- **A failed run still resolves.** Inspect `run.status`, `run.failedStepIndex` and `run.stepResults`. The run stops at the first non-optional step that fails: a half-finished form is usually worse than an untouched one.
- The call itself rejects when the flow does not exist, is `disabled`, has no steps, or a required input is missing.
- `inputs` are matched by name. An empty string counts as not supplied, so the input's default applies. A `secret` input is used for the run and never stored on the run record.
- `maxSteps` stops after that many steps, for dry-running a long flow.
- The call waits for the run to finish, so it is bounded by the client's `timeout` (60 seconds by default). Raise it for a long flow.

### A flow's definition

| Field | Meaning |
|---|---|
| `inputs` | declared parameters: `name`, `type` (`string`, `number`, `boolean` or `secret`), `required`, `default`. A `secret` cannot carry a default |
| `steps` | the ordered step list, below |
| `outputs` | the JSON a run returns, below |
| `sessionConfig` | session settings for the flow's own sessions. It never carries `storageState`: sign-in comes from the browser's profile |
| `status` | `draft`, `active` or `disabled`. A disabled flow cannot run |
| `version` | bumped when `steps` or `outputs` change. A run records the version it executed |

Each step:

| Field | Meaning |
|---|---|
| `action` | a `BrowserAction` payload, or `{ type: 'extract', ... }` to read the page. It may use <code v-pre>{{input.name}}</code> and <code v-pre>{{step.name}}</code> placeholders. It must not carry a `ref`: the API rejects the step |
| `captureAs` | store the result under a name: the extracted value for `extract` (a string for one match, an array otherwise), the page URL after any other action |
| `policy` | `retries` (attempts beyond the first), `retryDelayMs` (doubling), `timeoutMs`, `optional` (a failing step is recorded and skipped instead of aborting) |
| `when` | skip the step unless this renders truthy, e.g. <code v-pre>{{input.coupon}}</code>. Empty, `false`, `0` and `undefined` skip it |
| `id`, `label` | generated when omitted |

An unresolved placeholder is left as written, so a typo shows up as the literal text on the page instead of an empty field.

**Outputs.** Left alone, a run returns whatever `captureAs` collected, which changes the moment someone renames a capture. Declare `outputs` to make the return value a contract:

```ts
await client.browserFlows.update('look-up-a-po', {
  steps: [
    ...flow.steps,
    { action: { type: 'extract', selector: '#result' }, captureAs: 'result' },
  ],
  outputs: [
    { name: 'result', source: '{{step.result}}', type: 'string', required: true },
  ],
});
```

| Output field | Effect |
|---|---|
| `name` | the key in the returned JSON |
| `source` | a template over <code v-pre>{{step.x}}</code> and <code v-pre>{{input.y}}</code>. A lone placeholder passes the captured value through untouched, so an `extract` of several matches stays an array |
| `type` | `string`, `number`, `boolean` or `json`. Left off, the value is returned as captured. A cast that fails leaves the field out instead of returning `NaN` |
| `required` | a run that cannot resolve the field **fails**, even when every step passed |

`run.outputs` is the declared shape (or the raw captures when none is declared), and `run.captures` always holds the raw `captureAs` values, so a field that resolved to nothing can be debugged against what the steps actually collected.

### `client.browserFlows.create(input)`

Create a flow from steps you write yourself. `browserId` is the browser's id or key.

```ts
await client.browserFlows.create({
  name: 'Open the dashboard',
  browserId: browser.id,
  status: 'active',
  steps: [
    { action: { type: 'goto', url: 'https://portal.example.com/dashboard' } },
    { action: { type: 'wait', text: 'Welcome' }, policy: { retries: 2, timeoutMs: 10000 } },
  ],
});
```

### `client.browserFlows.list(query?)`

List flows, most recently updated first. Filter by `status`, `browserId` (the browser's id) and `search` (a case-insensitive filter on the name; some database backends also match the key and description).

### `client.browserFlows.get(idOrKey)`

Fetch one flow by id or key.

### `client.browserFlows.update(idOrKey, input)`

Update a flow. Pass only the fields to change; `steps`, `inputs` and `outputs` replace the stored list wholesale. `key` and `recordedFromSessionId` cannot be changed and are not part of the update type.

### `client.browserFlows.delete(idOrKey)`

Delete a flow and its run history.

### `client.browserFlows.listRuns(query?)`

Run history, newest first (100 runs unless you pass `limit`). Filter by `flowId` (the flow's id, not its key) and `status`; page with `limit` and `skip`.

```ts
const failed = await client.browserFlows.listRuns({ flowId: flow.id, status: 'failed', limit: 10 });
```

### `client.browserFlows.getRun(runId)`

Fetch one run with its per-step results, `captures` and `outputs`.

## Browser MCP

A browser is published to MCP clients from the Console's MCP module: **MCP Servers → New MCP server → Internal service →
Browser**. The server gets what every MCP server has (endpoints, tool toggles, guardrails, logs, hubs) except a public
URL: a browser server is always called with an API token. Talk to it with `client.mcp.server(serverKey)`:

```ts
const browserMcp = client.mcp.server('research-browser-mcp');

const { sessionKey } = JSON.parse(
  (await browserMcp.callTool('browser_open_session', {})).content[0].text,
);
await browserMcp.callTool('browser_navigate', { sessionKey, url: 'https://example.com' });
```

`browser_open_session` returns a `sessionKey`; every page tool takes it. A session is driven only through the MCP server
that opened it. The per-browser endpoint (`/browser/:browserKey/mcp/*`) and `client.browserMcp` were removed in 4.0.0.

## Migration Note

If you previously depended on the removed browser agent management API:

1. Use `client.browserSessions` for direct programmatic browser automation, and `client.browserFlows` for a task that should repeat.
2. Publish the browser as a Browser MCP server (Console MCP module) when another MCP-compatible runtime should drive it.
3. Use Console-managed agents plus the `Browser Use` system tool when you want a hosted agent to browse autonomously.
