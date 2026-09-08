import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";

// Self-check for the Master Librarian protections in
// prisma/migrations/*_master_librarian_protection/migration.sql. These are
// enforced at the database layer (trigger + partial unique index), so this
// hits Prisma directly rather than going through any application route —
// proving the invariant holds even if app-level checks were bypassed.
//
// Run with: npm run verify:master-librarian (requires a seeded Master
// Librarian; run `npm run seed:master-librarian` first).

async function expectRejection(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error(`FAILED: ${label} — expected rejection but it succeeded`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("FAILED:")) throw err;
    console.log(`ok — ${label}`);
  }
}

async function main() {
  const master = await prisma.user.findFirst({ where: { role: "MASTER_LIBRARIAN" } });
  assert.ok(master, "No Master Librarian found — run `npm run seed:master-librarian` first");

  await expectRejection("cannot demote the Master Librarian", () =>
    prisma.user.update({ where: { id: master.id }, data: { role: "LIBRARIAN" } })
  );

  await expectRejection("cannot disable the Master Librarian", () =>
    prisma.user.update({ where: { id: master.id }, data: { isActive: false } })
  );

  await expectRejection("cannot delete the Master Librarian", () =>
    prisma.user.delete({ where: { id: master.id } })
  );

  await expectRejection("cannot create a second Master Librarian", () =>
    prisma.user.create({
      data: {
        id: `test-second-master-${Date.now()}`,
        name: "Impostor",
        email: `impostor-${Date.now()}@example.com`,
        role: "MASTER_LIBRARIAN",
      },
    })
  );

  await expectRejection("role is restricted to the known set", () =>
    prisma.user.create({
      data: {
        id: `test-bad-role-${Date.now()}`,
        name: "Bad Role",
        email: `bad-role-${Date.now()}@example.com`,
        role: "SUPER_ADMIN",
      },
    })
  );

  // Confirm the row is untouched after all of the above.
  const reloaded = await prisma.user.findUniqueOrThrow({ where: { id: master.id } });
  assert.equal(reloaded.role, "MASTER_LIBRARIAN");
  assert.equal(reloaded.isActive, true);

  console.log("\nAll Master Librarian protections hold.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
