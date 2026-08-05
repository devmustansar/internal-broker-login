import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/notifications
 * Lists the current user's notifications, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
    ]);

    return NextResponse.json({ items: notifications, unreadCount });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/notifications
 * Body: { id?: string, all?: boolean } — marks one or all of the user's notifications as read.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const body = await req.json();

    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: auth.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: auth.userId },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "id or all is required" }, { status: 400 });
  } catch (err) {
    return serverError(err);
  }
}
