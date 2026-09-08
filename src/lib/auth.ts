import { betterAuth, APIError } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

// Account roles. Never trust a client-supplied role — every write to this field
// must go through the guarded server-side helpers in src/lib/authz.ts.
export const ROLES = ["STANDARD", "LIBRARIAN", "MASTER_LIBRARIAN"] as const;
export type Role = (typeof ROLES)[number];

const database = prismaAdapter(prisma, { provider: "postgresql" });
const password = { hash: hashPassword, verify: verifyPassword };

// better-auth only re-validates a user at creation/OAuth-link time; a
// returning email/password sign-in for an existing row skips that check
// entirely (see @better-auth/core's own docs on validateUserInfo). Disabled
// accounts must not be able to sign back in (spec §18/§43), so this hook
// blocks session creation itself rather than relying on the sign-in
// endpoint to notice — it's the one seam a returning credential sign-in
// can't skip.
const databaseHooks = {
  session: {
    create: {
      before: async (session: { userId: string }) => {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { isActive: true },
        });
        if (!user?.isActive) {
          throw new APIError("FORBIDDEN", { message: "This account has been disabled." });
        }
      },
    },
  },
};

// better-auth infers additionalFields/plugin types from the literal object
// passed directly to betterAuth(...) — routing it through a shared variable
// or factory function widens the type and the extra fields (role, isActive,
// twoFactor) disappear from `auth.$Infer`. So the two instances below are
// intentionally written out in full rather than sharing one config object.

// Public-facing instance: no self-registration (spec §16 — only librarians
// create accounts). This is the only instance ever wired into the HTTP route
// at src/app/api/auth/[...all]/route.ts.
export const auth = betterAuth({
  appName: "OrientalCodex",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database,
  databaseHooks,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    password,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "STANDARD",
        input: false, // never settable by the client; only via authz.ts
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      displayName: {
        type: "string",
        required: false,
        input: true,
      },
      username: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  plugins: [twoFactor({ issuer: "OrientalCodex" })],
});

// Sign-up enabled, but never exposed over HTTP. Used only by trusted server
// code that has already independently authorized the request: the guarded
// createAccount() helper in src/lib/authz.ts, and the one-time Master
// Librarian bootstrap in prisma/seed.ts.
export const provisioningAuth = betterAuth({
  appName: "OrientalCodex",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database,
  databaseHooks,
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    password,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "STANDARD",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      displayName: {
        type: "string",
        required: false,
        input: true,
      },
      username: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  plugins: [twoFactor({ issuer: "OrientalCodex" })],
});
