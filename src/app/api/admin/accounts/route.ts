import { NextResponse } from "next/server";
import { APIError } from "better-auth";
import { z } from "zod";
import { requireRole, createAccount, AuthzError } from "@/lib/authz";

const createAccountSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(12).max(200),
  role: z.enum(["STANDARD", "LIBRARIAN"]),
  username: z.string().min(3).max(50).optional(),
  displayName: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    // Only Librarians and the Master Librarian may create accounts, and only
    // as Standard or Librarian — MASTER_LIBRARIAN is never a selectable
    // option (spec §17: "Never provide an option to create another Master
    // Librarian through this interface").
    const session = await requireRole("LIBRARIAN", "MASTER_LIBRARIAN");

    const body = createAccountSchema.parse(await request.json());
    const user = await createAccount({ actorId: session.user.id, ...body });

    return NextResponse.json(
      { id: user.id, email: user.email, role: user.role },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
    }
    // better-auth's signUpEmail throws this rather than a Zod error — mapped
    // to the same {issues: [{path, message}]} shape so the client can point
    // at the Email box instead of showing a generic failure.
    if (err instanceof APIError && err.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return NextResponse.json(
        { error: "An account with this email already exists.", issues: [{ path: ["email"], message: "An account with this email already exists." }] },
        { status: 400 }
      );
    }
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
