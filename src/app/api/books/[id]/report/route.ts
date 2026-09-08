import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewBook } from "@/lib/visibility";

const reportSchema = z.object({
  reason: z.enum([
    "COPYRIGHT",
    "INCORRECT_ATTRIBUTION",
    "INCORRECT_METADATA",
    "BROKEN_FILE",
    "POOR_SCAN",
    "MISSING_PAGES",
    "THEOLOGICAL_CATEGORIZATION",
    "OTHER",
  ]),
  details: z.string().max(5000).optional(),
});

// Anyone who can see a book may report a problem with it (spec §25) — a
// report never changes the book itself, it only lands in the librarian
// queue for review.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth.api.getSession({ headers: request.headers });
  if (!(await canViewBook(book, session?.user))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const report = await prisma.issueReport.create({
    data: {
      bookId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      reporterUserId: session?.user.id,
    },
  });

  return NextResponse.json({ id: report.id }, { status: 201 });
}
