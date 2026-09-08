import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/Button";
import { StatusTabs } from "@/components/ui/StatusTabs";

const VISIBILITIES = ["DRAFT", "PUBLIC", "PRIVATE"] as const;

export default async function LibrarianReadingPathsPage({
  searchParams,
}: {
  searchParams: Promise<{ visibility?: string }>;
}) {
  const { visibility } = await searchParams;
  const activeVisibility = VISIBILITIES.includes(visibility as (typeof VISIBILITIES)[number])
    ? (visibility as (typeof VISIBILITIES)[number])
    : undefined;

  const readingPaths = await prisma.readingPath.findMany({
    where: activeVisibility ? { visibility: activeVisibility } : {},
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Reading Paths</h1>
        <Link href="/librarian/reading-paths/new" className={buttonVariants({ size: "sm" })}>
          New Reading Path
        </Link>
      </div>

      <div className="mt-4">
        <StatusTabs
          tabs={[
            { label: "All", href: "/librarian/reading-paths", active: !activeVisibility },
            ...VISIBILITIES.map((v) => ({
              label: v,
              href: `/librarian/reading-paths?visibility=${v}`,
              active: activeVisibility === v,
            })),
          ]}
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Steps</th>
              <th className="py-2 pr-4">Visibility</th>
              <th className="py-2 pr-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {readingPaths.map((rp) => (
              <tr key={rp.id} className="border-b border-border/60">
                <td dir="auto" className="py-2 pr-4">
                  <Link href={`/librarian/reading-paths/${rp.id}`} className="text-navy hover:text-burgundy">
                    {rp.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted">{rp._count.steps}</td>
                <td className="py-2 pr-4 text-muted">{rp.visibility}</td>
                <td className="py-2 pr-4 text-muted">{rp.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {readingPaths.length === 0 && <p className="py-6 text-sm text-muted">None here.</p>}
      </div>
    </main>
  );
}
