import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/server/services/auth.service";
import type { AuthContext } from "@/types";

/**
 * Extracts and verifies the JWT from the Authorization header or __broker_token cookie.
 * Returns null if not authenticated.
 */
export async function getAuthContext(
  req: NextRequest
): Promise<AuthContext | null> {
  // Try Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return authService.verifyToken(token);
  }

  // Try cookie
  const cookieToken = req.cookies.get("__broker_token")?.value;
  if (cookieToken) {
    return authService.verifyToken(cookieToken);
  }

  return null;
}

/**
 * Returns a 401 response with JSON error body.
 */
export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Returns a 403 response.
 */
export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Returns a 400 response.
 */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Returns a 500 response.
 */
export function serverError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[API Error]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Returns a 404 response.
 */
export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
