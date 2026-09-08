import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, AuthzError } from "@/lib/authz";
import { validateImageUpload, FileValidationError } from "@/lib/file-validation";
import { generateStorageKey, putObject, deleteObject } from "@/lib/storage";

// Mirrors /api/admin/books/[id]/cover — same validation, storage prefix, and
// best-effort cleanup of the previous object.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const { id } = await params;

    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AuthzError("Missing file", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const verifiedMimeType = await validateImageUpload(buffer, file.type);

    const storageKey = generateStorageKey("covers");
    await putObject({ key: storageKey, body: buffer, contentType: verifiedMimeType });

    const previousKey = collection.coverImageStorageKey;
    await prisma.collection.update({ where: { id }, data: { coverImageStorageKey: storageKey } });

    if (previousKey) {
      await deleteObject(previousKey).catch(() => {
        // Best-effort cleanup — an orphaned cover object is a minor storage
        // cost, not a correctness or security issue.
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "collection.update_cover",
      targetType: "Collection",
      targetId: id,
    });

    return NextResponse.json({ coverImageStorageKey: storageKey });
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
