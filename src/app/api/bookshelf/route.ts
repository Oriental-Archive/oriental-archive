import { NextResponse } from "next/server";
import { getBookshelfPage } from "@/lib/bookshelf";

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get("cursor");
  const page = await getBookshelfPage({ cursor });
  return NextResponse.json(page);
}
