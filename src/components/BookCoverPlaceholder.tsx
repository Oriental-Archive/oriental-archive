// Shown in place of a cover image wherever a book has none yet (BookCard,
// the bookshelf carousel, and the book detail page) — an intentionally
// typeset title page rather than a broken-image-looking gray box, since most
// of the library's covers are placeholders today and this is what visitors
// actually see most often.
const RULE_VARIANTS = ["bg-navy/30", "bg-burgundy/30", "bg-gold/50"] as const;

// Deterministic on title so the same book always renders the same variant
// (no layout shift / flicker on re-render) while still giving a shelf of
// placeholders some visual variety instead of one flat repeated tile.
function variantFor(title: string): (typeof RULE_VARIANTS)[number] {
  let sum = 0;
  for (let i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  return RULE_VARIANTS[sum % RULE_VARIANTS.length];
}

export function BookCoverPlaceholder({
  title,
  author,
  tradition,
}: {
  title: string;
  author?: string | null;
  tradition?: string | null;
}) {
  const rule = variantFor(title);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 border border-border/60 bg-surface px-4 py-6 text-center">
      <span aria-hidden className={`h-px w-8 ${rule}`} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5">
        <p dir="auto" className="line-clamp-5 font-serif text-sm leading-snug text-navy">
          {title}
        </p>
        {author && (
          <p dir="auto" className="line-clamp-1 text-[11px] text-muted italic">
            {author}
          </p>
        )}
      </div>
      {tradition && (
        <p className="truncate text-[10px] tracking-[0.08em] text-muted/80 uppercase">{tradition}</p>
      )}
      <span aria-hidden className={`h-px w-8 ${rule}`} />
    </div>
  );
}
