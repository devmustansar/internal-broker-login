import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/server/services/auth.service";
import { auditLogService } from "@/server/services/audit.service";
import { MOCK_USER_PASSWORDS } from "@/lib/seed-data";
import { badRequest, serverError } from "@/lib/api-helpers";
import type { MockLoginRequest } from "@/types";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MockLoginRequest;
    const { email, password } = body;

    if (!email || !password) {
      return badRequest("email and password are required");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Since this is a POC, check passwordHash if it exists, otherwise fall back to seed mock passwords
    const expectedPassword = user.passwordHash || MOCK_USER_PASSWORDS[email];
    if (!expectedPassword || expectedPassword !== password) {
      auditLogService.log({
        action: "user_login",
        internalUserId: email,
        outcome: "failure",
        details: { reason: "invalid_credentials" },
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await authService.signToken(user as any);

    auditLogService.log({
      action: "user_login",
      internalUserId: user.id,
      outcome: "success",
      details: { email },
    });

    const response = NextResponse.json({ 
      token, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        allowedResourceKeys: user.allowedResourceKeys
      } 
    });
    
    response.cookies.set("__broker_token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    return serverError(err);
  }
}
