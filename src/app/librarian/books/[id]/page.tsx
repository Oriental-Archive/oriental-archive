import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookMetadataForm } from "@/components/librarian/BookMetadataForm";
import { BookVisibilityForm } from "@/components/librarian/BookVisibilityForm";
import { FileUploadForm } from "@/components/librarian/FileUploadForm";

async function loadTermOptions() {
  const terms = await prisma.controlledTerm.findMany({ where: { active: true }, orderBy: { label: "asc" } });
  const byType = (type: string) => terms.filter((t) => t.type === type).map((t) => ({ id: t.id, label: t.label }));
  return {
    languages: byType("LANGUAGE"),
    traditions: byType("CHURCH_TRADITION"),
    documentTypes: byType("DOCUMENT_TYPE"),
    categories: byType("CATEGORY"),
    rightsStatuses: byType("RIGHTS_STATUS"),
    topics: byType("TOPIC"),
    churchFathers: byType("CHURCH_FATHER"),
  };
}

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, options, accounts] = await Promise.all([
    prisma.book.findUnique({
      where: { id },
      include: {
        topics: true,
        churchFathers: true,
        privateAccess: true,
        versions: { orderBy: { versionNumber: "desc" } },
      },
    }),
    loadTermOptions(),
    prisma.user.findMany({
      where: { role: { in: ["STANDARD", "LIBRARIAN"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!book) notFound();

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <Link href="/librarian/books" className="text-sm text-muted hover:text-burgundy">
        ← All books
      </Link>
      <h1 dir="auto" className="mt-2 font-serif text-2xl text-foreground">
        {book.title}
      </h1>
      <Link href={`/books/${book.id}`} className="text-xs text-burgundy underline">
        View public page
      </Link>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Visibility &amp; Access</h2>
        <div className="mt-3">
          <BookVisibilityForm
            bookId={book.id}
            initialVisibility={book.visibility}
            initialAllowOnlineReading={book.allowOnlineReading}
            initialAllowDownload={book.allowDownload}
            initialPrivateUserIds={book.privateAccess.map((p) => p.userId)}
            accounts={accounts}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Files</h2>
        <div className="mt-3 flex max-w-md flex-col gap-4">
          <div>
            <p className="text-xs text-muted">Cover image</p>
            <FileUploadForm
              action={`/api/admin/books/${book.id}/cover`}
              accept="image/jpeg,image/png,image/webp"
              label="Replace cover image"
            />
          </div>
          <div>
            <p className="text-xs text-muted">
              {book.versions.length > 0
                ? `${book.versions.length} version(s) uploaded, current active: v${book.versions.find((v) => v.id === book.activeVersionId)?.versionNumber ?? "—"}`
                : "No document uploaded yet."}
            </p>
            <FileUploadForm
              action={`/api/admin/books/${book.id}/versions`}
              accept=".pdf,.epub,.docx"
              label="Upload a new document version"
              extraFields={{ setActive: "true" }}
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Metadata</h2>
        <div className="mt-3">
          <BookMetadataForm
            mode="edit"
            bookId={book.id}
            initial={{
              title: book.title,
              alternateTitle: book.alternateTitle ?? "",
              originalTitle: book.originalTitle ?? "",
              author: book.author ?? "",
              translator: book.translator ?? "",
              editor: book.editor ?? "",
              publisher: book.publisher ?? "",
              publicationYear: book.publicationYear?.toString() ?? "",
              description: book.description ?? "",
              pageCount: book.pageCount?.toString() ?? "",
              provenance: book.provenance ?? "",
              scriptureReferences: book.scriptureReferences.join(", "),
              languageId: book.languageId,
              churchTraditionId: book.churchTraditionId,
              documentTypeId: book.documentTypeId,
              categoryId: book.categoryId ?? "",
              rightsStatusId: book.rightsStatusId ?? "",
              topicIds: book.topics.map((t) => t.id),
              churchFatherIds: book.churchFathers.map((t) => t.id),
            }}
            {...options}
          />
        </div>
      </section>
    </main>
  );
}
