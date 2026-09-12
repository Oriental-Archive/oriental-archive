import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { HighlightsManager } from "@/components/HighlightsManager";

export const metadata = { title: "Highlights — Oriental Archive" };

export default async function HighlightsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Signed-in highlights/bookmarks are already in the database (spec §10);
  // anonymous ones live only in the visitor's browser (spec §22) and are
  // loaded client-side by HighlightsManager instead.
  const [annotations, books] = session
    ? await Promise.all([
        prisma.annotation.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
        }),
        prisma.book.findMany({
          where: { annotations: { some: { userId: session.user.id } } },
          select: { id: true, title: true },
        }),
      ])
    : [[], []];

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <h1 className="font-serif text-3xl text-foreground">Highlights & Bookmarks</h1>
      <p className="mt-2 text-sm text-muted">
        Everything you&apos;ve marked while reading, gathered in one place.
      </p>

      <HighlightsManager
        signedIn={!!session}
        initialAnnotations={annotations}
        initialBooks={books}
      />
    </main>
  );
}
