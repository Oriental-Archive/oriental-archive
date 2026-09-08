import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Singled out from the rest of the librarian area (spec: "The Master
// Librarian should be able to review audit history") — a librarian
// auditing their own peers' actions is a conflict, so this stays with the
// one account whose role can never be granted to anyone else.
export default async function AuditLogPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user.role !== "MASTER_LIBRARIAN") {
    redirect("/librarian");
  }

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Audit Log</h1>
      <p className="mt-1 text-sm text-muted">Most recent 200 administrative actions.</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Actor</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Target</th>
              <th className="py-2 pr-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/60 align-top">
                <td className="whitespace-nowrap py-2 pr-4 text-muted">{e.createdAt.toLocaleString()}</td>
                <td className="py-2 pr-4 text-muted">{e.actor ? `${e.actor.name} (${e.actor.email})` : "—"}</td>
                <td className="py-2 pr-4 text-foreground">{e.action}</td>
                <td className="py-2 pr-4 text-muted">
                  {e.targetType ? `${e.targetType}:${e.targetId}` : "—"}
                </td>
                <td className="max-w-xs truncate py-2 pr-4 text-muted" title={JSON.stringify(e.metadata)}>
                  {e.metadata ? JSON.stringify(e.metadata) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="py-6 text-sm text-muted">No activity recorded yet.</p>}
      </div>
    </main>
  );
}
