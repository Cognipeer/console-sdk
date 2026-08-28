import { describe, it, expect } from 'vitest';
import { PromptsResource } from './prompts';
import { createMockHttp } from '../test/mockHttp';
import type {
  DeployPromptOptions,
  Prompt,
  PromptCreateRequest,
  PromptUpdateRequest,
  SetPromptVersionRequest,
} from '../types';

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'prompt_1',
    key: 'greeting',
    name: 'Greeting',
    template: 'Hello, {{name}}!',
    ...overrides,
  };
}

describe('PromptsResource', () => {
  it('lists prompts with query filters via GET /api/client/v1/prompts', async () => {
    const http = createMockHttp();
    const response = { prompts: [makePrompt()] };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const query = { search: 'greeting' };
    const result = await resource.list(query);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts', { query });
  });

  it('passes an undefined query through to list when omitted', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ prompts: [] });
    const resource = new PromptsResource(http);

    await resource.list();

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts', { query: undefined });
  });

  it('creates a prompt via POST /api/client/v1/prompts', async () => {
    const http = createMockHttp();
    const response = { prompt: makePrompt() };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const params: PromptCreateRequest = { name: 'Greeting', template: 'Hello, {{name}}!' };
    const result = await resource.create(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/prompts', { body: params });
  });

  it('updates a prompt via PATCH /api/client/v1/prompts/{key}', async () => {
    const http = createMockHttp();
    const response = { prompt: makePrompt({ template: 'Hi, {{name}}!' }) };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const params: PromptUpdateRequest = { template: 'Hi, {{name}}!' };
    const result = await resource.update('greeting', params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/client/v1/prompts/greeting', {
      body: params,
    });
  });

  it('re-points the latest version via POST /api/client/v1/prompts/{key}/versions', async () => {
    const http = createMockHttp();
    const response = { prompt: makePrompt() };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const params: SetPromptVersionRequest = { versionId: 'version_1' };
    const result = await resource.setLatestVersion('greeting', params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/prompts/greeting/versions', {
      body: params,
    });
  });

  it('deletes a prompt via DELETE /api/client/v1/prompts/{key}', async () => {
    const http = createMockHttp();
    const response = { success: true };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const result = await resource.delete('greeting');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/client/v1/prompts/greeting');
  });

  it('gets a prompt with version/environment query params via GET /api/client/v1/prompts/{key}', async () => {
    const http = createMockHttp();
    const response = { prompt: makePrompt() };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const result = await resource.get('greeting', { version: 2, environment: 'prod' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts/greeting', {
      query: { version: 2, environment: 'prod' },
    });
  });

  it('gets a prompt with an empty query object when no options are given', async () => {
    const http = createMockHttp();
    const response = { prompt: makePrompt() };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    await resource.get('greeting');

    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts/greeting', {
      query: {},
    });
  });

  it('renders a prompt with version/environment/data via POST /api/client/v1/prompts/{key}/render', async () => {
    const http = createMockHttp();
    const response = {
      prompt: { key: 'greeting', name: 'Greeting' },
      rendered: 'Hello, Ada!',
    };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const result = await resource.render('greeting', {
      version: 2,
      environment: 'prod',
      data: { name: 'Ada' },
    });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/prompts/greeting/render', {
      query: { version: 2, environment: 'prod' },
      body: { data: { name: 'Ada' } },
    });
  });

  it('renders a prompt with an empty query and undefined data when no options are given', async () => {
    const http = createMockHttp();
    const response = { prompt: { key: 'greeting', name: 'Greeting' }, rendered: 'Hello, !' };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    await resource.render('greeting');

    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/prompts/greeting/render', {
      query: {},
      body: { data: undefined },
    });
  });

  it('lists prompt versions via GET /api/client/v1/prompts/{key}/versions', async () => {
    const http = createMockHttp();
    const response = { prompt: { key: 'greeting', name: 'Greeting' }, versions: [] };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const result = await resource.listVersions('greeting');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts/greeting/versions');
  });

  it('gets deployment state via GET /api/client/v1/prompts/{key}/deployments', async () => {
    const http = createMockHttp();
    const response = {
      prompt: { id: 'prompt_1', key: 'greeting', name: 'Greeting' },
      deployments: null,
    };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const result = await resource.getDeployments('greeting');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts/greeting/deployments');
  });

  it('mutates the deployment flow via POST /api/client/v1/prompts/{key}/deployments', async () => {
    const http = createMockHttp();
    const response = {
      prompt: { id: 'prompt_1', key: 'greeting', name: 'Greeting' },
      deployments: null,
    };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const options: DeployPromptOptions = { action: 'promote', environment: 'staging' };
    const result = await resource.deploy('greeting', options);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/prompts/greeting/deployments', {
      body: options,
    });
  });

  it('compares two prompt versions via GET /api/client/v1/prompts/{key}/compare', async () => {
    const http = createMockHttp();
    const response = {
      prompt: { id: 'prompt_1', key: 'greeting', name: 'Greeting' },
      comparison: {
        fromVersion: { id: 'v1', promptId: 'prompt_1', version: 1, name: 'v1', isLatest: false, createdBy: 'user_1' },
        toVersion: { id: 'v2', promptId: 'prompt_1', version: 2, name: 'v2', isLatest: true, createdBy: 'user_1' },
        templateDiff: [],
        metadataDiff: [],
        deploymentHistory: [],
        comments: [],
      },
    };
    http.request.mockResolvedValue(response);
    const resource = new PromptsResource(http);

    const result = await resource.compare('greeting', 'v1', 'v2');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/prompts/greeting/compare', {
      query: { fromVersionId: 'v1', toVersionId: 'v2' },
    });
  });
});
