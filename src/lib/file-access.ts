import { prisma } from "@/lib/prisma";
import { isViewerLibrarian, hasPrivateGrant, type ViewerUser } from "@/lib/visibility";

export type FileAccessRequest = {
  bookId: string;
  type: "document" | "cover";
  mode: "read" | "download";
  versionId?: string;
  user?: ViewerUser;
};

export type FileAccessResult =
  | { allowed: true; storageKey: string; filename: string }
  | { allowed: false };

const DENY: FileAccessResult = { allowed: false };

// The single authorization decision behind every book file request (spec
// §19/§33/§43). Pulled out of the route handler so it can be exercised
// directly against the database in tests — see
// scripts/verify-private-book-access.ts — without needing live object
// storage. A denial and a "book doesn't exist" are the same DENY value on
// purpose: the caller (the route) turns both into an identical 404, so a
// private book's existence can't be inferred by probing ids.
export async function resolveFileAccess(req: FileAccessRequest): Promise<FileAccessResult> {
  const book = await prisma.book.findUnique({
    where: { id: req.bookId },
    include: { activeVersion: true },
  });
  if (!book) return DENY;

  const librarian = isViewerLibrarian(req.user);

  if (!librarian) {
    if (book.visibility === "DRAFT") return DENY;
    if (book.visibility === "PRIVATE") {
      if (!req.user || !req.user.isActive) return DENY;
      if (!(await hasPrivateGrant(book.id, req.user.id))) return DENY;
    }

    // Online-reading/download permissions gate the document itself, not the
    // cover thumbnail — a cover stays visible wherever the book is listed,
    // independent of whether the document content can be read or downloaded.
    if (req.type === "document") {
      if (req.mode === "read" && !book.allowOnlineReading) return DENY;
      if (req.mode === "download" && !book.allowDownload) return DENY;
    }
  }

  if (req.type === "cover") {
    if (!book.coverImageStorageKey) return DENY;
    return { allowed: true, storageKey: book.coverImageStorageKey, filename: `${book.title}-cover` };
  }

  const version =
    req.versionId && librarian
      ? await prisma.documentVersion.findFirst({ where: { id: req.versionId, bookId: book.id } })
      : book.activeVersion;
  if (!version) return DENY;

  return { allowed: true, storageKey: version.storageKey, filename: version.originalFilename };
}
