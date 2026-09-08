// Plain GET form straight to the Catalog's own `q` param (see
// app/catalog/page.tsx) — no client JS, no duplicated search logic. This is
// the homepage's primary action, so it needs to look like one: large,
// unmissable, ahead of any marketing copy below it.
export function HeroSearch() {
  return (
    <form method="get" action="/catalog" className="flex max-w-md gap-2">
      <label htmlFor="hero-search" className="sr-only">
        Search the catalog
      </label>
      <input
        id="hero-search"
        type="text"
        name="q"
        placeholder="Search titles, authors, translators…"
        className="w-full border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      />
      <button
        type="submit"
        className="shrink-0 bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Search
      </button>
    </form>
  );
}
