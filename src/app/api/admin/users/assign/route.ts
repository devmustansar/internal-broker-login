import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (auth.role !== "admin") return forbidden();

    const data = await req.json();
    const { email, resourceKey } = data;

    if (!email || !resourceKey) {
      return badRequest("Missing required fields (email, resourceKey)");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return badRequest("User not found: " + email);
    }

    if (user.allowedResourceKeys.includes("*") || user.allowedResourceKeys.includes(resourceKey)) {
      return NextResponse.json({ message: "User already has access to this resource" }, { status: 200 });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        allowedResourceKeys: {
          push: resourceKey,
        },
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
