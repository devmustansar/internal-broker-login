import { NextRequest, NextResponse } from "next/server";
import { appAccessService } from "@/server/services/app-access.service";
import { getAuthContext, unauthorized, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const user = await appAccessService.getUserById(auth.userId);
    if (!user) return unauthorized("User not found");

    // Super admins see everything
    if (user.role === "super_admin") {
      const allWeb = await appAccessService.getAllResources();
      const allAws = await prisma.awsResource.findMany({ where: { isActive: true } });
      return NextResponse.json([...allWeb, ...allAws]);
    }

    // For other users, look up their resource access via the join table
    const accesses = await prisma.userResourceAccess.findMany({
      where: { userId: auth.userId },
      include: {
        resource: true,
        awsResource: true,
      },
    });

    const accessibleWeb = accesses
      .filter(a => a.resource && a.resource.isActive)
      .map(a => a.resource!);

    const accessibleAws = accesses
      .filter(a => a.awsResource && a.awsResource.isActive)
      .map(a => a.awsResource!);

    return NextResponse.json([...accessibleWeb, ...accessibleAws]);
  } catch (err) {
    return serverError(err);
  }
}
