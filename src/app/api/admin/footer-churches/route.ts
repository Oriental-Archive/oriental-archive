import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  websiteUrl: z.string().url().or(z.literal("")).optional(),
  displayOrder: z.number().int().optional(),
});

// Created disabled by default (spec §26/§27: a church's logo/entry must
// stay off the public footer until a librarian explicitly enables it, and
// permission for the logo itself has been separately obtained).
export async function POST(request: Request) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const body = createSchema.parse(await request.json());

    const church = await prisma.footerChurch.create({
      data: { ...body, enabled: false },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "footer_church.create",
      targetType: "FooterChurch",
      targetId: church.id,
    });

    return NextResponse.json(church, { status: 201 });
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
