import { prisma } from "@/lib/prisma";
import { getBookshelfPage, BOOKSHELF_PAGE_SIZE, type BookshelfBook } from "@/lib/bookshelf";
import { getSiteSettings } from "@/lib/site-settings";
import { Hero } from "@/components/home/Hero";
import { FeaturedBooks } from "@/components/home/FeaturedBooks";
import { ExploreLibrary, type ExploreTerm } from "@/components/home/ExploreLibrary";
import { ReadingPathsPreview, type ReadingPathPreviewData } from "@/components/home/ReadingPathsPreview";
import { CollectionsPreview, type CollectionPreviewData } from "@/components/home/CollectionsPreview";
import { ChurchCommunionSection } from "@/components/ChurchCommunionSection";
import { RequestBookCTA } from "@/components/home/RequestBookCTA";

const BOOKSHELF_SELECT = {
  id: true,
  title: true,
  author: true,
  coverImageStorageKey: true,
  language: { select: { label: true } },
  churchTradition: { select: { label: true } },
} as const;

async function getExploreCategories(): Promise<ExploreTerm[]> {
  const grouped = await prisma.book.groupBy({
    by: ["categoryId"],
    where: { visibility: "PUBLIC", categoryId: { not: null } },
    _count: { categoryId: true },
    orderBy: { _count: { categoryId: "desc" } },
    take: 9,
  });
  if (grouped.length === 0) return [];

  const terms = await prisma.controlledTerm.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId as string) } },
    select: { id: true, label: true },
  });
  const labelById = new Map(terms.map((t) => [t.id, t.label]));

  return grouped
    .map((g) => ({ id: g.categoryId as string, label: labelById.get(g.categoryId as string) ?? "", count: g._count.categoryId }))
    .filter((c) => c.label)
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function getReadingPathPreviews(featuredIds: string[]): Promise<ReadingPathPreviewData[]> {
  const paths = await prisma.readingPath.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    include: { steps: { select: { book: { select: { visibility: true } } } } },
    take: 12,
  });
  paths.sort((a, b) => Number(featuredIds.includes(b.id)) - Number(featuredIds.includes(a.id)));

  // Homepage preview only: a conservative PUBLIC-only count (never the
  // fuller canViewBook grant check the /reading-paths listing uses) so an
  // anonymous visitor's preview count can never hint at a private book.
  return paths.slice(0, 3).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    topic: p.topic,
    bookCount: p.steps.filter((s) => s.book.visibility === "PUBLIC").length,
  }));
}

async function getCollectionPreviews(): Promise<CollectionPreviewData[]> {
  const collections = await prisma.collection.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    include: { books: { select: { book: { select: { visibility: true } } } } },
    take: 3,
  });

  return collections.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    bookCount: c.books.filter((b) => b.book.visibility === "PUBLIC").length,
  }));
}

export default async function Home() {
  const { featured } = await getSiteSettings();

  // Featured books lead the shelf; the rest of the initial batch (and
  // everything the carousel lazy-loads after) follows the normal recency
  // order from getBookshelfPage — only this first server-rendered batch
  // gets the featured-first treatment.
  const featuredBooks: BookshelfBook[] = featured.bookIds.length
    ? await prisma.book.findMany({
        where: { id: { in: featured.bookIds }, visibility: "PUBLIC" },
        select: BOOKSHELF_SELECT,
      })
    : [];
  featuredBooks.sort((a, b) => featured.bookIds.indexOf(a.id) - featured.bookIds.indexOf(b.id));

  const [rest, exploreCategories, readingPaths, collections] = await Promise.all([
    getBookshelfPage({}),
    getExploreCategories(),
    getReadingPathPreviews(featured.readingPathIds),
    getCollectionPreviews(),
  ]);

  const featuredIds = new Set(featuredBooks.map((b) => b.id));
  const books = [...featuredBooks, ...rest.books.filter((b) => !featuredIds.has(b.id))].slice(
    0,
    Math.max(BOOKSHELF_PAGE_SIZE, featuredBooks.length)
  );

  return (
    <main className="flex flex-1 flex-col">
      <Hero books={books} />

      {books.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted">
          The library is just getting started — check back soon.
        </p>
      ) : (
        <FeaturedBooks books={books} nextCursor={rest.nextCursor} />
      )}

      <ExploreLibrary categories={exploreCategories} />
      <ReadingPathsPreview paths={readingPaths} />
      <CollectionsPreview collections={collections} />
      <ChurchCommunionSection />
      <RequestBookCTA />
    </main>
  );
}
