import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusTabs } from "@/components/ui/StatusTabs";

const STATUSES = ["NEW", "REVIEWING", "APPROVED", "ADDED", "DECLINED"] as const;

export default async function BookRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = STATUSES.includes(status as (typeof STATUSES)[number])
    ? (status as (typeof STATUSES)[number])
    : undefined;

  const requests = await prisma.bookRequest.findMany({
    where: activeStatus ? { status: activeStatus } : {},
    orderBy: { createdAt: "desc" },
    include: { requesterUser: { select: { name: true, email: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Book Requests</h1>

      <div className="mt-4">
        <StatusTabs
          tabs={[
            { label: "All", href: "/librarian/requests", active: !activeStatus },
            ...STATUSES.map((s) => ({
              label: s,
              href: `/librarian/requests?status=${s}`,
              active: activeStatus === s,
            })),
          ]}
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Requester</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2 pr-4">
                  <Link href={`/librarian/requests/${r.id}`} className="text-navy hover:text-burgundy">
                    {r.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted">
                  {r.requesterUser?.name ?? r.requesterName ?? "Anonymous"}
                </td>
                <td className="py-2 pr-4 text-muted">{r.status}</td>
                <td className="py-2 pr-4 text-muted">{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <p className="py-6 text-sm text-muted">No requests here.</p>}
      </div>
    </main>
  );
}
