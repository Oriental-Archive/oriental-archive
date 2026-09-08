import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewCollection, canViewBook } from "@/lib/visibility";
import { BookCard } from "@/components/BookCard";
import { buttonVariants } from "@/components/ui/Button";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      books: {
        orderBy: { order: "asc" },
        include: { book: { include: { language: true, churchTradition: true } } },
      },
    },
  });

  if (!collection || !(await canViewCollection(collection, session?.user))) {
    notFound();
  }

  // A book the viewer can't see is dropped entirely, same rule as Reading
  // Path steps (spec §33) — no placeholder, no gap to notice.
  const visibleBooks = [];
  for (const entry of collection.books) {
    if (await canViewBook(entry.book, session?.user)) visibleBooks.push(entry.book);
  }

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
      <Link href="/collections" className={buttonVariants({ variant: "ghost" })}>
        ← All collections
      </Link>
      {collection.coverImageStorageKey && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/collections/${collection.id}/cover`}
          alt=""
          className="mt-4 aspect-[3/1] w-full rounded-sm border border-border object-cover"
        />
      )}
      <h1 dir="auto" className="mt-4 font-serif text-3xl text-foreground">
        {collection.title}
      </h1>
      {collection.description && (
        <p dir="auto" className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground">
          {collection.description}
        </p>
      )}

      {visibleBooks.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No books in this collection yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visibleBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}
