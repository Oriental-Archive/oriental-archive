import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewReadingPath, canViewBook } from "@/lib/visibility";
import { buttonVariants } from "@/components/ui/Button";

export default async function ReadingPathDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const readingPath = await prisma.readingPath.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: { book: { include: { language: true, churchTradition: true } } },
      },
    },
  });

  if (!readingPath || !(await canViewReadingPath(readingPath, session?.user))) {
    notFound();
  }

  // A step whose book the viewer can't see is dropped entirely — not shown
  // as a placeholder — and the remaining steps are renumbered from the
  // filtered list, so a gap in the numbering never hints that a private
  // book was skipped (spec §13: a public path must never reveal that a
  // private book exists).
  const visibleSteps = [];
  for (const step of readingPath.steps) {
    if (await canViewBook(step.book, session?.user)) visibleSteps.push(step);
  }

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <Link href="/reading-paths" className={buttonVariants({ variant: "ghost" })}>
        ← All reading paths
      </Link>
      {readingPath.coverImageStorageKey && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/reading-paths/${readingPath.id}/cover`}
          alt=""
          className="mt-4 aspect-[3/1] w-full rounded-sm border border-border object-cover"
        />
      )}
      <h1 dir="auto" className="mt-4 font-serif text-3xl text-foreground">
        {readingPath.title}
      </h1>
      {readingPath.topic && <p className="mt-1 text-xs text-muted">{readingPath.topic}</p>}
      {readingPath.description && (
        <p dir="auto" className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground">
          {readingPath.description}
        </p>
      )}

      <ol className="mt-10 flex flex-col gap-6">
        {visibleSteps.map((step, i) => (
          <li key={step.id} className="flex gap-4 border-b border-border pb-6">
            <span className="font-serif text-2xl text-gold">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/books/${step.book.id}`} className="font-serif text-lg text-navy hover:text-burgundy">
                <span dir="auto">{step.book.title}</span>
              </Link>
              <p className="text-xs text-muted">
                {step.book.language.label} · {step.book.churchTradition.label}
              </p>
              {step.explanation && (
                <p dir="auto" className="mt-2 text-sm text-foreground">
                  {step.explanation}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {visibleSteps.length === 0 && <p className="mt-10 text-sm text-muted">No books in this path yet.</p>}
    </main>
  );
}
