import Link from "next/link";
import { SectionHeader } from "@/components/home/SectionHeader";

export type CollectionPreviewData = {
  id: string;
  title: string;
  description: string | null;
  bookCount: number;
};

// Visually distinct from <ReadingPathsPreview> (spec: "make Collections
// visually distinct from Reading Paths") — a flat column grid of bordered
// panels rather than a numbered list.
export function CollectionsPreview({ collections }: { collections: CollectionPreviewData[] }) {
  if (collections.length === 0) return null;

  return (
    <section className="bg-surface-muted">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="By theme"
          title="Collections"
          intro="Groups of related works — by church father, controversy, or era — gathered without a required order."
          viewAllHref="/collections"
        />
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="group flex flex-col gap-2 bg-surface p-6 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
            >
              <h3 dir="auto" className="font-serif text-lg text-foreground group-hover:text-burgundy">
                {c.title}
              </h3>
              {c.description && (
                <p dir="auto" className="line-clamp-3 text-sm text-muted">
                  {c.description}
                </p>
              )}
              <p className="mt-auto pt-2 text-xs text-muted">
                {c.bookCount} {c.bookCount === 1 ? "book" : "books"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
