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

A browser is published to MCP clients from the Console's MCP module: **MCP Servers → New server → Internal service →
Browser**. The server gets what every MCP server has (endpoints, access modes, tool toggles, guardrails, logs, hubs).
Talk to it with `client.mcp.server(serverKey)`:

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

1. Use `client.browserSessions` for direct programmatic browser automation.
2. Publish the browser as a Browser MCP server (Console MCP module) when another MCP-compatible runtime should drive it.
3. Use Console-managed agents plus the `Browser Use` system tool when you want a hosted agent to browse autonomously.