import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const report = await prisma.issueReport.findUnique({
      where: { id },
      include: {
        book: { select: { id: true, title: true } },
        reporterUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(report);
  } catch (err) {
    return handleError(err);
  }
}

const updateSchema = z.object({
  status: z.enum(["NEW", "REVIEWING", "RESOLVED", "DISMISSED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.issueReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.issueReport.update({ where: { id }, data: { status: body.status } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "issue_report.update",
      targetType: "IssueReport",
      targetId: id,
      metadata: { from: existing.status, to: body.status },
    });

    return NextResponse.json(updated);
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
