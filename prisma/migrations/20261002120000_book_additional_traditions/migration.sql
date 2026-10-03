-- CreateTable
CREATE TABLE "_BookAdditionalTraditions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookAdditionalTraditions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BookAdditionalTraditions_B_index" ON "_BookAdditionalTraditions"("B");

-- AddForeignKey
ALTER TABLE "_BookAdditionalTraditions" ADD CONSTRAINT "_BookAdditionalTraditions_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookAdditionalTraditions" ADD CONSTRAINT "_BookAdditionalTraditions_B_fkey" FOREIGN KEY ("B") REFERENCES "ControlledTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

