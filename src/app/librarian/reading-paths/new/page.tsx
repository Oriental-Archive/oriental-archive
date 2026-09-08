import Link from "next/link";
import { CreateReadingPathForm } from "@/components/librarian/CreateReadingPathForm";

export default function NewReadingPathPage() {
  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-10">
      <Link href="/librarian/reading-paths" className="text-sm text-muted hover:text-burgundy">
        ← All reading paths
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-foreground">New Reading Path</h1>
      <p className="mt-1 text-sm text-muted">
        Starts as a draft. Add books and publish it from the next page.
      </p>
      <div className="mt-6">
        <CreateReadingPathForm />
      </div>
    </main>
  );
}
