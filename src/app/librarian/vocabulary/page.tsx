import { prisma } from "@/lib/prisma";
import { VocabularySection } from "@/components/librarian/VocabularySection";

const SECTIONS: { type: string; title: string }[] = [
  { type: "LANGUAGE", title: "Languages" },
  { type: "CHURCH_TRADITION", title: "Church Traditions" },
  { type: "CATEGORY", title: "Categories" },
  { type: "DOCUMENT_TYPE", title: "Document Types" },
  { type: "RIGHTS_STATUS", title: "Rights Statuses" },
  { type: "TOPIC", title: "Topics" },
  { type: "CHURCH_FATHER", title: "Church Fathers / Saints" },
];

export default async function VocabularyPage() {
  // Every term, active or not — unlike the Catalog/Add-Book dropdowns
  // (which only ever query active ones), a librarian managing the list
  // needs to see a deactivated term too, to be able to reactivate it.
  const terms = await prisma.controlledTerm.findMany({
    orderBy: [{ active: "desc" }, { label: "asc" }],
  });

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Vocabulary</h1>
      <p className="mt-1 text-sm text-muted">
        Controlled lists used throughout the catalog. Librarians extend these instead of typing
        free text, so the same language or topic never ends up as several unrelated entries.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <VocabularySection
            key={s.type}
            type={s.type}
            title={s.title}
            terms={terms.filter((t) => t.type === s.type)}
          />
        ))}
      </div>
    </main>
  );
}
