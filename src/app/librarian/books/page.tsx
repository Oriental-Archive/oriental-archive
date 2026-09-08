import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/Button";
import { StatusTabs } from "@/components/ui/StatusTabs";

const VISIBILITIES = ["DRAFT", "PUBLIC", "PRIVATE"] as const;

export default async function LibrarianBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ visibility?: string }>;
}) {
  const { visibility } = await searchParams;
  const activeVisibility = VISIBILITIES.includes(visibility as (typeof VISIBILITIES)[number])
    ? (visibility as (typeof VISIBILITIES)[number])
    : undefined;

  const books = await prisma.book.findMany({
    where: activeVisibility ? { visibility: activeVisibility } : {},
    orderBy: { updatedAt: "desc" },
    include: { language: true, churchTradition: true },
  });

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Books</h1>
        <Link href="/librarian/books/new" className={buttonVariants({ size: "sm" })}>
          Add Book
        </Link>
      </div>

      <div className="mt-4">
        <StatusTabs
          tabs={[
            { label: "All", href: "/librarian/books", active: !activeVisibility },
            ...VISIBILITIES.map((v) => ({
              label: v,
              href: `/librarian/books?visibility=${v}`,
              active: activeVisibility === v,
            })),
          ]}
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Language</th>
              <th className="py-2 pr-4">Tradition</th>
              <th className="py-2 pr-4">Visibility</th>
              <th className="py-2 pr-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="border-b border-border/60">
                <td dir="auto" className="py-2 pr-4">
                  <Link href={`/librarian/books/${b.id}`} className="text-navy hover:text-burgundy">
                    {b.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted">{b.language.label}</td>
                <td className="py-2 pr-4 text-muted">{b.churchTradition.label}</td>
                <td className="py-2 pr-4 text-muted">{b.visibility}</td>
                <td className="py-2 pr-4 text-muted">{b.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {books.length === 0 && <p className="py-6 text-sm text-muted">No books here.</p>}
      </div>
    </main>
  );
}
