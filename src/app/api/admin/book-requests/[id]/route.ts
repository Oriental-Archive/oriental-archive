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
    const bookRequest = await prisma.bookRequest.findUnique({
      where: { id },
      include: {
        requesterUser: { select: { id: true, name: true, email: true } },
        fulfilledBook: { select: { id: true, title: true } },
      },
    });
    if (!bookRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(bookRequest);
  } catch (err) {
    return handleError(err);
  }
}

const updateSchema = z.object({
  status: z.enum(["NEW", "REVIEWING", "APPROVED", "ADDED", "DECLINED"]).optional(),
  internalNotes: z.string().max(5000).nullish(),
  fulfilledBookId: z.string().min(1).nullish(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.bookRequest.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.fulfilledBookId) {
      const book = await prisma.book.findUnique({ where: { id: body.fulfilledBookId } });
      if (!book) throw new AuthzError("Unknown book", 400);
    }

    const updated = await prisma.bookRequest.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.internalNotes !== undefined ? { internalNotes: body.internalNotes } : {}),
        ...(body.fulfilledBookId !== undefined ? { fulfilledBookId: body.fulfilledBookId } : {}),
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "book_request.update",
      targetType: "BookRequest",
      targetId: id,
      metadata: { changedFields: Object.keys(body) },
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
