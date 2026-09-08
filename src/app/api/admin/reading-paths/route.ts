import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  topic: z.string().max(200).optional(),
});

// New Reading Paths always start as drafts, same as Books (spec §13/§16):
// a librarian assembles the ordered list of steps before publishing.
export async function POST(request: Request) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const body = createSchema.parse(await request.json());

    const readingPath = await prisma.readingPath.create({
      data: { ...body, visibility: "DRAFT", createdById: session.user.id },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "reading_path.create",
      targetType: "ReadingPath",
      targetId: readingPath.id,
    });

    return NextResponse.json(readingPath, { status: 201 });
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
