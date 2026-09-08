import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

// No renumbering needed on removal, unlike Reading Path steps — CollectionBook
// has no uniqueness constraint on `order` (a collection has no required
// reading order), so gaps left behind are harmless; display is always
// `ORDER BY order ASC` regardless.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bookId: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: collectionId, bookId } = await params;

    const entry = await prisma.collectionBook.findUnique({
      where: { collectionId_bookId: { collectionId, bookId } },
    });
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.collectionBook.delete({ where: { id: entry.id } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.remove_book",
      targetType: "Collection",
      targetId: collectionId,
      metadata: { bookId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
