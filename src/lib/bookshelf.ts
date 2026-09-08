import { prisma } from "@/lib/prisma";

export const BOOKSHELF_PAGE_SIZE = 20;

export type BookshelfBook = {
  id: string;
  title: string;
  author: string | null;
  coverImageStorageKey: string | null;
  language: { label: string };
  churchTradition: { label: string };
};

export type BookshelfPage = {
  books: BookshelfBook[];
  nextCursor: string | null;
};

// Backs both the homepage's initial server-rendered batch and the
// /api/bookshelf endpoint the carousel calls as the visitor scrolls — one
// query, so pagination/ordering can't drift between the two (spec §46: never
// send the whole library to the browser at once). Public only: the shelf is
// a discovery surface on the homepage, not a place private books surface.
export async function getBookshelfPage(params: { cursor?: string | null }): Promise<BookshelfPage> {
  const books = await prisma.book.findMany({
    where: { visibility: "PUBLIC" },
    select: {
      id: true,
      title: true,
      author: true,
      coverImageStorageKey: true,
      language: { select: { label: true } },
      churchTradition: { select: { label: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: BOOKSHELF_PAGE_SIZE,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  return {
    books,
    nextCursor: books.length === BOOKSHELF_PAGE_SIZE ? books[books.length - 1].id : null,
  };
}
