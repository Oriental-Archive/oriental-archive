import Link from "next/link";
import { CreateCollectionForm } from "@/components/librarian/CreateCollectionForm";

export default function NewCollectionPage() {
  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-10">
      <Link href="/librarian/collections" className="text-sm text-muted hover:text-burgundy">
        ← All collections
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-foreground">New Collection</h1>
      <p className="mt-1 text-sm text-muted">
        Starts as a draft. Add books and publish it from the next page.
      </p>
      <div className="mt-6">
        <CreateCollectionForm />
      </div>
    </main>
  );
}
