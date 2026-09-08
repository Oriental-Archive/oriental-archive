import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, AuthzError } from "@/lib/authz";

const STATUSES = ["NEW", "REVIEWING", "APPROVED", "ADDED", "DECLINED"] as const;

export async function GET(request: Request) {
  try {
    await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");
    const status = new URL(request.url).searchParams.get("status");
    const parsedStatus = status ? z.enum(STATUSES).safeParse(status) : undefined;
    if (status && !parsedStatus?.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const requests = await prisma.bookRequest.findMany({
      where: parsedStatus ? { status: parsedStatus.data } : {},
      orderBy: { createdAt: "desc" },
      include: { requesterUser: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(requests);
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
