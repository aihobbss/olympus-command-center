import { NextResponse } from "next/server";

/**
 * Standardized API error response helper.
 * All API routes should use this for consistent error shapes.
 *
 * @param error  - Short error code/type (e.g., "auth_failed", "missing_field")
 * @param message - Human-readable error description
 * @param status  - HTTP status code
 * @param retryable - Whether the client should offer a retry option
 */
export function apiError(
  error: string,
  message: string,
  status: number,
  retryable = false
) {
  return NextResponse.json({ error, message, retryable }, { status });
}
