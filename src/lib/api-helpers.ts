import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { AuthContext } from "@/types";

/**
 * Extracts and verifies the JWT from NextAuth.
 * Returns null if not authenticated.
 */
export async function getAuthContext(
  req: NextRequest
): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    return {
      userId: (session.user as any).id,
      email: session.user.email as string,
      role: (session.user as any).role,
    };
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
