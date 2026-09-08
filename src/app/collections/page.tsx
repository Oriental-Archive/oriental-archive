import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { collectionVisibilityWhere, canViewBook } from "@/lib/visibility";

export const metadata = { title: "Collections — OrientalCodex" };

export default async function CollectionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const collections = await prisma.collection.findMany({
    where: collectionVisibilityWhere(session?.user),
    orderBy: { createdAt: "desc" },
    include: { books: { select: { book: { select: { id: true, visibility: true } } } } },
  });

  // Same reasoning as the Reading Paths list: the shown count must match
  // what the detail page will actually reveal (spec §33).
  const visibleCounts = await Promise.all(
    collections.map(async (c) => {
      let count = 0;
      for (const { book } of c.books) {
        if (await canViewBook(book, session?.user)) count++;
      }
      return count;
    })
  );

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <h1 className="font-serif text-3xl text-foreground">Collections</h1>
      <p className="mt-2 text-sm text-muted">
        Groups of related books, gathered by topic, author, or church father — without a
        required order.
      </p>

      {collections.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No collections published yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {collections.map((c, i) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="flex gap-4 rounded-sm border border-border bg-surface p-5 hover:border-gold"
            >
              {c.coverImageStorageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/collections/${c.id}/cover`}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-sm border border-border object-cover"
                />
              )}
              <div className="min-w-0">
                <h2 dir="auto" className="font-serif text-lg text-foreground">
                  {c.title}
                </h2>
                {c.description && (
                  <p dir="auto" className="mt-2 line-clamp-3 text-sm text-muted">
                    {c.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  {visibleCounts[i]} {visibleCounts[i] === 1 ? "book" : "books"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
