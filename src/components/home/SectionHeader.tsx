import Link from "next/link";

// Shared section-intro pattern for the homepage — eyebrow, heading, optional
// short intro, optional "view all" link — so hierarchy comes from
// typography/spacing/rules rather than every section being boxed in its own
// card.
export function SectionHeader({
  eyebrow,
  title,
  intro,
  viewAllHref,
  viewAllLabel = "View all",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        {eyebrow && <p className="text-xs tracking-[0.14em] text-muted uppercase">{eyebrow}</p>}
        <h2 className="mt-1.5 font-serif text-2xl text-foreground sm:text-3xl">{title}</h2>
        {intro && <p className="mt-2 max-w-xl text-sm text-muted">{intro}</p>}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="shrink-0 border-b border-burgundy/40 pb-0.5 text-sm text-burgundy hover:border-burgundy"
        >
          {viewAllLabel} →
        </Link>
      )}
    </div>
  );
}
