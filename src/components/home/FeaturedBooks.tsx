import { SectionHeader } from "@/components/home/SectionHeader";
import { Bookshelf } from "@/components/bookshelf/Bookshelf";
import type { BookshelfBook } from "@/lib/bookshelf";

export function FeaturedBooks({
  books,
  nextCursor,
}: {
  books: BookshelfBook[];
  nextCursor: string | null;
}) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="From the shelf" title="Featured & Recent Works" viewAllHref="/catalog" />
      </div>
      <div className="mt-6">
        <Bookshelf initialBooks={books} initialCursor={nextCursor} />
      </div>
    </section>
  );
}
