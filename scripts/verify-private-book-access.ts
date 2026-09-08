import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { resolveFileAccess } from "../src/lib/file-access";

// Exercises the exact security properties spec §43 calls out for private
// books, directly against resolveFileAccess() and the real database — no
// HTTP layer, no object storage needed, since the authorization decision
// (not the S3 call) is the part that must never be wrong.
//
// Run with: npm run verify:private-book-access

async function main() {
  const language = await prisma.controlledTerm.upsert({
    where: { type_value: { type: "LANGUAGE", value: "test-en" } },
    update: {},
    create: { type: "LANGUAGE", value: "test-en", label: "Test English" },
  });
  const tradition = await prisma.controlledTerm.upsert({
    where: { type_value: { type: "CHURCH_TRADITION", value: "test-tradition" } },
    update: {},
    create: { type: "CHURCH_TRADITION", value: "test-tradition", label: "Test Tradition" },
  });
  const docType = await prisma.controlledTerm.upsert({
    where: { type_value: { type: "DOCUMENT_TYPE", value: "test-doctype" } },
    update: {},
    create: { type: "DOCUMENT_TYPE", value: "test-doctype", label: "Test Document Type" },
  });

  const suffix = Date.now();
  const tags = ["creator", "user-a", "user-b", "librarian"] as const;
  const users: Record<(typeof tags)[number], Awaited<ReturnType<typeof prisma.user.create>>> = {} as never;
  for (const tag of tags) {
    users[tag] = await prisma.user.create({
      data: {
        id: `verify-${tag}-${suffix}`,
        name: tag,
        email: `verify-${tag}-${suffix}@example.com`,
        role: tag === "librarian" ? "LIBRARIAN" : "STANDARD",
      },
    });
  }
  const creator = users.creator;
  const userA = users["user-a"];
  const userB = users["user-b"];
  const librarian = users.librarian;

  const bookFields = {
    languageId: language.id,
    churchTraditionId: tradition.id,
    documentTypeId: docType.id,
    createdById: creator.id,
  };

  try {
    await runChecks(bookFields, { creator, userA, userB, librarian }, suffix);
  } finally {
    // Always clean up, including when an assertion above throws — otherwise
    // a failed run leaves fixture rows behind for the next one to trip over.
    await prisma.book.deleteMany({ where: { createdById: creator.id } });
    await prisma.user.deleteMany({ where: { id: { in: [creator.id, userA.id, userB.id, librarian.id] } } });
  }
}

async function runChecks(
  bookFields: { languageId: string; churchTraditionId: string; documentTypeId: string; createdById: string },
  users: { creator: { id: string }; userA: { id: string }; userB: { id: string }; librarian: { id: string } },
  suffix: number
) {
  const { creator, userA, userB, librarian } = users;

  const publicReadOnly = await prisma.book.create({
    data: {
      ...bookFields,
      title: `Public read-only ${suffix}`,
      visibility: "PUBLIC",
      allowOnlineReading: true,
      allowDownload: false,
    },
  });
  const draft = await prisma.book.create({
    data: { ...bookFields, title: `Draft ${suffix}`, visibility: "DRAFT" },
  });
  const privateToB = await prisma.book.create({
    data: {
      ...bookFields,
      title: `Private to B ${suffix}`,
      visibility: "PRIVATE",
      allowOnlineReading: true,
      allowDownload: true,
    },
  });
  await prisma.bookPrivateAccess.create({
    data: { bookId: privateToB.id, userId: userB.id, grantedById: creator.id },
  });

  // A fake but present DocumentVersion for the two books an "allowed" case
  // needs to resolve all the way through — resolveFileAccess correctly
  // returns denied for a book with no active version at all, so the
  // permission checks below need something to find.
  for (const book of [publicReadOnly, draft, privateToB]) {
    const version = await prisma.documentVersion.create({
      data: {
        bookId: book.id,
        versionNumber: 1,
        storageKey: `test/${book.id}`,
        originalFilename: "test.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1,
        checksumSha256: "0".repeat(64),
        uploadedById: creator.id,
      },
    });
    await prisma.book.update({ where: { id: book.id }, data: { activeVersionId: version.id } });
  }

  let passed = 0;
  async function check(label: string, expected: boolean, req: Parameters<typeof resolveFileAccess>[0]) {
    const result = await resolveFileAccess(req);
    assert.equal(result.allowed, expected, `FAILED: ${label}`);
    console.log(`ok — ${label}`);
    passed++;
  }

  // Anonymous access
  await check("anonymous can read a public, read-permitted book", true, {
    bookId: publicReadOnly.id, type: "document", mode: "read", user: null,
  });
  await check("anonymous cannot download when allowDownload is false", false, {
    bookId: publicReadOnly.id, type: "document", mode: "download", user: null,
  });
  await check("anonymous cannot see a draft book", false, {
    bookId: draft.id, type: "document", mode: "read", user: null,
  });
  await check("anonymous cannot see a private book", false, {
    bookId: privateToB.id, type: "document", mode: "read", user: null,
  });

  // Standard users
  const asUserA = { id: userA.id, role: "STANDARD", isActive: true };
  const asUserB = { id: userB.id, role: "STANDARD", isActive: true };
  await check("an unrelated standard user cannot see a draft book", false, {
    bookId: draft.id, type: "document", mode: "read", user: asUserA,
  });
  await check(
    "user A cannot access a private book granted only to user B",
    false,
    { bookId: privateToB.id, type: "document", mode: "read", user: asUserA }
  );
  await check("user B can access the private book granted to them", true, {
    bookId: privateToB.id, type: "document", mode: "read", user: asUserB,
  });
  await check("user B's grant does not extend to download-mode incorrectly", true, {
    bookId: privateToB.id, type: "document", mode: "download", user: asUserB,
  });

  // Librarian bypass
  const asLibrarian = { id: librarian.id, role: "LIBRARIAN", isActive: true };
  await check("a librarian can see a draft book", true, {
    bookId: draft.id, type: "document", mode: "read", user: asLibrarian,
  });
  await check("a librarian can see a private book with no explicit grant", true, {
    bookId: privateToB.id, type: "document", mode: "read", user: asLibrarian,
  });

  // Disabled account
  await check("a disabled account loses its private-book grant", false, {
    bookId: privateToB.id, type: "document", mode: "read",
    user: { id: userB.id, role: "STANDARD", isActive: false },
  });

  // Guessing an id
  await check("a nonexistent book id resolves the same as denied", false, {
    bookId: `does-not-exist-${suffix}`, type: "document", mode: "read", user: asUserA,
  });

  console.log(`\nAll ${passed} private-book access checks hold.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
