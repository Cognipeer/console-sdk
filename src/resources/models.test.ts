import { describe, it, expect } from 'vitest';
import { ModelsResource } from './models';
import { createMockHttp } from '../test/mockHttp';
import { isAgentModelEntry } from '../types';
import type { ModelList } from '../types';

describe('ModelsResource', () => {
  const list: ModelList = {
    object: 'list',
    data: [
      { id: 'gpt-4o', object: 'model', created: 1, owned_by: 'cognipeer', name: 'GPT-4o', supports_reasoning: true },
      {
        id: 'agent:support-bot',
        object: 'model',
        created: 2,
        owned_by: 'cognipeer-agent',
        name: 'Support Bot',
        description: 'Answers tickets',
        cognipeer: { kind: 'agent', key: 'support-bot' },
      },
    ],
    models: [{ key: 'gpt-4o', category: 'llm' }],
  };

  it('lists models and agents via GET /api/client/v1/models', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(list);

    const result = await new ModelsResource(http).list();

    expect(result).toBe(list);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/models', {
      query: { category: undefined, providerKey: undefined, providerDriver: undefined, includeProviders: undefined },
      signal: undefined,
    });
  });

  it('sends the registry filters as query parameters', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue(list);

    await new ModelsResource(http).list({ category: 'llm', providerKey: 'azure', includeProviders: true });

    expect(http.request.mock.calls[0][2].query).toEqual({
      category: 'llm',
      providerKey: 'azure',
      providerDriver: undefined,
      includeProviders: 'true',
    });
  });

  it('tells agent entries from model entries', () => {
    const agents = list.data.filter(isAgentModelEntry);
    expect(agents.map((a) => a.cognipeer.key)).toEqual(['support-bot']);
    expect(agents[0].owned_by).toBe('cognipeer-agent');
  });
});
