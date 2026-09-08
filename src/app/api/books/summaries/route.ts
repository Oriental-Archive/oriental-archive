import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Resolves book titles for the anonymous Highlights page (spec §22): local
// highlights only ever reference books an anonymous visitor could open, i.e.
// PUBLIC ones, so no auth/visibility check beyond that filter is needed.
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids");
  if (!ids) return NextResponse.json([]);

  const books = await prisma.book.findMany({
    where: { id: { in: ids.split(",").slice(0, 100) }, visibility: "PUBLIC" },
    select: { id: true, title: true },
  });
  return NextResponse.json(books);
}
