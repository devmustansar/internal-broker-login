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

    const allWebResources = await appAccessService.getAllResources();
    const allAwsResources = await prisma.awsResource.findMany({
      where: { isActive: true },
    });

    const accessibleWeb =
      user.allowedResourceKeys.includes("*")
        ? allWebResources
        : allWebResources.filter((r) =>
            user.allowedResourceKeys.includes(r.resourceKey)
          );

    const accessibleAws =
      user.allowedResourceKeys.includes("*")
        ? allAwsResources
        : allAwsResources.filter((r: any) =>
            user.allowedResourceKeys.includes(r.resourceKey)
          );

    return NextResponse.json([...accessibleWeb, ...accessibleAws]);
  } catch (err) {
    return serverError(err);
  }
}
