import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LibrarianDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isMaster = session?.user.role === "MASTER_LIBRARIAN";

  const [
    bookCounts,
    pendingRequests,
    openIssueReports,
    accountCount,
    readingPathCount,
    collectionCount,
    recentActivity,
  ] = await Promise.all([
    prisma.book.groupBy({ by: ["visibility"], _count: true }),
    prisma.bookRequest.count({ where: { status: { in: ["NEW", "REVIEWING"] } } }),
    prisma.issueReport.count({ where: { status: { in: ["NEW", "REVIEWING"] } } }),
    prisma.user.count(),
    prisma.readingPath.count(),
    prisma.collection.count(),
    isMaster
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { actor: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
  ]);

  const bookTotal = bookCounts.reduce((sum, c) => sum + c._count, 0);

  const attention = [
    { label: "Pending book requests", value: pendingRequests, href: "/librarian/requests" },
    { label: "Open issue reports", value: openIssueReports, href: "/librarian/issue-reports" },
  ].filter((a) => a.value > 0);

  const overview = [
    { label: "Books", value: bookTotal, href: "/librarian/books" },
    { label: "Reading Paths", value: readingPathCount, href: "/librarian/reading-paths" },
    { label: "Collections", value: collectionCount, href: "/librarian/collections" },
    { label: "Accounts", value: accountCount, href: "/librarian/accounts" },
  ];

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Dashboard</h1>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Needs Attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing needs attention right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-b border-border">
            {attention.map((a) => (
              <li key={a.label}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between py-3 text-sm text-foreground hover:text-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {a.label}
                  <span className="font-serif text-lg text-navy">{a.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-foreground">The Library</h2>
        <ul className="mt-3">
          {overview.map((o) => (
            <li key={o.label}>
              <Link
                href={o.href}
                className="group flex items-baseline gap-3 py-2 text-sm text-foreground hover:text-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span>{o.label}</span>
                <span className="h-0 flex-1 border-b border-dotted border-border" />
                <span className="font-serif text-base text-navy group-hover:text-burgundy">{o.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {isMaster && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-foreground">Recent Activity</h2>
            <Link href="/librarian/audit-log" className="text-xs text-muted hover:text-burgundy">
              View full audit log →
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <tbody>
                {recentActivity.map((e) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="whitespace-nowrap py-2 pr-4 text-muted">
                      {e.createdAt.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-muted">{e.actor ? e.actor.name : "—"}</td>
                    <td className="py-2 pr-4 text-foreground">{e.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentActivity.length === 0 && (
              <p className="py-4 text-sm text-muted">No activity recorded yet.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
