import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AccountManageForm } from "@/components/librarian/AccountManageForm";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.user.findUnique({ where: { id } });
  if (!account) notFound();

  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-10">
      <Link href="/librarian/accounts" className="text-sm text-muted hover:text-burgundy">
        ← All accounts
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-foreground">{account.name}</h1>
      <p className="text-sm text-muted">{account.email}</p>

      <div className="mt-6">
        {account.role === "MASTER_LIBRARIAN" ? (
          <p className="rounded-sm border border-gold bg-surface p-4 text-sm text-navy">
            This is the Master Librarian account. Its role cannot be changed and it cannot be
            disabled — this is enforced at the database level, not just in this interface.
          </p>
        ) : (
          <AccountManageForm
            accountId={account.id}
            initialRole={account.role as "STANDARD" | "LIBRARIAN"}
            initialActive={account.isActive}
          />
        )}
      </div>
    </main>
  );
}
