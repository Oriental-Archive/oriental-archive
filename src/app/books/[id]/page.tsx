import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewBook, catalogVisibilityWhere, isViewerLibrarian } from "@/lib/visibility";
import { BookCard } from "@/components/BookCard";
import { BookCoverPlaceholder } from "@/components/BookCoverPlaceholder";
import { ReportIssueForm } from "@/components/ReportIssueForm";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";

const RELATED_LIMIT = 6;

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      language: true,
      churchTradition: true,
      category: true,
      documentType: true,
      rightsStatus: true,
      topics: true,
      churchFathers: true,
      relatedTo: { include: { toBook: { include: { language: true, churchTradition: true } } } },
    },
  });

  // A private book you can't see returns the same not-found page as one
  // that doesn't exist (spec §19/§33) — never a distinct "forbidden" state
  // that would confirm a private book's id is real.
  if (!book || !(await canViewBook(book, session?.user))) {
    notFound();
  }

  const librarian = isViewerLibrarian(session?.user);
  const canRead = librarian || book.allowOnlineReading;
  // Unlike Read — which routes through /books/[id]/read, a real page that
  // can explain "no document uploaded yet" — Download has no such landing
  // page of its own: it's a bare link straight at the file endpoint, so
  // there's no way to make clicking it a good experience when there's
  // nothing to download. Hiding it here, rather than letting it 404, is
  // the fix (previously this only checked the permission flag, never
  // whether a file actually existed).
  const canDownload = (librarian || book.allowDownload) && !!book.activeVersionId;

  const manualRelated = book.relatedTo.map((r) => r.toBook);
  let related = manualRelated;
  if (related.length < RELATED_LIMIT && book.topics.length > 0) {
    const more = await prisma.book.findMany({
      where: {
        AND: [
          catalogVisibilityWhere(session?.user),
          { id: { notIn: [book.id, ...related.map((b) => b.id)] } },
          { topics: { some: { id: { in: book.topics.map((t) => t.id) } } } },
        ],
      },
      include: { language: true, churchTradition: true },
      take: RELATED_LIMIT - related.length,
    });
    related = [...related, ...more];
  }

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[220px_1fr]">
        <div className="aspect-[2/3] w-full max-w-[220px] overflow-hidden rounded-sm border border-border bg-surface shadow-sm">
          {book.coverImageStorageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/books/${book.id}/file?type=cover&mode=read`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <BookCoverPlaceholder title={book.title} />
          )}
        </div>

        <div>
          {book.originalTitle && (
            <p dir="auto" className="text-sm text-muted">
              {book.originalTitle}
            </p>
          )}
          <h1 dir="auto" className="font-serif text-3xl text-foreground">
            {book.title}
          </h1>
          {book.alternateTitle && (
            <p dir="auto" className="mt-1 text-sm text-muted">
              also known as {book.alternateTitle}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {book.author && <Field label="Author" value={book.author} />}
            {book.translator && <Field label="Translator" value={book.translator} />}
            {book.editor && <Field label="Editor" value={book.editor} />}
            {book.publisher && <Field label="Publisher" value={book.publisher} />}
            {book.publicationYear && <Field label="Published" value={String(book.publicationYear)} />}
            <Field label="Language" value={book.language.label} />
            <Field label="Church Tradition" value={book.churchTradition.label} />
            {book.category && <Field label="Category" value={book.category.label} />}
            <Field label="Document Type" value={book.documentType.label} />
            {book.rightsStatus && <Field label="Rights" value={book.rightsStatus.label} />}
            {book.pageCount && <Field label="Pages" value={String(book.pageCount)} />}
            {book.provenance && <Field label="Provenance" value={book.provenance} />}
          </dl>

          {book.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {book.topics.map((t) => (
                <Badge key={t.id} variant="gold">
                  {t.label}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {canRead && (
              // The in-browser reader (highlights, bookmarks, search) lives
              // at /books/[id]/read — this used to link straight at the raw
              // file endpoint instead, which bypassed that reader entirely
              // and, for a book with no file yet, surfaced the endpoint's
              // raw {"error":"Not found"} JSON rather than any real page.
              <Link href={`/books/${book.id}/read`} className={buttonVariants({ variant: "primary" })}>
                Read
              </Link>
            )}
            {canDownload && (
              <a
                href={`/api/books/${book.id}/file?type=document&mode=download`}
                className={buttonVariants({ variant: "secondary" })}
              >
                Download
              </a>
            )}
          </div>
        </div>
      </div>

      {book.description && (
        <p dir="auto" className="mt-10 max-w-3xl text-sm leading-relaxed text-foreground">
          {book.description}
        </p>
      )}

      {book.scriptureReferences.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Scripture references: {book.scriptureReferences.join(", ")}
        </p>
      )}

      {book.churchFathers.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Associated Church Fathers/Saints: {book.churchFathers.map((f) => f.label).join(", ")}
        </p>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-lg text-foreground">Related Books</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-6">
            {related.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 border-t border-border pt-6">
        <ReportIssueForm bookId={book.id} />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd dir="auto" className="text-foreground">
        {value}
      </dd>
    </>
  );
}
