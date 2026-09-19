import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewBook, isViewerLibrarian } from "@/lib/visibility";
import { buttonVariants } from "@/components/ui/Button";
import { ReaderShell } from "@/components/reader/ReaderShell";
import { ArchivePdfReader } from "@/components/reader/ArchivePdfReader";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reader?: string }>;
}) {
  const { id: bookId } = await params;
  // ?reader=classic opens the original PDF reader instead of the new one —
  // kept as an escape hatch (and for side-by-side comparison) while the new
  // reader settles in. EPUB and DOCX always use their own readers.
  const { reader } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user
    ? { id: session.user.id, role: session.user.role, isActive: session.user.isActive }
    : null;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { activeVersion: true },
  });

  // Same gate as the file-download endpoint (spec §19/§33): a book the
  // viewer can't see at all — private without a grant, draft, or reading
  // disabled for it — returns the ordinary not-found page, not a distinct
  // "forbidden" screen, so a private book's existence can't be inferred.
  // Whether it actually *has* a file yet is a separate question, handled
  // below — that one's safe to answer honestly, since the viewer can
  // already see this book exists.
  const librarian = isViewerLibrarian(user);
  const canRead = book && (await canViewBook(book, user)) && (librarian || book.allowOnlineReading);
  if (!book || !canRead) notFound();

  if (!book.activeVersion) {
    return (
      <main className="mx-auto max-w-md flex-1 px-6 py-16 text-center">
        <p className="text-sm text-muted">
          <span dir="auto">{book.title}</span> doesn&apos;t have a document uploaded yet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/books/${book.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            ← Back to book
          </Link>
          {librarian && (
            <Link href={`/librarian/books/${book.id}`} className={buttonVariants({ size: "sm" })}>
              Upload a document
            </Link>
          )}
        </div>
      </main>
    );
  }

  const initialAnnotations = user
    ? await prisma.annotation.findMany({
        where: { bookId, userId: user.id, documentVersionId: book.activeVersion.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const fileUrl = `/api/books/${book.id}/file?type=document&mode=read`;

  if (book.activeVersion.mimeType === "application/pdf" && reader !== "classic") {
    return (
      <ArchivePdfReader
        bookId={book.id}
        bookTitle={book.title}
        author={book.author}
        fileName={book.activeVersion.originalFilename}
        documentVersionId={book.activeVersion.id}
        fileUrl={fileUrl}
        signedIn={!!user}
        initialAnnotations={initialAnnotations}
        // Same rule the file endpoint applies to mode=download (file-access.ts).
        canDownload={librarian || book.allowDownload}
        citationDefaults={{
          title: book.title,
          alternativeTitle: book.alternateTitle ?? "",
          author: book.author ?? "",
          editor: book.editor ?? "",
          translator: book.translator ?? "",
          publisher: book.publisher ?? "",
          publicationDate: book.publicationYear ? String(book.publicationYear) : "",
          archiveId: book.id,
        }}
      />
    );
  }

  return (
    <ReaderShell
      bookId={book.id}
      bookTitle={book.title}
      documentVersionId={book.activeVersion.id}
      mimeType={book.activeVersion.mimeType}
      fileUrl={fileUrl}
      signedIn={!!user}
      initialAnnotations={initialAnnotations}
    />
  );
}
