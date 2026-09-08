import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookMetadataForm, EMPTY_BOOK_VALUES } from "@/components/librarian/BookMetadataForm";

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

export default async function NewBookPage() {
  const options = await loadTermOptions();

  const missingRequired =
    options.languages.length === 0 || options.traditions.length === 0 || options.documentTypes.length === 0;

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <Link href="/librarian/books" className="text-sm text-muted hover:text-burgundy">
        ← All books
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-foreground">Add Book</h1>
      <p className="mt-1 text-sm text-muted">
        New books always start as a draft, visible only to librarians, until explicitly published.
      </p>

      {missingRequired ? (
        <p className="mt-6 rounded-sm border border-gold bg-surface p-4 text-sm text-navy">
          At least one Language, Church Tradition, and Document Type must exist before a book can
          be added. Add them under{" "}
          <Link href="/librarian/vocabulary" className="underline">
            Vocabulary
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="mt-6">
          <BookMetadataForm mode="create" initial={EMPTY_BOOK_VALUES} {...options} />
        </div>
      )}
    </main>
  );
}
