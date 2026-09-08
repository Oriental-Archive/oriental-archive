import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const updateSchema = z.object({
  active: z.boolean(),
});

// Deactivating a term never touches books that already reference it (their
// languageId/categoryId/etc. FK is untouched) — it only drops out of future
// selection: the Add/Edit Book term dropdowns and the Catalog filters, both
// of which already query `where: { active: true }`. This is the only way to
// retire a mistyped value now that the Vocabulary page shows every term
// (active and inactive) rather than filtering inactive ones out entirely.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.controlledTerm.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const term = await prisma.controlledTerm.update({ where: { id }, data: { active: body.active } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "controlled_term.update",
      targetType: "ControlledTerm",
      targetId: id,
      metadata: { changedFields: ["active"], active: body.active },
    });

    return NextResponse.json(term);
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
