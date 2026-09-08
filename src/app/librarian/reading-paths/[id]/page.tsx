import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReadingPathMetaForm } from "@/components/librarian/ReadingPathMetaForm";
import { PrivateAccessVisibilityForm } from "@/components/librarian/PrivateAccessVisibilityForm";
import { ReadingPathStepsManager } from "@/components/librarian/ReadingPathStepsManager";
import { FileUploadForm } from "@/components/librarian/FileUploadForm";

export default async function EditReadingPathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [readingPath, accounts, books] = await Promise.all([
    prisma.readingPath.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" }, include: { book: { select: { id: true, title: true } } } },
        privateAccess: true,
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["STANDARD", "LIBRARIAN"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.book.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!readingPath) notFound();

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <Link href="/librarian/reading-paths" className="text-sm text-muted hover:text-burgundy">
        ← All reading paths
      </Link>
      <h1 dir="auto" className="mt-2 font-serif text-2xl text-foreground">
        {readingPath.title}
      </h1>
      <Link href={`/reading-paths/${readingPath.id}`} className="text-xs text-burgundy underline">
        View public page
      </Link>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Visibility &amp; Access</h2>
        <div className="mt-3">
          <PrivateAccessVisibilityForm
            apiPath={`/api/admin/reading-paths/${readingPath.id}`}
            initialVisibility={readingPath.visibility}
            initialPrivateUserIds={readingPath.privateAccess.map((p) => p.userId)}
            accounts={accounts}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Cover Image</h2>
        <div className="mt-3 max-w-md">
          <p className="text-xs text-muted">
            {readingPath.coverImageStorageKey ? "Shown on the path's public page and listing." : "Optional — no cover set yet."}
          </p>
          <FileUploadForm
            action={`/api/admin/reading-paths/${readingPath.id}/cover`}
            accept="image/jpeg,image/png,image/webp"
            label={readingPath.coverImageStorageKey ? "Replace cover image" : "Upload a cover image"}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Books</h2>
        <p className="mt-1 text-xs text-muted">
          The order below is the order readers will go through them.
        </p>
        <div className="mt-3">
          <ReadingPathStepsManager
            readingPathId={readingPath.id}
            steps={readingPath.steps}
            availableBooks={books}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Details</h2>
        <div className="mt-3">
          <ReadingPathMetaForm
            readingPathId={readingPath.id}
            initialTitle={readingPath.title}
            initialTopic={readingPath.topic ?? ""}
            initialDescription={readingPath.description ?? ""}
          />
        </div>
      </section>
    </main>
  );
}
