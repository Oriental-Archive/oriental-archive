import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusTabs } from "@/components/ui/StatusTabs";

const STATUSES = ["NEW", "REVIEWING", "RESOLVED", "DISMISSED"] as const;

export default async function IssueReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = STATUSES.includes(status as (typeof STATUSES)[number])
    ? (status as (typeof STATUSES)[number])
    : undefined;

  const reports = await prisma.issueReport.findMany({
    where: activeStatus ? { status: activeStatus } : {},
    orderBy: { createdAt: "desc" },
    include: { book: { select: { id: true, title: true } }, reporterUser: { select: { name: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Issue Reports</h1>
      <p className="mt-1 text-sm text-muted">Problems readers have flagged on individual books.</p>

      <div className="mt-4">
        <StatusTabs
          tabs={[
            { label: "All", href: "/librarian/issue-reports", active: !activeStatus },
            ...STATUSES.map((s) => ({
              label: s,
              href: `/librarian/issue-reports?status=${s}`,
              active: activeStatus === s,
            })),
          ]}
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4">Book</th>
              <th className="py-2 pr-4">Reason</th>
              <th className="py-2 pr-4">Reporter</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td dir="auto" className="py-2 pr-4">
                  <Link href={`/librarian/issue-reports/${r.id}`} className="text-navy hover:text-burgundy">
                    {r.book.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted">{r.reason}</td>
                <td className="py-2 pr-4 text-muted">{r.reporterUser?.name ?? "Anonymous"}</td>
                <td className="py-2 pr-4 text-muted">{r.status}</td>
                <td className="py-2 pr-4 text-muted">{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length === 0 && <p className="py-6 text-sm text-muted">No issue reports here.</p>}
      </div>
    </main>
  );
}
