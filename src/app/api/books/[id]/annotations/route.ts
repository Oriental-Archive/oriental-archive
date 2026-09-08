import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, AuthzError } from "@/lib/authz";
import { canViewBook } from "@/lib/visibility";
import type { Prisma } from "@/generated/prisma/client";

// Annotations are private to the signed-in user who made them (spec §10) —
// there is no librarian bypass here, unlike file access. Anonymous visitors
// never call this: their highlights live in browser IndexedDB (spec §22),
// never in this table and never in a cookie.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: bookId } = await params;
    const versionId = new URL(request.url).searchParams.get("versionId") ?? undefined;

    const annotations = await prisma.annotation.findMany({
      where: { bookId, userId: session.user.id, ...(versionId ? { documentVersionId: versionId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(annotations);
  } catch (err) {
    return handleError(err);
  }
}

const createAnnotationSchema = z.object({
  documentVersionId: z.string().min(1),
  location: z.unknown(),
  selectedText: z.string().max(20000).optional(),
  highlightData: z.unknown().optional(),
  note: z.string().max(5000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: bookId } = await params;
    const body = createAnnotationSchema.parse(await request.json());

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book || !(await canViewBook(book, session.user))) {
      throw new AuthzError("Not found", 404);
    }

    const version = await prisma.documentVersion.findFirst({
      where: { id: body.documentVersionId, bookId },
    });
    if (!version) throw new AuthzError("Unknown document version", 400);

    // Built as a mutated variable rather than a conditional spread into the
    // object literal: Prisma's create-input type is a checked/unchecked XOR
    // union, and TypeScript loses the "optional" leniency on highlightData
    // when it's introduced via `...(cond ? {a} : {})` inside that literal.
    const data: Prisma.AnnotationUncheckedCreateInput = {
      userId: session.user.id,
      bookId,
      documentVersionId: body.documentVersionId,
      location: body.location as Prisma.InputJsonValue,
      selectedText: body.selectedText,
      note: body.note,
    };
    if (body.highlightData !== undefined) {
      data.highlightData = body.highlightData as Prisma.InputJsonValue;
    }

    const annotation = await prisma.annotation.create({ data });
    return NextResponse.json(annotation, { status: 201 });
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
