import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, AuthzError } from "@/lib/authz";
import type { Prisma } from "@/generated/prisma/client";

// Ownership is the only rule here — an annotation belongs to exactly the
// user who made it, full stop (spec §10: "Annotations are private to the
// user"). No librarian bypass, no book-visibility check needed beyond that:
// if you own the row, you can see and change it.
async function loadOwned(annotationId: string, userId: string) {
  const annotation = await prisma.annotation.findUnique({ where: { id: annotationId } });
  if (!annotation || annotation.userId !== userId) {
    throw new AuthzError("Not found", 404);
  }
  return annotation;
}

const updateSchema = z.object({
  note: z.string().max(5000).nullish(),
  highlightData: z.unknown().optional(),
  // Bookmarks made by the PDF reader keep their title/note/tag here.
  location: z.unknown().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  try {
    const session = await requireSession();
    const { annotationId } = await params;
    await loadOwned(annotationId, session.user.id);

    const body = updateSchema.parse(await request.json());
    const data: Prisma.AnnotationUncheckedUpdateInput = {};
    if (body.note !== undefined) data.note = body.note;
    if (body.highlightData !== undefined) data.highlightData = body.highlightData as Prisma.InputJsonValue;
    if (body.location !== undefined) data.location = body.location as Prisma.InputJsonValue;

    const updated = await prisma.annotation.update({
      where: { id: annotationId },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  try {
    const session = await requireSession();
    const { annotationId } = await params;
    await loadOwned(annotationId, session.user.id);

    await prisma.annotation.delete({ where: { id: annotationId } });
    return new NextResponse(null, { status: 204 });
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
