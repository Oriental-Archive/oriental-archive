import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20000).nullish(),
  visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]).optional(),
  privateUserIds: z.array(z.string().min(1)).max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.collection.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.visibility === "PRIVATE" && !body.privateUserIds && existing.visibility !== "PRIVATE") {
      throw new AuthzError(
        "Set privateUserIds when marking a Collection Private, so it isn't accidentally visible to no one or everyone",
        400
      );
    }

    const { privateUserIds, ...fields } = body;

    const collection = await prisma.$transaction(async (tx) => {
      const updated = await tx.collection.update({ where: { id }, data: fields });

      if (privateUserIds) {
        await tx.collectionPrivateAccess.deleteMany({ where: { collectionId: id } });
        if (privateUserIds.length > 0) {
          await tx.collectionPrivateAccess.createMany({
            data: privateUserIds.map((userId) => ({
              collectionId: id,
              userId,
              grantedById: session.user.id,
            })),
          });
        }
      }

      return updated;
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.update",
      targetType: "Collection",
      targetId: id,
      metadata: { changedFields: Object.keys(body) },
    });

    return NextResponse.json(collection);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;

    const existing = await prisma.collection.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.collection.delete({ where: { id } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.delete",
      targetType: "Collection",
      targetId: id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof AuthzError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
