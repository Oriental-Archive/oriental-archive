import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/Button";

export default async function AccountsPage() {
  const accounts = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Accounts</h1>
        <Link href="/librarian/accounts/new" className={buttonVariants({ size: "sm" })}>
          Create Account
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-2 pr-4">
                  <Link href={`/librarian/accounts/${a.id}`} className="text-navy hover:text-burgundy">
                    {a.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted">{a.email}</td>
                <td className="py-2 pr-4 text-muted">{a.role}</td>
                <td className="py-2 pr-4 text-muted">{a.isActive ? "Active" : "Disabled"}</td>
                <td className="py-2 pr-4 text-muted">{a.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
