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
import type { SessionStreamEvent } from './types';

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

describe('isSessionEvent', () => {
  const event: SessionStreamEvent = {
    seq: 3,
    type: 'session.status_idle',
    data: { stopReason: 'requires_action', pendingActionIds: ['act_1'] },
    created_at: '2026-10-10T10:00:00.000Z',
  };

  it('matches on the event type', () => {
    expect(isSessionEvent(event, 'session.status_idle')).toBe(true);
    expect(isSessionEvent(event, 'session.error')).toBe(false);
    if (isSessionEvent(event, 'session.status_idle')) {
      expect(event.data.pendingActionIds).toEqual(['act_1']);
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
