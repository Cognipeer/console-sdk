import { describe, it, expect } from 'vitest';
import { CognipeerError, CognipeerAPIError } from './types';

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
