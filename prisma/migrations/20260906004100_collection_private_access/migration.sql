-- CreateTable
CREATE TABLE "CollectionPrivateAccess" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionPrivateAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionPrivateAccess_userId_idx" ON "CollectionPrivateAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionPrivateAccess_collectionId_userId_key" ON "CollectionPrivateAccess"("collectionId", "userId");

-- AddForeignKey
ALTER TABLE "CollectionPrivateAccess" ADD CONSTRAINT "CollectionPrivateAccess_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPrivateAccess" ADD CONSTRAINT "CollectionPrivateAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPrivateAccess" ADD CONSTRAINT "CollectionPrivateAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
