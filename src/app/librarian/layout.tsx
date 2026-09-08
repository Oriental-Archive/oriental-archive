import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isViewerLibrarian } from "@/lib/visibility";
import { buttonVariants } from "@/components/ui/Button";

const navLinkClass = buttonVariants({ variant: "ghost" });

export default async function LibrarianLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  // Authorization is enforced here, server-side, on every request to this
  // layout (spec §31) — not by hiding the "Librarian" nav link from a
  // Standard account, which would be UI-only and not actual security.
  if (!isViewerLibrarian(session.user)) {
    return (
      <main className="mx-auto max-w-md flex-1 px-6 py-16 text-center">
        <p className="text-sm text-muted">
          This area is restricted to librarians. Your account doesn&apos;t have access.
        </p>
      </main>
    );
  }

  const isMaster = session.user.role === "MASTER_LIBRARIAN";

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface">
        <nav className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-6 py-3 text-sm whitespace-nowrap">
          <Link href="/librarian" className={navLinkClass}>
            Dashboard
          </Link>
          <Link href="/librarian/books" className={navLinkClass}>
            Books
          </Link>
          <Link href="/librarian/vocabulary" className={navLinkClass}>
            Vocabulary
          </Link>
          <Link href="/librarian/reading-paths" className={navLinkClass}>
            Reading Paths
          </Link>
          <Link href="/librarian/collections" className={navLinkClass}>
            Collections
          </Link>
          <Link href="/librarian/requests" className={navLinkClass}>
            Book Requests
          </Link>
          <Link href="/librarian/issue-reports" className={navLinkClass}>
            Issue Reports
          </Link>
          <Link href="/librarian/accounts" className={navLinkClass}>
            Accounts
          </Link>
          <Link href="/librarian/site-settings" className={navLinkClass}>
            Site Settings
          </Link>
          {/* Spec: "The Master Librarian should be able to review audit
              history" — singled out from the general librarian sections, so
              this one is Master Librarian only rather than all librarians. */}
          {isMaster && (
            <Link href="/librarian/audit-log" className={navLinkClass}>
              Audit Log
            </Link>
          )}
        </nav>
      </div>
      {children}
    </div>
  );
}
