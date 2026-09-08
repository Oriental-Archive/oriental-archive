-- AlterTable
-- (carried over from the reader phase — this had been applied to a
-- different local dev database instance but the migration file itself was
-- never committed to disk, so `_prisma_migrations` on this database never
-- recorded it; folding it in here since the schema has required it ever
-- since.)
ALTER TABLE "Annotation" ALTER COLUMN "highlightData" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ReadingPathPrivateAccess" (
    "id" TEXT NOT NULL,
    "readingPathId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingPathPrivateAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingPathPrivateAccess_userId_idx" ON "ReadingPathPrivateAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingPathPrivateAccess_readingPathId_userId_key" ON "ReadingPathPrivateAccess"("readingPathId", "userId");

-- AddForeignKey
ALTER TABLE "ReadingPathPrivateAccess" ADD CONSTRAINT "ReadingPathPrivateAccess_readingPathId_fkey" FOREIGN KEY ("readingPathId") REFERENCES "ReadingPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingPathPrivateAccess" ADD CONSTRAINT "ReadingPathPrivateAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingPathPrivateAccess" ADD CONSTRAINT "ReadingPathPrivateAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
