import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, changeAccountRole, setAccountActive, AuthzError } from "@/lib/authz";

const updateSchema = z.object({
  role: z.enum(["STANDARD", "LIBRARIAN"]).optional(),
  isActive: z.boolean().optional(),
});

// Role changes and enable/disable both go through authz.ts's guarded
// helpers, which refuse to touch the Master Librarian (backed by the
// database trigger regardless) and audit-log every change.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    let updated;
    if (body.role !== undefined) {
      updated = await changeAccountRole({ actorId: session.user.id, targetUserId: id, newRole: body.role });
    }
    if (body.isActive !== undefined) {
      updated = await setAccountActive({ actorId: session.user.id, targetUserId: id, isActive: body.isActive });
    }
    if (!updated) {
      return NextResponse.json({ error: "No changes specified" }, { status: 400 });
    }

    return NextResponse.json({ id: updated.id, role: updated.role, isActive: updated.isActive });
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
