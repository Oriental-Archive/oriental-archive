import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type ViewerUser = { id: string; role: string; isActive: boolean } | null | undefined;

export function isViewerLibrarian(user: ViewerUser): boolean {
  return !!user && user.isActive && (user.role === "LIBRARIAN" || user.role === "MASTER_LIBRARIAN");
}

export async function hasPrivateGrant(bookId: string, userId: string): Promise<boolean> {
  const grant = await prisma.bookPrivateAccess.findUnique({
    where: { bookId_userId: { bookId, userId } },
  });
  return !!grant;
}

// Prisma where-fragment for "books this viewer may see in a listing": the
// Catalog, related-books, and (later) Reading Paths/Collections all filter
// through this one place so a private or draft book can't leak into any of
// them by a filter being written slightly differently in each spot (spec
// §33's "must never leak through ... related recommendations ... reading
// paths ... collections"). DRAFT is intentionally never included here —
// drafts are librarian-dashboard-only, never mixed into a public-facing
// listing even for a librarian browsing the public site.
export function catalogVisibilityWhere(user: ViewerUser): Prisma.BookWhereInput {
  if (isViewerLibrarian(user)) {
    return { visibility: { in: ["PUBLIC", "PRIVATE"] } };
  }
  if (user) {
    return {
      OR: [
        { visibility: "PUBLIC" },
        { visibility: "PRIVATE", privateAccess: { some: { userId: user.id } } },
      ],
    };
  }
  return { visibility: "PUBLIC" };
}

// Single-book check for the Book Detail page. A grant lookup is needed for
// PRIVATE books, so unlike the listing filter above this is async.
export async function canViewBook(
  book: { id: string; visibility: string },
  user: ViewerUser
): Promise<boolean> {
  if (isViewerLibrarian(user)) return true;
  if (book.visibility === "PUBLIC") return true;
  if (book.visibility === "DRAFT") return false;
  if (!user) return false;
  return hasPrivateGrant(book.id, user.id);
}

// Reading Paths get their own parallel set rather than a shared generic
// helper — the two grant tables and Prisma where-input types differ, and
// with only two call sites a type-parameterized abstraction would cost more
// than the ~20 duplicated lines it would save.
export async function hasReadingPathPrivateGrant(readingPathId: string, userId: string): Promise<boolean> {
  const grant = await prisma.readingPathPrivateAccess.findUnique({
    where: { readingPathId_userId: { readingPathId, userId } },
  });
  return !!grant;
}

export function readingPathVisibilityWhere(user: ViewerUser): Prisma.ReadingPathWhereInput {
  if (isViewerLibrarian(user)) {
    return { visibility: { in: ["PUBLIC", "PRIVATE"] } };
  }
  if (user) {
    return {
      OR: [
        { visibility: "PUBLIC" },
        { visibility: "PRIVATE", privateAccess: { some: { userId: user.id } } },
      ],
    };
  }
  return { visibility: "PUBLIC" };
}

export async function canViewReadingPath(
  readingPath: { id: string; visibility: string },
  user: ViewerUser
): Promise<boolean> {
  if (isViewerLibrarian(user)) return true;
  if (readingPath.visibility === "PUBLIC") return true;
  if (readingPath.visibility === "DRAFT") return false;
  if (!user) return false;
  return hasReadingPathPrivateGrant(readingPath.id, user.id);
}

// Collections, same parallel-set rationale as Reading Paths.
export async function hasCollectionPrivateGrant(collectionId: string, userId: string): Promise<boolean> {
  const grant = await prisma.collectionPrivateAccess.findUnique({
    where: { collectionId_userId: { collectionId, userId } },
  });
  return !!grant;
}

export function collectionVisibilityWhere(user: ViewerUser): Prisma.CollectionWhereInput {
  if (isViewerLibrarian(user)) {
    return { visibility: { in: ["PUBLIC", "PRIVATE"] } };
  }
  if (user) {
    return {
      OR: [
        { visibility: "PUBLIC" },
        { visibility: "PRIVATE", privateAccess: { some: { userId: user.id } } },
      ],
    };
  }
  return { visibility: "PUBLIC" };
}

export async function canViewCollection(
  collection: { id: string; visibility: string },
  user: ViewerUser
): Promise<boolean> {
  if (isViewerLibrarian(user)) return true;
  if (collection.visibility === "PUBLIC") return true;
  if (collection.visibility === "DRAFT") return false;
  if (!user) return false;
  return hasCollectionPrivateGrant(collection.id, user.id);
}
