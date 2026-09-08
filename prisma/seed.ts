import { provisioningAuth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

// One-time bootstrap for the single protected Master Librarian account
// (spec §16/§32). Run manually via `npm run seed:master-librarian` — never
// wired into app startup, so it can't accidentally re-run against a live DB.
async function main() {
  const {
    MASTER_LIBRARIAN_USERNAME,
    MASTER_LIBRARIAN_EMAIL,
    MASTER_LIBRARIAN_PASSWORD,
  } = process.env;

  if (!MASTER_LIBRARIAN_EMAIL || !MASTER_LIBRARIAN_PASSWORD) {
    throw new Error(
      "Set MASTER_LIBRARIAN_EMAIL and MASTER_LIBRARIAN_PASSWORD before seeding."
    );
  }

  const existing = await prisma.user.findFirst({
    where: { role: "MASTER_LIBRARIAN" },
  });
  if (existing) {
    console.log(`Master Librarian already exists (${existing.email}); skipping.`);
    return;
  }

  const result = await provisioningAuth.api.signUpEmail({
    body: {
      name: MASTER_LIBRARIAN_USERNAME ?? "Master Librarian",
      email: MASTER_LIBRARIAN_EMAIL,
      password: MASTER_LIBRARIAN_PASSWORD,
      username: MASTER_LIBRARIAN_USERNAME,
    },
  });

  // Promote after creation rather than setting role at sign-up time: the
  // additionalFields config marks `role` as input:false specifically so no
  // sign-up body can set it, including this one.
  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: "MASTER_LIBRARIAN", emailVerified: true },
  });

  console.log(`Master Librarian account created: ${MASTER_LIBRARIAN_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
