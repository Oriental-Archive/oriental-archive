import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings";

const updateSchema = z.object({
  general: z
    .object({
      announcementEnabled: z.boolean().optional(),
      announcementText: z.string().max(2000).optional(),
      contactEmail: z.string().email().or(z.literal("")).optional(),
    })
    .optional(),
  uploadLimits: z
    .object({
      maxDocumentUploadBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024).optional(),
      maxImageUploadBytes: z.number().int().positive().max(100 * 1024 * 1024).optional(),
    })
    .optional(),
  featured: z
    .object({
      bookIds: z.array(z.string().min(1)).max(50).optional(),
      readingPathIds: z.array(z.string().min(1)).max(50).optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    return NextResponse.json(await getSiteSettings());
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const body = updateSchema.parse(await request.json());

    await updateSiteSettings(body);

    await writeAuditLog({
      actorId: session.user.id,
      action: "site_settings.update",
      metadata: { changedGroups: Object.keys(body) },
    });

    return NextResponse.json(await getSiteSettings());
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
