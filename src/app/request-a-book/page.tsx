import { RequestBookForm } from "@/components/RequestBookForm";

export const metadata = { title: "Request a Book — OrientalCodex" };

export default function RequestABookPage() {
  return (
    <main className="mx-auto max-w-xl flex-1 px-6 py-12">
      <h1 className="font-serif text-3xl text-foreground">Request a Book</h1>
      <p className="mt-2 text-sm text-muted">
        Let us know about a book you&apos;d like to see in OrientalCodex. Only the title is
        required — anything else you know helps our librarians track it down.
      </p>
      <div className="mt-8">
        <RequestBookForm />
      </div>
    </main>
  );
}
