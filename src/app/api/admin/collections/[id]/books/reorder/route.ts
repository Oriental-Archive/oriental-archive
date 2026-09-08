import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const reorderSchema = z.object({
  // The full list of this collection's CollectionBook entry ids, in order.
  entryIds: z.array(z.string().min(1)).min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: collectionId } = await params;
    const { entryIds } = reorderSchema.parse(await request.json());

    const existing = await prisma.collectionBook.findMany({ where: { collectionId } });
    const existingIds = new Set(existing.map((e) => e.id));
    if (entryIds.length !== existing.length || !entryIds.every((id) => existingIds.has(id))) {
      throw new AuthzError("entryIds must be exactly this collection's current books", 400);
    }

    // No unique constraint on `order` here (unlike Reading Path steps), so
    // this can just write the final values directly in one transaction.
    await prisma.$transaction(
      entryIds.map((id, i) => prisma.collectionBook.update({ where: { id }, data: { order: i + 1 } }))
    );

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.reorder_books",
      targetType: "Collection",
      targetId: collectionId,
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
