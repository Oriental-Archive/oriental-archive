import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const updateSchema = z.object({
  explanation: z.string().max(5000).nullish(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: readingPathId, stepId } = await params;
    const body = updateSchema.parse(await request.json());

    const step = await prisma.readingPathStep.findFirst({ where: { id: stepId, readingPathId } });
    if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.readingPathStep.update({
      where: { id: stepId },
      data: { explanation: body.explanation },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "reading_path.update_step",
      targetType: "ReadingPathStep",
      targetId: stepId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}

// Removing a step closes the gap it leaves behind, so the remaining steps
// stay a contiguous 1..N sequence rather than accumulating holes.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: readingPathId, stepId } = await params;

    const step = await prisma.readingPathStep.findFirst({ where: { id: stepId, readingPathId } });
    if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.readingPathStep.delete({ where: { id: stepId } });
      // Temporary offset avoids colliding with the unique (readingPathId,
      // order) constraint while shifting everything after the removed step
      // down by one.
      const remaining = await tx.readingPathStep.findMany({
        where: { readingPathId, order: { gt: step.order } },
        orderBy: { order: "asc" },
      });
      for (const s of remaining) {
        await tx.readingPathStep.update({ where: { id: s.id }, data: { order: s.order + 100000 } });
      }
      for (const s of remaining) {
        await tx.readingPathStep.update({ where: { id: s.id }, data: { order: s.order - 100000 - 1 } });
      }
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "reading_path.remove_step",
      targetType: "ReadingPathStep",
      targetId: stepId,
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
