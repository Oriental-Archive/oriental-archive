import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Public, unauthenticated submission (spec §21) — only the book's identity
// is truly required; everything else helps a librarian find it but isn't
// mandatory. Requests always land in the librarian inbox (never silently
// dropped) and are never returned with librarian-only fields here.
const bookRequestSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(300).optional(),
  language: z.string().max(200).optional(),
  churchTradition: z.string().max(200).optional(),
  sourceLink: z.string().max(2000).optional(),
  reason: z.string().max(5000).optional(),
  comments: z.string().max(5000).optional(),
  requesterName: z.string().max(200).optional(),
  requesterContact: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const parsed = bookRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });

  const bookRequest = await prisma.bookRequest.create({
    data: {
      ...parsed.data,
      requesterUserId: session?.user.id,
    },
  });

  return NextResponse.json({ id: bookRequest.id }, { status: 201 });
}
