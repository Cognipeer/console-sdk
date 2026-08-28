import { describe, it, expect } from 'vitest';
import { ConfigResource } from './config';
import { createMockHttp } from '../test/mockHttp';

describe('ConfigResource', () => {
  describe('groups', () => {
    it('lists groups without filters', async () => {
      const http = createMockHttp();
      const groups = [{ key: 'g1', name: 'Group 1' }];
      http.request.mockResolvedValue({ groups });
      const resource = new ConfigResource(http);

      const result = await resource.listGroups();

      expect(result).toBe(groups);
      expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/config/groups');
    });

    it('lists groups with tags and search filters as a query string', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ groups: [] });
      const resource = new ConfigResource(http);

      await resource.listGroups({ tags: ['a', 'b'], search: 'openai' });

      expect(http.request).toHaveBeenCalledWith(
        'GET',
        '/api/client/v1/config/groups?tags=a%2Cb&search=openai',
      );
    });

    it('creates a group', async () => {
      const http = createMockHttp();
      const group = { key: 'g1', name: 'Group 1' };
      http.request.mockResolvedValue({ group });
      const resource = new ConfigResource(http);

      const result = await resource.createGroup({ name: 'Group 1' });

      expect(result).toBe(group);
      expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/config/groups', {
        body: { name: 'Group 1' },
      });
    });

    it('gets a group with its items', async () => {
      const http = createMockHttp();
      const group = { key: 'g1', items: [] };
      http.request.mockResolvedValue({ group });
      const resource = new ConfigResource(http);

      const result = await resource.getGroup('g1');

      expect(result).toBe(group);
      expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/config/groups/g1');
    });

    it('updates a group', async () => {
      const http = createMockHttp();
      const group = { key: 'g1', name: 'Renamed' };
      http.request.mockResolvedValue({ group });
      const resource = new ConfigResource(http);

      const result = await resource.updateGroup('g1', { name: 'Renamed' });

      expect(result).toBe(group);
      expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/config/groups/g1', {
        body: { name: 'Renamed' },
      });
    });

    it('deletes a group', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue(undefined);
      const resource = new ConfigResource(http);

      await resource.deleteGroup('g1');

      expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/config/groups/g1');
    });
  });

  describe('items', () => {
    it('lists items in a group without filters', async () => {
      const http = createMockHttp();
      const items = [{ key: 'i1' }];
      http.request.mockResolvedValue({ items });
      const resource = new ConfigResource(http);

      const result = await resource.listItems('g1');

      expect(result).toBe(items);
      expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/config/groups/g1/items');
    });

    it('lists items with isSecret/tags/search filters as a query string', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ items: [] });
      const resource = new ConfigResource(http);

      await resource.listItems('g1', { isSecret: true, tags: ['x'], search: 'key' });

      expect(http.request).toHaveBeenCalledWith(
        'GET',
        '/api/client/v1/config/groups/g1/items?isSecret=true&tags=x&search=key',
      );
    });

    it('creates an item in a group', async () => {
      const http = createMockHttp();
      const item = { key: 'i1', name: 'API Key' };
      http.request.mockResolvedValue({ item });
      const resource = new ConfigResource(http);

      const result = await resource.createItem('g1', { name: 'API Key', value: 'sk-...' });

      expect(result).toBe(item);
      expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/config/groups/g1/items', {
        body: { name: 'API Key', value: 'sk-...' },
      });
    });

    it('gets an item by key', async () => {
      const http = createMockHttp();
      const item = { key: 'i1' };
      http.request.mockResolvedValue({ item });
      const resource = new ConfigResource(http);

      const result = await resource.getItem('i1');

      expect(result).toBe(item);
      expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/config/items/i1');
    });

    it('updates an item', async () => {
      const http = createMockHttp();
      const item = { key: 'i1', value: 'new-value' };
      http.request.mockResolvedValue({ item });
      const resource = new ConfigResource(http);

      const result = await resource.updateItem('i1', { value: 'new-value' });

      expect(result).toBe(item);
      expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/config/items/i1', {
        body: { value: 'new-value' },
      });
    });

    it('deletes an item', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue(undefined);
      const resource = new ConfigResource(http);

      await resource.deleteItem('i1');

      expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/config/items/i1');
    });
  });

  describe('resolve & audit', () => {
    it('resolves config values', async () => {
      const http = createMockHttp();
      const configs = { 'cfg-api-key': 'decrypted-value' };
      http.request.mockResolvedValue({ configs });
      const resource = new ConfigResource(http);

      const result = await resource.resolve({ keys: ['cfg-api-key'] });

      expect(result).toBe(configs);
      expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/config/resolve', {
        body: { keys: ['cfg-api-key'] },
      });
    });

    it('fetches audit logs without pagination options', async () => {
      const http = createMockHttp();
      const logs = [{ id: 'log1' }];
      http.request.mockResolvedValue({ logs });
      const resource = new ConfigResource(http);

      const result = await resource.auditLogs('i1');

      expect(result).toBe(logs);
      expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/config/items/i1/audit');
    });

    it('fetches audit logs with pagination options as a query string', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ logs: [] });
      const resource = new ConfigResource(http);

      await resource.auditLogs('i1', { limit: 10, skip: 5 });

      expect(http.request).toHaveBeenCalledWith(
        'GET',
        '/api/client/v1/config/items/i1/audit?limit=10&skip=5',
      );
    });
  });
});
