import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export function RequestBookCTA() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-14 text-center">
        <h2 className="font-serif text-2xl text-foreground">Can&apos;t find a text?</h2>
        <p className="max-w-md text-sm text-muted">
          Request a work and it will be sent to our librarians for review and, where possible,
          added to the library.
        </p>
        <Link href="/request-a-book" className={buttonVariants({ variant: "secondary" })}>
          Request a Book
        </Link>
      </div>
    </section>
  );
}
