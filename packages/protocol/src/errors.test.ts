import { describe, expect, it } from 'vitest';

import { ERROR_HTTP_STATUS, ErrorCode, errorResponse } from './errors.js';

describe('ErrorCode / ERROR_HTTP_STATUS (§18)', () => {
  it('maps every code to the agreed HTTP status', () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.MalformedRequest]).toBe(400);
    expect(ERROR_HTTP_STATUS[ErrorCode.Unauthorized]).toBe(401);
    expect(ERROR_HTTP_STATUS[ErrorCode.BundleTooLarge]).toBe(413);
    expect(ERROR_HTTP_STATUS[ErrorCode.UnsupportedMediaType]).toBe(415);
    expect(ERROR_HTTP_STATUS[ErrorCode.InvalidDocument]).toBe(422);
    expect(ERROR_HTTP_STATUS[ErrorCode.InternalError]).toBe(500);
  });
});

describe('errorResponse', () => {
  it('builds the unified error shape', () => {
    expect(errorResponse(ErrorCode.InvalidDocument, 'bad bundle')).toEqual({
      error: { code: 'INVALID_DOCUMENT', message: 'bad bundle' },
    });
  });
});
