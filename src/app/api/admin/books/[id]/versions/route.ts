import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";
import { validateDocumentUpload, FileValidationError } from "@/lib/file-validation";
import { generateStorageKey, putObject } from "@/lib/storage";

// Uploading a new version never touches an existing one (spec §8/§24: the
// original upload is preserved, and a replacement scan becomes a new
// DocumentVersion rather than overwriting the old file). Existing
// annotations keep pointing at the version they were made on.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AuthzError("Missing file", 400);
    }
    const setActive = form.get("setActive") === "true";

    const buffer = Buffer.from(await file.arrayBuffer());
    const verifiedMimeType = await validateDocumentUpload(buffer, file.type);
    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");

    // Duplicate detection (spec §45): flag it, never block or auto-delete —
    // the librarian decides whether it's a re-upload, another edition, or a
    // genuine correction.
    const duplicate = await prisma.documentVersion.findFirst({
      where: { checksumSha256 },
      select: { id: true, bookId: true, originalFilename: true },
    });

    const storageKey = generateStorageKey("originals");
    await putObject({ key: storageKey, body: buffer, contentType: verifiedMimeType });

    const lastVersion = await prisma.documentVersion.findFirst({
      where: { bookId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await prisma.documentVersion.create({
      data: {
        bookId,
        versionNumber,
        storageKey,
        originalFilename: file.name,
        mimeType: verifiedMimeType,
        fileSizeBytes: buffer.byteLength,
        checksumSha256,
        uploadedById: session.user.id,
      },
    });

    // First version for a book always becomes active; later ones only if
    // explicitly requested (e.g. promoting a corrected scan).
    if (setActive || !book.activeVersionId) {
      await prisma.book.update({
        where: { id: bookId },
        data: { activeVersionId: version.id, checksumSha256 },
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "book.upload_version",
      targetType: "Book",
      targetId: bookId,
      metadata: { versionId: version.id, versionNumber, duplicateOf: duplicate?.id },
    });

    return NextResponse.json(
      { ...version, duplicateWarning: duplicate ?? null },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof AuthzError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof FileValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
