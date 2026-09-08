import Link from "next/link";
import { SectionHeader } from "@/components/home/SectionHeader";

export type ReadingPathPreviewData = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  bookCount: number;
};

// Curated-scholarship presentation (spec: "avoid generic cards where every
// section is boxed") — a numbered editorial list rather than a card grid,
// so it reads differently from <CollectionsPreview> right below it.
export function ReadingPathsPreview({ paths }: { paths: ReadingPathPreviewData[] }) {
  if (paths.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader
        eyebrow="Guided study"
        title="Curated Reading Paths"
        intro="Ordered introductions to a topic, author, or controversy — a guided way through the library beyond browsing or searching."
        viewAllHref="/reading-paths"
      />
      <ol className="mt-8 flex flex-col divide-y divide-border border-b border-border">
        {paths.map((path, i) => (
          <li key={path.id}>
            <Link
              href={`/reading-paths/${path.id}`}
              className="group flex items-start gap-5 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span aria-hidden className="font-serif text-2xl text-gold/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <h3 dir="auto" className="font-serif text-lg text-foreground group-hover:text-burgundy">
                  {path.title}
                </h3>
                {path.topic && <p className="mt-0.5 text-xs text-muted">{path.topic}</p>}
                {path.description && (
                  <p dir="auto" className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted">
                    {path.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {path.bookCount} {path.bookCount === 1 ? "work" : "works"}
                </p>
              </div>
              <span aria-hidden className="mt-1 shrink-0 text-burgundy opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
