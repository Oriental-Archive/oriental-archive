import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const addStepSchema = z.object({
  bookId: z.string().min(1),
  explanation: z.string().max(5000).optional(),
});

// Appends a book to the end of the path. Reordering existing steps is a
// separate endpoint (steps/reorder) since it needs to touch every step's
// order at once.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: readingPathId } = await params;
    const body = addStepSchema.parse(await request.json());

    const [readingPath, book] = await Promise.all([
      prisma.readingPath.findUnique({ where: { id: readingPathId } }),
      prisma.book.findUnique({ where: { id: body.bookId } }),
    ]);
    if (!readingPath) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!book) throw new AuthzError("Unknown book", 400);

    const last = await prisma.readingPathStep.findFirst({
      where: { readingPathId },
      orderBy: { order: "desc" },
    });

    const step = await prisma.readingPathStep.create({
      data: {
        readingPathId,
        bookId: body.bookId,
        explanation: body.explanation,
        order: (last?.order ?? 0) + 1,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "reading_path.add_step",
      targetType: "ReadingPath",
      targetId: readingPathId,
      metadata: { bookId: body.bookId },
    });

    return NextResponse.json(step, { status: 201 });
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
    }
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "That book is already a step in this path" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
