import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewReadingPath } from "@/lib/visibility";
import { getSignedDownloadUrl } from "@/lib/storage";

// Same gate-then-redirect shape as /api/books/[id]/file (spec §33): a
// reading path the caller can't see returns the same 404 as a missing cover
// or a nonexistent path, so probing ids can't distinguish them.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const readingPath = await prisma.readingPath.findUnique({
    where: { id },
    select: { id: true, visibility: true, coverImageStorageKey: true },
  });
  if (!readingPath?.coverImageStorageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const allowed = await canViewReadingPath(readingPath, session?.user);
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl({
    key: readingPath.coverImageStorageKey,
    filename: "cover",
  });
  return NextResponse.redirect(signedUrl);
}
