import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const reorderSchema = z.object({
  // The full list of this path's step ids, in the desired final order.
  stepIds: z.array(z.string().min(1)).min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: readingPathId } = await params;
    const { stepIds } = reorderSchema.parse(await request.json());

    const existing = await prisma.readingPathStep.findMany({ where: { readingPathId } });
    const existingIds = new Set(existing.map((s) => s.id));
    if (stepIds.length !== existing.length || !stepIds.every((id) => existingIds.has(id))) {
      throw new AuthzError("stepIds must be exactly this path's current steps", 400);
    }

    // Two passes through a temporary high offset, same trick as the delete
    // handler, so the (readingPathId, order) unique constraint never sees a
    // collision partway through the transaction.
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < stepIds.length; i++) {
        await tx.readingPathStep.update({ where: { id: stepIds[i] }, data: { order: i + 100000 } });
      }
      for (let i = 0; i < stepIds.length; i++) {
        await tx.readingPathStep.update({ where: { id: stepIds[i] }, data: { order: i + 1 } });
      }
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "reading_path.reorder_steps",
      targetType: "ReadingPath",
      targetId: readingPathId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
