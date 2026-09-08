import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
});

// New Collections start as drafts, same convention as Books/Reading Paths.
export async function POST(request: Request) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const body = createSchema.parse(await request.json());

    const collection = await prisma.collection.create({
      data: { ...body, visibility: "DRAFT", createdById: session.user.id },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.create",
      targetType: "Collection",
      targetId: collection.id,
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
