import { describe, it, expect, vi } from 'vitest';
import { ModerationsResource } from './moderations';
import { createMockHttp } from '../test/mockHttp';
import { CreateModerationRequest, ModerationResponse } from '../types';

describe('ModerationsResource', () => {
  it('creates a moderation via POST /api/client/v1/moderations', async () => {
    const http = createMockHttp();
    const response: ModerationResponse = {
      id: 'modr_1',
      model: 'default-guardrail',
      results: [
        {
          flagged: true,
          categories: { violence: true, hate: false },
          category_scores: { violence: 0.92, hate: 0.01 },
          findings: [
            {
              type: 'moderation',
              category: 'violence',
              severity: 'high',
              message: 'Violent content detected',
              action: 'block',
              block: true,
            },
          ],
        },
      ],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new ModerationsResource(http);
    const params: CreateModerationRequest = { input: 'I want to hurt someone.' };

    const result = await resource.create(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/moderations', {
      body: params,
    });
  });

  it('passes an explicit guardrail model key and array input through to the request body', async () => {
    const http = createMockHttp();
    const response: ModerationResponse = {
      id: 'modr_2',
      model: 'custom-guardrail',
      results: [
        {
          flagged: false,
          categories: {},
          category_scores: {},
          findings: [],
        },
      ],
    };
    vi.mocked(http.request).mockResolvedValue(response);
    const resource = new ModerationsResource(http);
    const params: CreateModerationRequest = {
      input: ['hello', { type: 'text', text: 'world' }],
      model: 'custom-guardrail',
    };

    const result = await resource.create(params);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', '/api/client/v1/moderations', {
      body: params,
    });
  });
});
