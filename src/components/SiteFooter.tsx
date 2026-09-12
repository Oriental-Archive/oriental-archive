import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/Logo";

const linkGroups = [
  {
    heading: "Explore",
    links: [
      { href: "/catalog", label: "Catalog" },
      { href: "/reading-paths", label: "Reading Paths" },
      { href: "/collections", label: "Collections" },
      { href: "/highlights", label: "Highlights" },
    ],
  },
  {
    heading: "Library",
    links: [
      { href: "/request-a-book", label: "Request a Book" },
      { href: "/private", label: "Private Library" },
    ],
  },
];

// Institutional footer: brand + descriptor, navigation groups, and (where a
// librarian has enabled any) a quiet list of partner/sister-church links —
// distinct from the homepage's own <ChurchCommunionSection>, which carries
// the required full logo treatment separately, one section above this.
export async function SiteFooter() {
  const [churches, { general }] = await Promise.all([
    prisma.footerChurch.findMany({ where: { enabled: true }, orderBy: { displayOrder: "asc" } }),
    getSiteSettings(),
  ]);

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Logo size="footer" />
            <p className="mt-3 max-w-xs text-sm text-muted">
              A digital library for Oriental Orthodox literature — theology, liturgy, hagiography,
              and history, preserved for study.
            </p>
          </div>

          {linkGroups.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <p className="text-xs tracking-[0.1em] text-muted uppercase">{group.heading}</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-foreground hover:text-burgundy">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {churches.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-xs text-muted">
            {churches.map((c) =>
              c.websiteUrl ? (
                <li key={c.id}>
                  <a href={c.websiteUrl} className="hover:text-burgundy" target="_blank" rel="noreferrer">
                    {c.name}
                  </a>
                </li>
              ) : (
                <li key={c.id}>{c.name}</li>
              )
            )}
          </ul>
        )}

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Oriental Archive.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-burgundy">
              Privacy
            </Link>
            {general.contactEmail && (
              <a href={`mailto:${general.contactEmail}`} className="hover:text-burgundy">
                {general.contactEmail}
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
