import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { catalogVisibilityWhere } from "@/lib/visibility";
import { BookCard } from "@/components/BookCard";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Catalog — OrientalCodex" };

const PAGE_SIZE = 24;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Full text search across the descriptive fields (spec §4) — the bookshelf
// carousel is a discovery surface, not the only way to find a specific book;
// this page is that other way.
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim();
  const languageId = first(sp.language);
  const churchTraditionId = first(sp.tradition);
  const categoryId = first(sp.category);
  const documentTypeId = first(sp.documentType);
  const topicId = first(sp.topic);
  const downloadOnly = first(sp.download) === "1";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const session = await auth.api.getSession({ headers: await headers() });

  const where: Prisma.BookWhereInput = {
    AND: [
      catalogVisibilityWhere(session?.user),
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { alternateTitle: { contains: q, mode: "insensitive" } },
              { originalTitle: { contains: q, mode: "insensitive" } },
              { author: { contains: q, mode: "insensitive" } },
              { translator: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      languageId ? { languageId } : {},
      churchTraditionId ? { churchTraditionId } : {},
      categoryId ? { categoryId } : {},
      documentTypeId ? { documentTypeId } : {},
      topicId ? { topics: { some: { id: topicId } } } : {},
      downloadOnly ? { allowDownload: true } : {},
    ],
  };

  const [books, total, languages, traditions, categories, documentTypes, topics] =
    await Promise.all([
      prisma.book.findMany({
        where,
        include: { language: true, churchTradition: true },
        orderBy: { title: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.book.count({ where }),
      prisma.controlledTerm.findMany({ where: { type: "LANGUAGE", active: true }, orderBy: { label: "asc" } }),
      prisma.controlledTerm.findMany({ where: { type: "CHURCH_TRADITION", active: true }, orderBy: { label: "asc" } }),
      prisma.controlledTerm.findMany({ where: { type: "CATEGORY", active: true }, orderBy: { label: "asc" } }),
      prisma.controlledTerm.findMany({ where: { type: "DOCUMENT_TYPE", active: true }, orderBy: { label: "asc" } }),
      prisma.controlledTerm.findMany({ where: { type: "TOPIC", active: true }, orderBy: { label: "asc" } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [languageId, churchTraditionId, categoryId, documentTypeId, topicId, downloadOnly || undefined]
    .filter(Boolean).length;

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-10">
      <h1 className="font-serif text-3xl text-foreground">Catalog</h1>
      <p className="mt-1 text-sm text-muted">
        {total} {total === 1 ? "book" : "books"}
      </p>

      <form method="get" className="mt-6 border-b border-border pb-4">
        <div className="flex items-end gap-3">
          <Field label="Search" className="flex-1">
            <Input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Title, author, translator, description…"
            />
          </Field>
          <Button type="submit">Search</Button>
        </div>

        <details className="group mt-4" open={activeFilterCount > 0}>
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs text-muted hover:text-foreground">
            Filters
            {activeFilterCount > 0 && <span className="text-burgundy">({activeFilterCount})</span>}
            <span className="transition-transform group-open:rotate-180">⌄</span>
          </summary>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <FilterSelect name="language" label="Language" options={languages} selected={languageId} />
            <FilterSelect name="tradition" label="Church Tradition" options={traditions} selected={churchTraditionId} />
            <FilterSelect name="category" label="Category" options={categories} selected={categoryId} />
            <FilterSelect name="documentType" label="Document Type" options={documentTypes} selected={documentTypeId} />
            <FilterSelect name="topic" label="Topic" options={topics} selected={topicId} />

            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" name="download" value="1" defaultChecked={downloadOnly} />
              Downloadable only
            </label>

            <Button type="submit" variant="secondary" size="sm">
              Apply filters
            </Button>
          </div>
        </details>
      </form>

      {books.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No books match these filters.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const params = new URLSearchParams(
              Object.entries(sp).flatMap(([k, v]) =>
                v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
              ) as [string, string][]
            );
            params.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/catalog?${params.toString()}`}
                className={
                  n === page
                    ? "rounded-sm bg-navy px-3 py-1 text-background"
                    : "rounded-sm px-3 py-1 text-foreground hover:bg-navy/10"
                }
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </main>
  );
}

function FilterSelect({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: { id: string; label: string }[];
  selected: string | undefined;
}) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={selected ?? ""}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
