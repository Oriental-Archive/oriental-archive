import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const TERM_TYPES = [
  "LANGUAGE",
  "CHURCH_TRADITION",
  "CATEGORY",
  "DOCUMENT_TYPE",
  "RIGHTS_STATUS",
  "TOPIC",
  "CHURCH_FATHER",
] as const;

const createTermSchema = z.object({
  type: z.enum(TERM_TYPES),
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
});

// Controlled vocabularies (spec §6): librarians extend these instead of free
// text, so "Tigrinya" / "Tigrigna" / "tig" never become separate unrelated
// values. Scoped to librarians for now — a public read endpoint for catalog
// filters comes with the Catalog phase.
export async function GET(request: Request) {
  try {
    await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");

    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const type = typeParam ? z.enum(TERM_TYPES).parse(typeParam) : undefined;

    const terms = await prisma.controlledTerm.findMany({
      where: { ...(type ? { type } : {}), active: true },
      orderBy: [{ type: "asc" }, { label: "asc" }],
    });
    return NextResponse.json(terms);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const body = createTermSchema.parse(await request.json());

    // Re-submitting an existing [type, value] relabels it rather than
    // failing (spec §6: this is also how a librarian fixes a typo in a
    // label, since there's no separate edit UI) — but that's a real,
    // consequential change to every book already using it, so the response
    // says which happened rather than always claiming "created".
    const existing = await prisma.controlledTerm.findUnique({
      where: { type_value: { type: body.type, value: body.value } },
    });

    const term = await prisma.controlledTerm.upsert({
      where: { type_value: { type: body.type, value: body.value } },
      update: { label: body.label, active: true },
      create: body,
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: existing ? "controlled_term.update" : "controlled_term.create",
      targetType: "ControlledTerm",
      targetId: term.id,
      metadata: { type: body.type, value: body.value, previousLabel: existing?.label },
    });

    return NextResponse.json(
      { ...term, previousLabel: existing?.label ?? null },
      { status: existing ? 200 : 201 }
    );
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
