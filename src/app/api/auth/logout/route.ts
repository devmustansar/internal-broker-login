import { NextRequest, NextResponse } from "next/server";
import { auditLogService } from "@/server/services/audit.service";
import { getAuthContext, serverError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (auth) {
      auditLogService.log({
        action: "user_logout",
        internalUserId: auth.userId,
        outcome: "info",
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("__broker_token", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    return serverError(err);
  }
}
