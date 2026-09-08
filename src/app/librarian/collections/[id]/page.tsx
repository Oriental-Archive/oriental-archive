import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CollectionMetaForm } from "@/components/librarian/CollectionMetaForm";
import { PrivateAccessVisibilityForm } from "@/components/librarian/PrivateAccessVisibilityForm";
import { CollectionBooksManager } from "@/components/librarian/CollectionBooksManager";
import { FileUploadForm } from "@/components/librarian/FileUploadForm";

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [collection, accounts, books] = await Promise.all([
    prisma.collection.findUnique({
      where: { id },
      include: {
        books: { orderBy: { order: "asc" }, include: { book: { select: { id: true, title: true } } } },
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
  if (!collection) notFound();

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <Link href="/librarian/collections" className="text-sm text-muted hover:text-burgundy">
        ← All collections
      </Link>
      <h1 dir="auto" className="mt-2 font-serif text-2xl text-foreground">
        {collection.title}
      </h1>
      <Link href={`/collections/${collection.id}`} className="text-xs text-burgundy underline">
        View public page
      </Link>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Visibility &amp; Access</h2>
        <div className="mt-3">
          <PrivateAccessVisibilityForm
            apiPath={`/api/admin/collections/${collection.id}`}
            initialVisibility={collection.visibility}
            initialPrivateUserIds={collection.privateAccess.map((p) => p.userId)}
            accounts={accounts}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Cover Image</h2>
        <div className="mt-3 max-w-md">
          <p className="text-xs text-muted">
            {collection.coverImageStorageKey ? "Shown on the collection's public page and listing." : "Optional — no cover set yet."}
          </p>
          <FileUploadForm
            action={`/api/admin/collections/${collection.id}/cover`}
            accept="image/jpeg,image/png,image/webp"
            label={collection.coverImageStorageKey ? "Replace cover image" : "Upload a cover image"}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Books</h2>
        <div className="mt-3">
          <CollectionBooksManager collectionId={collection.id} entries={collection.books} availableBooks={books} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Details</h2>
        <div className="mt-3">
          <CollectionMetaForm
            collectionId={collection.id}
            initialTitle={collection.title}
            initialDescription={collection.description ?? ""}
          />
        </div>
      </section>
    </main>
  );
}
