import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readingPathVisibilityWhere, canViewBook } from "@/lib/visibility";
import { getSiteSettings } from "@/lib/site-settings";
import { Badge } from "@/components/ui/Badge";

export const metadata = { title: "Reading Paths — OrientalCodex" };

export default async function ReadingPathsPage() {
  const [session, { featured }] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getSiteSettings(),
  ]);

  const readingPaths = await prisma.readingPath.findMany({
    where: readingPathVisibilityWhere(session?.user),
    orderBy: { createdAt: "desc" },
    include: { steps: { select: { book: { select: { id: true, visibility: true } } } } },
  });

  // Featuring only ever reorders what the viewer could already see — a
  // featured id for a path that's since gone private/draft (or that this
  // viewer has no grant for) was already excluded by the where-clause above.
  readingPaths.sort((a, b) => {
    const aFeatured = featured.readingPathIds.includes(a.id);
    const bFeatured = featured.readingPathIds.includes(b.id);
    if (aFeatured === bFeatured) return 0;
    return aFeatured ? -1 : 1;
  });

  // The book count shown here must match what the detail page actually
  // reveals — counting every step regardless of visibility would let the
  // number itself hint that a private book is included (spec §13).
  const visibleCounts = await Promise.all(
    readingPaths.map(async (rp) => {
      let count = 0;
      for (const step of rp.steps) {
        if (await canViewBook(step.book, session?.user)) count++;
      }
      return count;
    })
  );

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <h1 className="font-serif text-3xl text-foreground">Reading Paths</h1>
      <p className="mt-2 text-sm text-muted">
        Curated, ordered introductions to a topic — a guided way through the library beyond
        browsing the shelf or searching the Catalog.
      </p>

      {readingPaths.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No reading paths published yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {readingPaths.map((rp, i) => (
            <Link
              key={rp.id}
              href={`/reading-paths/${rp.id}`}
              className="flex gap-4 rounded-sm border border-border bg-surface p-5 hover:border-gold"
            >
              {rp.coverImageStorageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/reading-paths/${rp.id}/cover`}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-sm border border-border object-cover"
                />
              )}
              <div className="min-w-0">
                {featured.readingPathIds.includes(rp.id) && <Badge variant="featured">Featured</Badge>}
                <h2 dir="auto" className="font-serif text-lg text-foreground">
                  {rp.title}
                </h2>
                {rp.topic && <p className="mt-1 text-xs text-muted">{rp.topic}</p>}
                {rp.description && (
                  <p dir="auto" className="mt-2 line-clamp-3 text-sm text-muted">
                    {rp.description}
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
