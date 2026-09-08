import { headers } from "next/headers";
import { auth, provisioningAuth, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

// Every protected route calls this — never trust a role/userId supplied by
// the client itself. The session is looked up server-side from the request
// cookie on every call (spec §31: authorization must be enforced server-side
// on every protected request).
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AuthzError("Not signed in", 401);
  if (!session.user.isActive) throw new AuthzError("Account is disabled", 403);
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role as Role)) {
    throw new AuthzError("Not authorized for this action", 403);
  }
  return session;
}

export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
    },
  });
}

// Librarian-created accounts only (spec §16/§17): no public registration,
// and this can never produce a MASTER_LIBRARIAN — that role exists exactly
// once, created only by prisma/seed.ts, protected at the database layer by
// the trigger in prisma/migrations/*_master_librarian_protection.
export async function createAccount(params: {
  actorId: string;
  name: string;
  email: string;
  password: string;
  role: Extract<Role, "STANDARD" | "LIBRARIAN">;
  username?: string;
  displayName?: string;
}) {
  if (params.role !== "STANDARD" && params.role !== "LIBRARIAN") {
    throw new AuthzError("Only Standard or Librarian accounts can be created here", 400);
  }

  const result = await provisioningAuth.api.signUpEmail({
    body: {
      name: params.name,
      email: params.email,
      password: params.password,
      username: params.username,
      displayName: params.displayName,
    },
  });

  // signUpEmail always creates STANDARD by default (additionalFields default);
  // promote to LIBRARIAN explicitly when asked. The trigger only restricts
  // MASTER_LIBRARIAN transitions, so this update is unaffected by it.
  const user =
    params.role === "LIBRARIAN"
      ? await prisma.user.update({ where: { id: result.user.id }, data: { role: "LIBRARIAN" } })
      : result.user;

  await writeAuditLog({
    actorId: params.actorId,
    action: "account.create",
    targetType: "User",
    targetId: result.user.id,
    metadata: { role: params.role },
  });

  return user;
}

// Changing role between STANDARD and LIBRARIAN only. The database trigger is
// the real backstop; this check exists so callers get a clear error instead
// of a raw SQL exception, and so MASTER_LIBRARIAN is rejected before any
// query runs.
export async function changeAccountRole(params: {
  actorId: string;
  targetUserId: string;
  newRole: Extract<Role, "STANDARD" | "LIBRARIAN">;
}) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: params.targetUserId } });
  if (target.role === "MASTER_LIBRARIAN") {
    throw new AuthzError("The Master Librarian's role cannot be changed", 403);
  }
  if (params.newRole !== "STANDARD" && params.newRole !== "LIBRARIAN") {
    throw new AuthzError("Invalid role", 400);
  }

  const updated = await prisma.user.update({
    where: { id: params.targetUserId },
    data: { role: params.newRole },
  });

  await writeAuditLog({
    actorId: params.actorId,
    action: "account.role_change",
    targetType: "User",
    targetId: params.targetUserId,
    metadata: { from: target.role, to: params.newRole },
  });

  return updated;
}

export async function setAccountActive(params: {
  actorId: string;
  targetUserId: string;
  isActive: boolean;
}) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: params.targetUserId } });
  if (target.role === "MASTER_LIBRARIAN" && !params.isActive) {
    throw new AuthzError("The Master Librarian account cannot be disabled", 403);
  }

  const updated = await prisma.user.update({
    where: { id: params.targetUserId },
    data: { isActive: params.isActive },
  });

  if (!params.isActive) {
    // Force sign-out everywhere. This bypasses the auth library's own API
    // (which only exposes revoking *your own* sessions, plus an admin-plugin
    // variant we deliberately don't use — see auth.ts) and instead deletes
    // the rows directly; Session is a plain table we fully control.
    await prisma.session.deleteMany({ where: { userId: params.targetUserId } });
  }

  await writeAuditLog({
    actorId: params.actorId,
    action: params.isActive ? "account.enable" : "account.disable",
    targetType: "User",
    targetId: params.targetUserId,
  });

  return updated;
}
