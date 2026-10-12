import { describe, it, expect } from 'vitest';
import {
  AgentActionErrorCodes,
  AgentRunErrorCodes,
  CognipeerError,
  CognipeerAPIError,
  isAgentActionErrorCode,
  isAgentRunErrorCode,
  isAgentRunSettled,
  isAgentRunTerminal,
  isSessionEvent,
  WEBHOOK_EVENT_TYPES,
} from './types';
import type { SessionFile, SessionStreamEvent, WebhookEndpoint } from './types';

describe('CognipeerError', () => {
  it('sets the message and defaults name to CognipeerError', () => {
    const error = new CognipeerError('something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('something went wrong');
    expect(error.name).toBe('CognipeerError');
    expect(error.statusCode).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  it('carries an optional status code and response payload', () => {
    const response = { detail: 'nope' };
    const error = new CognipeerError('bad request', 400, response);

    expect(error.statusCode).toBe(400);
    expect(error.response).toBe(response);
  });
});

describe('CognipeerAPIError', () => {
  it('extends CognipeerError and sets name to CognipeerAPIError', () => {
    const error = new CognipeerAPIError('not found', 404);

    expect(error).toBeInstanceOf(CognipeerError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CognipeerAPIError');
    expect(error.message).toBe('not found');
    expect(error.statusCode).toBe(404);
  });

  it('carries an optional error type and response payload', () => {
    const response = { error: { message: 'nope', type: 'invalid_request_error' } };
    const error = new CognipeerAPIError('nope', 400, 'invalid_request_error', response);

    expect(error.errorType).toBe('invalid_request_error');
    expect(error.response).toBe(response);
    expect(error.statusCode).toBe(400);
  });

  it('leaves errorType undefined when not provided', () => {
    const error = new CognipeerAPIError('server error', 500);

    expect(error.errorType).toBeUndefined();
  });
});

describe('agent run error helpers', () => {
  it('isAgentRunErrorCode matches on CognipeerAPIError.errorCode', () => {
    const conflict = new CognipeerAPIError('busy', 409, 'agent_run_conflict', undefined, undefined, 'agent_run_conflict');
    expect(isAgentRunErrorCode(conflict, AgentRunErrorCodes.Conflict)).toBe(true);
    expect(isAgentRunErrorCode(conflict, AgentRunErrorCodes.ConcurrencyLimit)).toBe(false);
    expect(isAgentRunErrorCode(new Error('x'), AgentRunErrorCodes.Conflict)).toBe(false);
  });

  it('distinguishes the concurrency limit from other rate_limit_error types by code', () => {
    const limit = new CognipeerAPIError('cap', 429, 'rate_limit_error', undefined, undefined, 'agent_run_concurrency_limit');
    expect(isAgentRunErrorCode(limit, AgentRunErrorCodes.ConcurrencyLimit)).toBe(true);
  });
});

describe('agent run status helpers', () => {
  it('requires_action is settled for wait() but not terminal', () => {
    expect(isAgentRunTerminal('requires_action')).toBe(false);
    expect(isAgentRunSettled('requires_action')).toBe(true);
  });

  it.each(['succeeded', 'failed', 'canceled'])('%s is both terminal and settled', (status) => {
    expect(isAgentRunTerminal(status)).toBe(true);
    expect(isAgentRunSettled(status)).toBe(true);
  });

  it.each(['queued', 'running'])('%s is neither', (status) => {
    expect(isAgentRunTerminal(status)).toBe(false);
    expect(isAgentRunSettled(status)).toBe(false);
  });
});

describe('agent action error helpers', () => {
  it('isAgentActionErrorCode matches on CognipeerAPIError.errorCode', () => {
    const pending = new CognipeerAPIError('busy', 409, 'pending_action', undefined, undefined, 'pending_action');
    expect(isAgentActionErrorCode(pending, AgentActionErrorCodes.PendingAction)).toBe(true);
    expect(isAgentActionErrorCode(pending, AgentActionErrorCodes.NotPending)).toBe(false);
    expect(isAgentActionErrorCode(new Error('x'), AgentActionErrorCodes.PendingAction)).toBe(false);
  });
});

describe('session and storage error codes', () => {
  it('names the codes the sessions API, the Responses route and the file routes answer', () => {
    expect(AgentActionErrorCodes).toMatchObject({
      SessionNotFound: 'session_not_found',
      SessionConflict: 'session_conflict',
      StorageUnavailable: 'storage_unavailable',
      StorageNotConfigured: 'storage_not_configured',
      AttachmentsDisabled: 'attachments_disabled',
      BucketInUse: 'bucket_in_use',
      NotPending: 'action_not_pending',
      ActionCancelled: 'action_cancelled',
      AuthorizationUnavailable: 'authorization_unavailable',
      MarkdownUnavailable: 'markdown_unavailable',
    });
  });

  it('every code is unique', () => {
    const codes = Object.values(AgentActionErrorCodes);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('isAgentActionErrorCode reads the code of a storage refusal, from the nested or the top-level shape', () => {
    const nested = new CognipeerAPIError('bucket is disabled', 409, 'invalid_request_error', undefined, undefined, 'storage_unavailable');
    const conflict = new CognipeerAPIError('different sessions', 400, 'invalid_request_error', undefined, undefined, 'session_conflict');
    const inUse = new CognipeerAPIError('bucket in use', 409, 'bucket_in_use', { error: 'x', code: 'bucket_in_use', agents: [] }, undefined, 'bucket_in_use');

    expect(isAgentActionErrorCode(nested, AgentActionErrorCodes.StorageUnavailable)).toBe(true);
    expect(isAgentActionErrorCode(nested, AgentActionErrorCodes.StorageNotConfigured)).toBe(false);
    expect(isAgentActionErrorCode(conflict, AgentActionErrorCodes.SessionConflict)).toBe(true);
    expect(isAgentActionErrorCode(inUse, AgentActionErrorCodes.BucketInUse)).toBe(true);
  });
});

describe('response fields the Console sends on top of the core shape', () => {
  it('a session file names the path that serves its bytes', () => {
    const file: SessionFile = {
      id: 'file_1',
      object: 'agent.session.file',
      session_id: 'conv_1',
      name: 'report.pdf',
      mime_type: 'application/pdf',
      size: 5,
      conversion_status: 'succeeded',
      bucket_key: 'session-docs',
      path: 'agent-sessions/ops/conv_1/report.pdf',
      content_url: '/api/client/v1/agents/sessions/conv_1/files/file_1/content',
    };
    expect(file.content_url).toContain('/files/file_1/content');
  });

  it('a webhook endpoint read by a read-only caller says its url is shortened', () => {
    const endpoint: WebhookEndpoint = {
      id: 'whk_1',
      url: 'https://hooks.example.com/services/T0/B0?…',
      urlRedacted: true,
      description: null,
      events: ['action.required'],
      projectId: null,
      status: 'active',
      disabledReason: null,
      failingSince: null,
      createdBy: 'user_1',
      createdAt: null,
      updatedAt: null,
    };
    expect(endpoint.urlRedacted).toBe(true);
  });
});

describe('isSessionEvent', () => {
  const event: SessionStreamEvent = {
    seq: 3,
    type: 'session.status_idle',
    data: { stop_reason: 'requires_action', pending_action_ids: ['act_1'] },
    created_at: '2026-10-10T10:00:00.000Z',
  };

  it('matches on the event type', () => {
    expect(isSessionEvent(event, 'session.status_idle')).toBe(true);
    expect(isSessionEvent(event, 'session.error')).toBe(false);
    if (isSessionEvent(event, 'session.status_idle')) {
      expect(event.data.pending_action_ids).toEqual(['act_1']);
    }
  });
});

describe('WEBHOOK_EVENT_TYPES', () => {
  it('lists the documented v1 event types', () => {
    expect(WEBHOOK_EVENT_TYPES).toContain('action.required');
    expect(WEBHOOK_EVENT_TYPES).toContain('agent_run.requires_action');
    expect(WEBHOOK_EVENT_TYPES).toContain('webhook.test');
  });
});
