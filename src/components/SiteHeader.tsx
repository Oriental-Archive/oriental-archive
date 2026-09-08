import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isViewerLibrarian } from "@/lib/visibility";
import { SignOutButton } from "@/components/SignOutButton";
import { Logo } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/Button";

const navLinkClass = buttonVariants({ variant: "ghost", size: "inline", className: "px-1 py-1" });
const utilityLinkClass = buttonVariants({
  variant: "ghost",
  size: "inline",
  className: "px-1 py-1 text-xs text-muted hover:text-burgundy",
});

const primaryLinks = [
  { href: "/catalog", label: "Catalog" },
  { href: "/reading-paths", label: "Reading Paths" },
  { href: "/collections", label: "Collections" },
  { href: "/highlights", label: "Highlights" },
  { href: "/request-a-book", label: "Request a Book" },
];

// Sticky, compact, and split into two visual registers (spec: "the librarian
// area should feel like an authenticated utility, not part of the main
// public content navigation") — public sections in the primary row read as
// content navigation; Private/Librarian/Sign out sit apart, smaller and
// muted, as account-level utilities rather than more of the same list.
export async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() });
  const librarian = isViewerLibrarian(session?.user);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Logo size="header" />

        <nav className="hidden items-center gap-6 text-sm sm:flex" aria-label="Primary">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={navLinkClass}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 border-l border-border pl-5 sm:flex">
          {session && (
            <Link href="/private" className={utilityLinkClass}>
              Private
            </Link>
          )}
          {librarian && (
            <Link href="/librarian" className={utilityLinkClass}>
              Librarian
            </Link>
          )}
          {session ? (
            <SignOutButton />
          ) : (
            <Link href="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Login
            </Link>
          )}
        </div>

        {/* CSS-only toggle (no client JS) — checked state is driven purely
            by the hidden checkbox below via the `peer` selector. */}
        <label
          htmlFor="nav-toggle"
          aria-label="Menu"
          className="cursor-pointer text-2xl leading-none text-navy sm:hidden"
        >
          ☰
        </label>
      </div>

      <input type="checkbox" id="nav-toggle" className="peer hidden" />
      <nav
        aria-label="Primary"
        className="hidden flex-col items-start gap-1 border-t border-border px-6 py-4 text-sm peer-checked:flex sm:hidden"
      >
        {primaryLinks.map((l) => (
          <Link key={l.href} href={l.href} className={navLinkClass}>
            {l.label}
          </Link>
        ))}
        {session && (
          <Link href="/private" className={navLinkClass}>
            Private
          </Link>
        )}
        {librarian && (
          <Link href="/librarian" className={navLinkClass}>
            Librarian
          </Link>
        )}
        {session ? (
          <SignOutButton />
        ) : (
          <Link href="/login" className={navLinkClass}>
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}
