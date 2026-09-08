import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const addBookSchema = z.object({ bookId: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: collectionId } = await params;
    const { bookId } = addBookSchema.parse(await request.json());

    const [collection, book] = await Promise.all([
      prisma.collection.findUnique({ where: { id: collectionId } }),
      prisma.book.findUnique({ where: { id: bookId } }),
    ]);
    if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!book) throw new AuthzError("Unknown book", 400);

    const last = await prisma.collectionBook.findFirst({
      where: { collectionId },
      orderBy: { order: "desc" },
    });

    const entry = await prisma.collectionBook.create({
      data: { collectionId, bookId, order: (last?.order ?? 0) + 1 },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.add_book",
      targetType: "Collection",
      targetId: collectionId,
      metadata: { bookId },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
    }
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "That book is already in this collection" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
