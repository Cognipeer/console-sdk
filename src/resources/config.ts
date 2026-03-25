import { HttpClient } from '../http';
import {
  ConfigGroup,
  ConfigGroupWithItems,
  ConfigItem,
  ConfigAuditLog,
  CreateConfigGroupRequest,
  UpdateConfigGroupRequest,
  CreateConfigItemRequest,
  UpdateConfigItemRequest,
  ResolveConfigRequest,
  ResolvedConfigMap,
  ListConfigGroupsQuery,
  ListConfigItemsQuery,
} from '../types';

/**
 * Config API resource
 *
 * Manage secrets, API keys, and configuration values organized in groups.
 *
 * @example
 * ```typescript
 * // Create a group
 * const group = await client.config.createGroup({
 *   name: 'OpenAI Credentials',
 * });
 *
 * // Add items to the group
 * const item = await client.config.createItem(group.key, {
 *   name: 'API Key',
 *   value: 'sk-...',
 *   isSecret: true,
 *   tags: ['api', 'openai'],
 * });
 *
 * // Get group with items
 * const groupWithItems = await client.config.getGroup(group.key);
 *
 * // Resolve secrets (returns decrypted values)
 * const resolved = await client.config.resolve({
 *   keys: ['cfg-api-key'],
 * });
 *
 * // Get audit trail
 * const logs = await client.config.auditLogs('cfg-api-key');
 * ```
 */
export class ConfigResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  // ── Group operations ─────────────────────────────────────────────────

  /**
   * List config groups
   * @param query - Optional filters (tags, search)
   */
  async listGroups(query?: ListConfigGroupsQuery): Promise<ConfigGroup[]> {
    const params = new URLSearchParams();
    if (query?.tags?.length) params.set('tags', query.tags.join(','));
    if (query?.search) params.set('search', query.search);

    const qs = params.toString();
    const path = `/api/client/v1/config/groups${qs ? `?${qs}` : ''}`;
    const res = await this.http.request<{ groups: ConfigGroup[] }>('GET', path);
    return res.groups;
  }

  /**
   * Create a new config group
   * @param data - Group data (name, key, description, tags)
   */
  async createGroup(data: CreateConfigGroupRequest): Promise<ConfigGroup> {
    const res = await this.http.request<{ group: ConfigGroup }>(
      'POST',
      '/api/client/v1/config/groups',
      { body: data },
    );
    return res.group;
  }

  /**
   * Get a config group with its items
   * @param groupKey - Config group key
   */
  async getGroup(groupKey: string): Promise<ConfigGroupWithItems> {
    const res = await this.http.request<{ group: ConfigGroupWithItems }>(
      'GET',
      `/api/client/v1/config/groups/${groupKey}`,
    );
    return res.group;
  }

  /**
   * Update a config group
   * @param groupKey - Config group key
   * @param data - Fields to update
   */
  async updateGroup(groupKey: string, data: UpdateConfigGroupRequest): Promise<ConfigGroup> {
    const res = await this.http.request<{ group: ConfigGroup }>(
      'PATCH',
      `/api/client/v1/config/groups/${groupKey}`,
      { body: data },
    );
    return res.group;
  }

  /**
   * Delete a config group and all its items
   * @param groupKey - Config group key
   */
  async deleteGroup(groupKey: string): Promise<void> {
    await this.http.request('DELETE', `/api/client/v1/config/groups/${groupKey}`);
  }

  // ── Item operations ──────────────────────────────────────────────────

  /**
   * List items in a group
   * @param groupKey - Config group key
   * @param query - Optional filters
   */
  async listItems(groupKey: string, query?: Omit<ListConfigItemsQuery, 'groupId'>): Promise<ConfigItem[]> {
    const params = new URLSearchParams();
    if (query?.isSecret !== undefined) params.set('isSecret', String(query.isSecret));
    if (query?.tags?.length) params.set('tags', query.tags.join(','));
    if (query?.search) params.set('search', query.search);

    const qs = params.toString();
    const path = `/api/client/v1/config/groups/${groupKey}/items${qs ? `?${qs}` : ''}`;
    const res = await this.http.request<{ items: ConfigItem[] }>('GET', path);
    return res.items;
  }

  /**
   * Create a new config item in a group
   * @param groupKey - Config group key
   * @param data - Config item data
   */
  async createItem(groupKey: string, data: CreateConfigItemRequest): Promise<ConfigItem> {
    const res = await this.http.request<{ item: ConfigItem }>(
      'POST',
      `/api/client/v1/config/groups/${groupKey}/items`,
      { body: data },
    );
    return res.item;
  }

  /**
   * Get a config item by key
   * @param key - Config item key
   */
  async getItem(key: string): Promise<ConfigItem> {
    const res = await this.http.request<{ item: ConfigItem }>(
      'GET',
      `/api/client/v1/config/items/${key}`,
    );
    return res.item;
  }

  /**
   * Update a config item
   * @param key - Config item key
   * @param data - Fields to update
   */
  async updateItem(key: string, data: UpdateConfigItemRequest): Promise<ConfigItem> {
    const res = await this.http.request<{ item: ConfigItem }>(
      'PATCH',
      `/api/client/v1/config/items/${key}`,
      { body: data },
    );
    return res.item;
  }

  /**
   * Delete a config item
   * @param key - Config item key
   */
  async deleteItem(key: string): Promise<void> {
    await this.http.request('DELETE', `/api/client/v1/config/items/${key}`);
  }

  // ── Resolve & Audit ──────────────────────────────────────────────────

  /**
   * Resolve config values (decrypts secrets)
   * @param data - Keys to resolve
   */
  async resolve(data: ResolveConfigRequest): Promise<ResolvedConfigMap> {
    const res = await this.http.request<{ configs: ResolvedConfigMap }>(
      'POST',
      '/api/client/v1/config/resolve',
      { body: data },
    );
    return res.configs;
  }

  /**
   * Get audit logs for a config item
   * @param key - Config item key
   * @param options - Optional pagination
   */
  async auditLogs(key: string, options?: { limit?: number; skip?: number }): Promise<ConfigAuditLog[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.skip) params.set('skip', String(options.skip));

    const qs = params.toString();
    const path = `/api/client/v1/config/items/${key}/audit${qs ? `?${qs}` : ''}`;
    const res = await this.http.request<{ logs: ConfigAuditLog[] }>('GET', path);
    return res.logs;
  }
}
