import Link from "next/link";
import { SectionHeader } from "@/components/home/SectionHeader";

export type ExploreTerm = { id: string; label: string; count: number };

// "Browse by Category" — a restrained rule-separated list, not a wall of
// pill buttons. Only shows categories that actually have public books
// (spec: "ONLY display categories actually supported by the data").
export function ExploreLibrary({ categories }: { categories: ExploreTerm[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader eyebrow="Browse" title="Explore the Library" />
      <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id} className="border-b border-border">
            <Link
              href={`/catalog?category=${c.id}`}
              className="group flex items-baseline justify-between gap-2 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span className="text-foreground group-hover:text-burgundy">{c.label}</span>
              <span className="text-xs text-muted">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
