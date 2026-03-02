# Config API

The Config API provides a secure configuration store organized in groups with AES-256-GCM encryption at rest. Create groups first, then add config items (secrets, API keys, settings) under them.

## Quick Start

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: 'your-api-key',
  baseURL: 'https://your-gateway.example.com',
});

// Create a group
const group = await client.config.createGroup({
  name: 'OpenAI Credentials',
  tags: ['api', 'openai'],
});

console.log(group.key); // cfg-grp-openai-credentials

// Add a secret item to the group
const item = await client.config.createItem(group.key, {
  name: 'API Key',
  value: 'sk-...',
  isSecret: true,
  tags: ['api'],
});

console.log(item.key); // cfg-api-key

// Resolve (decrypt) secrets
const resolved = await client.config.resolve({
  keys: ['cfg-api-key'],
});

console.log(resolved['cfg-api-key'].value); // sk-...
```

## Group Methods

### `client.config.listGroups(query?)`

List config groups with optional filters.

```typescript
// All groups
const groups = await client.config.listGroups();

// Filter by tags
const apiGroups = await client.config.listGroups({
  tags: ['api'],
});

// Search by name/key/description
const results = await client.config.listGroups({
  search: 'openai',
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tags` | `string[]` | Filter by tags |
| `search` | `string` | Search name, key, description |

**Returns:** `ConfigGroup[]`

### `client.config.createGroup(data)`

Create a new config group.

```typescript
const group = await client.config.createGroup({
  name: 'Database Settings',
  description: 'Connection strings and DB credentials',
  tags: ['database'],
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Display name |
| `key` | `string` | No | Unique key (auto-generated from name) |
| `description` | `string` | No | Description |
| `tags` | `string[]` | No | Tags |
| `metadata` | `object` | No | Custom metadata |

**Returns:** `ConfigGroup`

### `client.config.getGroup(groupKey)`

Get a config group with all its items. Secret values are masked.

```typescript
const group = await client.config.getGroup('cfg-grp-openai-credentials');

console.log(group.name);          // "OpenAI Credentials"
console.log(group.items.length);  // 3
```

**Returns:** `ConfigGroupWithItems`

### `client.config.updateGroup(groupKey, data)`

Update a config group.

```typescript
const updated = await client.config.updateGroup('cfg-grp-openai-credentials', {
  name: 'OpenAI Production Credentials',
  tags: ['api', 'openai', 'production'],
});
```

**Returns:** `ConfigGroup`

### `client.config.deleteGroup(groupKey)`

Delete a config group and all its items.

```typescript
await client.config.deleteGroup('cfg-grp-openai-credentials');
```

## Item Methods

### `client.config.listItems(groupKey, query?)`

List config items within a group.

```typescript
// All items in a group
const items = await client.config.listItems('cfg-grp-openai-credentials');

// Filter secrets only
const secrets = await client.config.listItems('cfg-grp-openai-credentials', {
  isSecret: true,
});

// Search within group
const results = await client.config.listItems('cfg-grp-openai-credentials', {
  search: 'key',
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `isSecret` | `boolean` | Filter secret/non-secret |
| `tags` | `string[]` | Filter by tags |
| `search` | `string` | Search name, key, description |

**Returns:** `ConfigItem[]`

### `client.config.createItem(groupKey, data)`

Create a new config item within a group.

```typescript
const item = await client.config.createItem('cfg-grp-database-settings', {
  name: 'Connection String',
  value: 'mongodb://localhost:27017/mydb',
  valueType: 'string',
  isSecret: true,
  tags: ['database', 'mongodb'],
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Display name |
| `key` | `string` | No | Unique key (auto-generated) |
| `value` | `string` | Yes | Config value |
| `valueType` | `ConfigValueType` | No | `string`, `number`, `boolean`, `json` |
| `isSecret` | `boolean` | No | Encrypt at rest |
| `tags` | `string[]` | No | Tags |
| `metadata` | `object` | No | Custom metadata |

**Returns:** `ConfigItem`

### `client.config.getItem(key)`

Get a config item by key. Secret values are masked.

```typescript
const item = await client.config.getItem('cfg-openai-api-key');
console.log(item.name);    // "API Key"
console.log(item.value);   // "••••••••" (if secret)
console.log(item.version); // 3
```

**Returns:** `ConfigItem`

### `client.config.updateItem(key, data)`

Update a config item.

```typescript
const updated = await client.config.updateItem('cfg-openai-api-key', {
  value: 'sk-new-key-...',
  tags: ['api', 'openai', 'v2'],
});
```

**Returns:** `ConfigItem`

### `client.config.deleteItem(key)`

Delete a config item.

```typescript
await client.config.deleteItem('cfg-openai-api-key');
```

### `client.config.resolve(data)`

Resolve (decrypt) config values. This is the only way to retrieve actual secret values.

```typescript
const resolved = await client.config.resolve({
  keys: ['cfg-openai-api-key', 'cfg-db-url'],
});

for (const [key, entry] of Object.entries(resolved)) {
  console.log(`${key}: ${entry.value} (v${entry.version})`);
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `keys` | `string[]` | Yes | Config keys to resolve (max 50) |

**Returns:** `ResolvedConfigMap`

### `client.config.auditLogs(key, options?)`

Retrieve the audit trail for a config item.

```typescript
const logs = await client.config.auditLogs('cfg-openai-api-key', {
  limit: 20,
});

for (const log of logs) {
  console.log(`${log.action} by ${log.performedBy} at ${log.createdAt}`);
}
```

**Returns:** `ConfigAuditLog[]`

## Types

```typescript
type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';

interface ConfigGroup {
  _id: string;
  key: string;
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConfigGroupWithItems extends ConfigGroup {
  items: ConfigItem[];
}

interface ConfigItem {
  _id: string;
  groupId: string;
  key: string;
  name: string;
  description?: string;
  value: string;          // masked for secrets
  valueType: ConfigValueType;
  isSecret: boolean;
  tags?: string[];
  version: number;
  metadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConfigAuditLog {
  _id: string;
  configKey: string;
  action: string;         // 'create' | 'update' | 'delete' | 'read'
  version?: number;
  performedBy: string;
  createdAt: string;
}

interface ResolvedConfigMap {
  [key: string]: {
    value: string;
    valueType: ConfigValueType;
    version: number;
  };
}
```

## Security Notes

- Secret values are encrypted with **AES-256-GCM** before storage
- The `listItems`, `getItem`, and `getGroup` methods return masked values (`••••••••`) for secrets
- Use `resolve` to decrypt secret values — each resolve call is audited
- All mutations (create, update, delete) generate audit log entries
- Config items are scoped to your tenant and project
- Deleting a group cascades to all items within it
