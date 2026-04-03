import { NextRequest, NextResponse } from "next/server";
import { brokerSessionService } from "@/server/services/broker-session.service";
import {
  getAuthContext,
  unauthorized,
  serverError,
} from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await ctx.params;
    const session = await brokerSessionService.getSession(id);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.internalUserId !== auth.userId && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await brokerSessionService.endSession(id, auth.userId);
    return NextResponse.json({ success: true, sessionId: id });
  } catch (err) {
    return serverError(err);
  }
}
