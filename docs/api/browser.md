# Browser API

Use the browser surface when you need one of these two paths:

- direct browser automation from your application code,
- a per-browser MCP endpoint that exposes the Browser Use toolset.

The old standalone `client.browserAgents` API has been removed. If you want a Console-managed agent to browse the web, attach the `Browser Use` system tool in Console and invoke that agent through `client.agents`.

## Browser Profiles

Browser profiles are reusable parent containers. They hold the default session config, artifact bucket, and metadata used by browser sessions and browser-scoped MCP endpoints.

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

## Browser Sessions

Browser sessions are the direct automation surface. You create a session under a browser profile, drive it with discrete actions, and optionally persist screenshots or PDFs.

### `client.browserSessions.create(input)`

```ts
const session = await client.browserSessions.create({
  browserId: browser.id,
  name: 'akbank-research',
});
```

### `client.browserSessions.action(sessionKey, action)`

```ts
await client.browserSessions.action(session.sessionKey, {
  type: 'goto',
  url: 'https://www.akbank.com',
  waitUntil: 'networkidle',
});
```

Supported action shapes include:

- `goto`
- `click`
- `hover`
- `type`
- `press`
- `wait`
- `scroll`

### `client.browserSessions.snapshot(sessionKey)`

Capture the current aria snapshot.

```ts
const snapshot = await client.browserSessions.snapshot(session.sessionKey);
console.log(snapshot.ariaSnapshot);
```

### `client.browserSessions.extract(sessionKey, input)`

Extract text, HTML, or attributes from the current page.

```ts
const headings = await client.browserSessions.extract(session.sessionKey, {
  selector: 'h1',
  mode: 'text',
  multiple: true,
});
```

### `client.browserSessions.screenshot(sessionKey, input?)`

Persist a screenshot artifact and get back its file reference.

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

## Browser MCP

Every browser profile now exposes its own MCP endpoint. This is the external transport equivalent of the `Browser Use` system tool.

### `client.browserMcp.getConnectionInfo(browserKey)`

Build the browser-scoped MCP URLs.

```ts
const info = client.browserMcp.getConnectionInfo(browser.key);

console.log(info.sseUrl);
console.log(info.messageUrlTemplate);
// Authorization: Bearer <API_TOKEN>
```

### `client.browserMcp.getSseUrl(browserKey)`

Get the SSE URL for an MCP client.

### `client.browserMcp.getMessageUrl(browserKey, sessionId)`

Build the JSON-RPC message URL once your MCP client has a `sessionId`.

### `client.browserMcp.initialize(browserKey)`

Read the MCP server metadata.

```ts
const meta = await client.browserMcp.initialize(browser.key);
console.log(meta.protocolVersion, meta.serverInfo.name);
```

### `client.browserMcp.listTools(browserKey)`

List the Browser Use-compatible MCP tools exposed by the browser.

```ts
const tools = await client.browserMcp.listTools(browser.key);
console.log(tools.map((tool) => tool.name));
```

## Migration Note

If you previously depended on the removed browser agent management API:

1. Use `client.browserSessions` for direct programmatic browser automation.
2. Use `client.browserMcp` when another MCP-compatible runtime should drive the browser.
3. Use Console-managed agents plus the `Browser Use` system tool when you want a hosted agent to browse autonomously.