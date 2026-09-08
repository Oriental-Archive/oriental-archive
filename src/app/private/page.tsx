import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewBook } from "@/lib/visibility";
import { BookCard } from "@/components/BookCard";

export const metadata = { title: "Private — OrientalCodex" };

// Only privately-*granted* items belong here — anything PUBLIC already shows
// up in the normal Catalog/Reading Paths/Collections listings, so surfacing
// it again here would be redundant rather than helpful.
export default async function PrivatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;
  const [bookGrants, pathGrants, collectionGrants] = await Promise.all([
    prisma.bookPrivateAccess.findMany({
      where: { userId, book: { visibility: "PRIVATE" } },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            coverImageStorageKey: true,
            language: { select: { label: true } },
            churchTradition: { select: { label: true } },
          },
        },
      },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.readingPathPrivateAccess.findMany({
      where: { userId, readingPath: { visibility: "PRIVATE" } },
      include: {
        readingPath: {
          select: {
            id: true,
            title: true,
            topic: true,
            description: true,
            steps: { select: { book: { select: { id: true, visibility: true } } } },
          },
        },
      },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.collectionPrivateAccess.findMany({
      where: { userId, collection: { visibility: "PRIVATE" } },
      include: {
        collection: {
          select: {
            id: true,
            title: true,
            description: true,
            books: { select: { book: { select: { id: true, visibility: true } } } },
          },
        },
      },
      orderBy: { grantedAt: "desc" },
    }),
  ]);

  // Same rule as the public listings (spec §33): the step/book count shown
  // must match what the detail page will actually reveal, since this viewer's
  // grant on the path/collection itself doesn't imply a grant on every book
  // it references.
  const pathCounts = await Promise.all(
    pathGrants.map(async (g) => {
      let count = 0;
      for (const step of g.readingPath.steps) {
        if (await canViewBook(step.book, session.user)) count++;
      }
      return count;
    })
  );
  const collectionCounts = await Promise.all(
    collectionGrants.map(async (g) => {
      let count = 0;
      for (const { book } of g.collection.books) {
        if (await canViewBook(book, session.user)) count++;
      }
      return count;
    })
  );

  const hasNothing = bookGrants.length === 0 && pathGrants.length === 0 && collectionGrants.length === 0;

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <h1 className="font-serif text-3xl text-foreground">Private</h1>
      <p className="mt-2 text-sm text-muted">
        Books, reading paths, and collections that a librarian has shared with your account.
      </p>

      {hasNothing && (
        <p className="mt-10 text-sm text-muted">Nothing has been privately shared with you yet.</p>
      )}

      {bookGrants.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-lg text-foreground">Books</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {bookGrants.map((g) => (
              <BookCard key={g.book.id} book={g.book} />
            ))}
          </div>
        </section>
      )}

      {pathGrants.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-lg text-foreground">Reading Paths</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {pathGrants.map((g, i) => (
              <Link
                key={g.readingPath.id}
                href={`/reading-paths/${g.readingPath.id}`}
                className="block rounded-sm border border-border bg-surface p-5 hover:border-gold"
              >
                <h3 dir="auto" className="font-serif text-lg text-foreground">
                  {g.readingPath.title}
                </h3>
                {g.readingPath.topic && (
                  <p className="mt-1 text-xs text-muted">{g.readingPath.topic}</p>
                )}
                {g.readingPath.description && (
                  <p dir="auto" className="mt-2 line-clamp-3 text-sm text-muted">
                    {g.readingPath.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  {pathCounts[i]} {pathCounts[i] === 1 ? "book" : "books"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {collectionGrants.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-lg text-foreground">Collections</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {collectionGrants.map((g, i) => (
              <Link
                key={g.collection.id}
                href={`/collections/${g.collection.id}`}
                className="block rounded-sm border border-border bg-surface p-5 hover:border-gold"
              >
                <h3 dir="auto" className="font-serif text-lg text-foreground">
                  {g.collection.title}
                </h3>
                {g.collection.description && (
                  <p dir="auto" className="mt-2 line-clamp-3 text-sm text-muted">
                    {g.collection.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  {collectionCounts[i]} {collectionCounts[i] === 1 ? "book" : "books"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
