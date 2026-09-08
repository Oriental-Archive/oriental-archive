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
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        language: true,
        churchTradition: true,
        category: true,
        documentType: true,
        rightsStatus: true,
        topics: true,
        churchFathers: true,
        versions: { orderBy: { versionNumber: "desc" } },
        privateAccess: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(book);
  } catch (err) {
    return handleError(err);
  }
}

const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  alternateTitle: z.string().max(500).nullish(),
  originalTitle: z.string().max(500).nullish(),
  author: z.string().max(300).nullish(),
  translator: z.string().max(300).nullish(),
  editor: z.string().max(300).nullish(),
  publisher: z.string().max(300).nullish(),
  publicationYear: z.number().int().min(1).max(9999).nullish(),
  description: z.string().max(20000).nullish(),
  pageCount: z.number().int().positive().nullish(),
  provenance: z.string().max(2000).nullish(),
  scriptureReferences: z.array(z.string().max(200)).max(100).optional(),
  categoryId: z.string().min(1).nullish(),
  rightsStatusId: z.string().min(1).nullish(),
  topicIds: z.array(z.string().min(1)).max(50).optional(),
  churchFatherIds: z.array(z.string().min(1)).max(50).optional(),

  visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]).optional(),
  allowOnlineReading: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  // When present, replaces the full set of accounts allowed to see this
  // Private book — not merged, so removing someone is just leaving them out.
  privateUserIds: z.array(z.string().min(1)).max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;
    const body = updateBookSchema.parse(await request.json());

    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.categoryId) await assertTermType(body.categoryId, "CATEGORY");
    if (body.rightsStatusId) await assertTermType(body.rightsStatusId, "RIGHTS_STATUS");
    for (const t of body.topicIds ?? []) await assertTermType(t, "TOPIC");
    for (const t of body.churchFatherIds ?? []) await assertTermType(t, "CHURCH_FATHER");

    if (body.visibility === "PRIVATE" && !body.privateUserIds && existing.visibility !== "PRIVATE") {
      throw new AuthzError(
        "Set privateUserIds when marking a book Private, so it isn't accidentally visible to no one or everyone",
        400
      );
    }

    const { topicIds, churchFatherIds, privateUserIds, ...bookFields } = body;

    const book = await prisma.$transaction(async (tx) => {
      const updated = await tx.book.update({
        where: { id },
        data: {
          ...bookFields,
          ...(topicIds ? { topics: { set: topicIds.map((tid) => ({ id: tid })) } } : {}),
          ...(churchFatherIds
            ? { churchFathers: { set: churchFatherIds.map((tid) => ({ id: tid })) } }
            : {}),
        },
      });

      if (privateUserIds) {
        await tx.bookPrivateAccess.deleteMany({ where: { bookId: id } });
        if (privateUserIds.length > 0) {
          await tx.bookPrivateAccess.createMany({
            data: privateUserIds.map((userId) => ({
              bookId: id,
              userId,
              grantedById: session.user.id,
            })),
          });
        }
      }

      return updated;
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "book.update",
      targetType: "Book",
      targetId: id,
      metadata: { changedFields: Object.keys(body) },
    });

    return NextResponse.json(book);
  } catch (err) {
    return handleError(err);
  }
}

async function assertTermType(id: string, type: string) {
  const term = await prisma.controlledTerm.findUnique({ where: { id } });
  if (!term) throw new AuthzError(`Unknown controlled term: ${id}`, 400);
  if (term.type !== type) throw new AuthzError(`Term ${id} is not of type ${type}`, 400);
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
