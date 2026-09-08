import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveFileAccess } from "@/lib/file-access";
import { getSignedDownloadUrl } from "@/lib/storage";

const querySchema = z.object({
  type: z.enum(["document", "cover"]).default("document"),
  mode: z.enum(["read", "download"]).default("read"),
  versionId: z.string().optional(),
});

// The single gate every book file passes through (spec §19/§33): visibility,
// online-reading/download permissions, and per-user private-access grants
// are all checked in resolveFileAccess() — never by hiding a button in the
// UI. A book that exists but the caller can't see returns the same 404 as
// one that doesn't exist, so probing ids can't distinguish "private" from
// "nonexistent". Redirects (rather than returning JSON) so this can be used
// directly as a plain <a href> or <img src>.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });

  const result = await resolveFileAccess({
    bookId,
    ...parsed.data,
    user: session?.user
      ? { id: session.user.id, role: session.user.role, isActive: session.user.isActive }
      : null,
  });

  if (!result.allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl({
    key: result.storageKey,
    filename: result.filename,
    disposition: parsed.data.mode === "download" ? "attachment" : "inline",
  });
  return NextResponse.redirect(signedUrl);
}
