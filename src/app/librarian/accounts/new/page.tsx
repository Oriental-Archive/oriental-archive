import Link from "next/link";
import { CreateAccountForm } from "@/components/librarian/CreateAccountForm";

export default function NewAccountPage() {
  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-10">
      <Link href="/librarian/accounts" className="text-sm text-muted hover:text-burgundy">
        ← All accounts
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-foreground">Create Account</h1>
      <p className="mt-1 text-sm text-muted">
        There is no public registration — accounts are created here only. There is no option to
        create another Master Librarian.
      </p>
      <div className="mt-6">
        <CreateAccountForm />
      </div>
    </main>
  );
}
