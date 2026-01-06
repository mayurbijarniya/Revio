import { ERROR_CODES } from "./constants";

type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Custom API error class
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    statusCode: number = 400,
    details?: Record<string, unknown>
  ) {
    super(ERROR_CODES[code]);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = "ApiError";
  }

  toResponse(): Response {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };

    return Response.json(body, { status: this.statusCode });
  }
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status: number = 200): Response {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  return Response.json(body, { status });
}

/**
 * Create an error response
 */
export function errorResponse(
  code: ErrorCode,
  statusCode: number = 400,
  details?: Record<string, unknown>
): Response {
  return new ApiError(code, statusCode, details).toResponse();
}

/**
 * Handle unknown errors
 */
export function handleError(error: unknown): Response {
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  console.error("Unhandled error:", error);

  return errorResponse("INTERNAL_001", 500, {
    message: error instanceof Error ? error.message : "Unknown error",
  });
}
