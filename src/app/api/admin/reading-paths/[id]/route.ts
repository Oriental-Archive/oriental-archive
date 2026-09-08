import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20000).nullish(),
  topic: z.string().max(200).nullish(),
  visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]).optional(),
  // Replaces the full set, same convention as Book's privateUserIds.
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

    const existing = await prisma.readingPath.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.visibility === "PRIVATE" && !body.privateUserIds && existing.visibility !== "PRIVATE") {
      throw new AuthzError(
        "Set privateUserIds when marking a Reading Path Private, so it isn't accidentally visible to no one or everyone",
        400
      );
    }

    const { privateUserIds, ...fields } = body;

    const readingPath = await prisma.$transaction(async (tx) => {
      const updated = await tx.readingPath.update({ where: { id }, data: fields });

      if (privateUserIds) {
        await tx.readingPathPrivateAccess.deleteMany({ where: { readingPathId: id } });
        if (privateUserIds.length > 0) {
          await tx.readingPathPrivateAccess.createMany({
            data: privateUserIds.map((userId) => ({
              readingPathId: id,
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
      action: "reading_path.update",
      targetType: "ReadingPath",
      targetId: id,
      metadata: { changedFields: Object.keys(body) },
    });

    return NextResponse.json(readingPath);
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

    const existing = await prisma.readingPath.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.readingPath.delete({ where: { id } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "reading_path.delete",
      targetType: "ReadingPath",
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
