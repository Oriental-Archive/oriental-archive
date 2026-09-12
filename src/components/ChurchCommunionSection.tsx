import { ORIENTAL_ORTHODOX_CHURCHES, findChurchLogo } from "@/lib/communion";

// Required, permanent homepage section (not admin-editable — see
// lib/communion.ts) acknowledging the six sister churches of the Oriental
// Orthodox communion. Kept visually separate from <SiteFooter>, one section
// above it, rather than folded into the footer as a row of tiny icons.
export function ChurchCommunionSection() {
  return (
    <section className="border-t border-border-strong bg-surface-muted">
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="text-xs tracking-[0.14em] text-muted uppercase">The Oriental Orthodox Communion</p>
        <h2 className="mt-3 font-serif text-2xl text-foreground sm:text-3xl">
          Across the Oriental Orthodox Communion
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">
          Oriental Archive gathers and preserves literature from across the Oriental Orthodox family —
          six churches, sharing one apostolic tradition since before Chalcedon.
        </p>

        <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
          {ORIENTAL_ORTHODOX_CHURCHES.map((church) => (
            <li key={church.slug}>
              <ChurchMark slug={church.slug} name={church.name} monogram={church.monogram} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ChurchMark({ slug, name, monogram }: { slug: string; name: string; monogram: string }) {
  const logoSrc = findChurchLogo(slug);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-20 w-20 items-center justify-center border border-border bg-background p-3 transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
        {logoSrc ? (
          // Church emblems are official marks supplied as static files, not
          // user content — object-fit:contain preserves their aspect ratio
          // exactly, never stretched or cropped.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`${name} emblem`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span aria-hidden className="font-serif text-2xl text-navy/50">
            {monogram}
          </span>
        )}
      </div>
      <p className="max-w-[9rem] text-xs leading-snug text-muted">{name}</p>
    </div>
  );
}
