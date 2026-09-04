/** Unified error contract (baseline §18). */

export const ErrorCode = {
  MalformedRequest: 'MALFORMED_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  BundleTooLarge: 'BUNDLE_TOO_LARGE',
  UnsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  InvalidDocument: 'INVALID_DOCUMENT',
  InternalError: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status for each error code (baseline §18). */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.MalformedRequest]: 400,
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.BundleTooLarge]: 413,
  [ErrorCode.UnsupportedMediaType]: 415,
  [ErrorCode.InvalidDocument]: 422,
  [ErrorCode.InternalError]: 500,
};

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function errorResponse(code: ErrorCode, message: string): ErrorResponse {
  return { error: { code, message } };
}
