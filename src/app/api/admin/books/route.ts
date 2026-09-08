import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  alternateTitle: z.string().max(500).optional(),
  originalTitle: z.string().max(500).optional(),
  author: z.string().max(300).optional(),
  translator: z.string().max(300).optional(),
  editor: z.string().max(300).optional(),
  publisher: z.string().max(300).optional(),
  publicationYear: z.number().int().min(1).max(9999).optional(),
  description: z.string().min(1).max(20000),
  pageCount: z.number().int().positive(),
  provenance: z.string().max(2000).optional(),
  scriptureReferences: z.array(z.string().max(200)).max(100).default([]),
  languageId: z.string().min(1),
  churchTraditionId: z.string().min(1),
  documentTypeId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  rightsStatusId: z.string().min(1).optional(),
  topicIds: z.array(z.string().min(1)).max(50).default([]),
  churchFatherIds: z.array(z.string().min(1)).max(50).default([]),
});

// New books always start as drafts (spec: "Visible only to authorized
// librarians while being prepared") — visibility is changed explicitly and
// separately via PATCH /api/admin/books/[id].
export async function POST(request: Request) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const body = createBookSchema.parse(await request.json());

    await assertTermsValid([
      { id: body.languageId, type: "LANGUAGE" },
      { id: body.churchTraditionId, type: "CHURCH_TRADITION" },
      { id: body.documentTypeId, type: "DOCUMENT_TYPE" },
      ...(body.categoryId ? [{ id: body.categoryId, type: "CATEGORY" as const }] : []),
      ...(body.rightsStatusId ? [{ id: body.rightsStatusId, type: "RIGHTS_STATUS" as const }] : []),
      ...body.topicIds.map((id) => ({ id, type: "TOPIC" as const })),
      ...body.churchFatherIds.map((id) => ({ id, type: "CHURCH_FATHER" as const })),
    ]);

    const { topicIds, churchFatherIds, ...bookFields } = body;

    const book = await prisma.book.create({
      data: {
        ...bookFields,
        visibility: "DRAFT",
        createdById: session.user.id,
        topics: { connect: topicIds.map((id) => ({ id })) },
        churchFathers: { connect: churchFatherIds.map((id) => ({ id })) },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "book.create",
      targetType: "Book",
      targetId: book.id,
    });

    return NextResponse.json(book, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

// Server-side validation of every controlled-term reference: both that it
// exists and that it's the type the field expects, so a client can't, say,
// pass a LANGUAGE term's id into churchTraditionId.
async function assertTermsValid(refs: { id: string; type: string }[]) {
  if (refs.length === 0) return;
  const found = await prisma.controlledTerm.findMany({
    where: { id: { in: refs.map((r) => r.id) } },
  });
  const byId = new Map(found.map((t) => [t.id, t]));
  for (const ref of refs) {
    const term = byId.get(ref.id);
    if (!term) throw new AuthzError(`Unknown controlled term: ${ref.id}`, 400);
    if (term.type !== ref.type) {
      throw new AuthzError(`Term ${ref.id} is not of type ${ref.type}`, 400);
    }
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
