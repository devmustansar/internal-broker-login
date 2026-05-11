import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin, canManageOrg } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/credential-groups/[id]
 * Update a credential group name/description.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const existing = await prisma.credentialGroup.findUnique({ where: { id } });
    if (!existing) return notFound("Group not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, existing.organizationId)) {
      return forbidden();
    }

    const data = await req.json();
    const updated = await prisma.credentialGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: { _count: { select: { credentials: true, members: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/credential-groups/[id]
 * Delete a credential group (cascades members & entries).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const existing = await prisma.credentialGroup.findUnique({ where: { id } });
    if (!existing) return notFound("Group not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, existing.organizationId)) {
      return forbidden();
    }

    await prisma.credentialGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
