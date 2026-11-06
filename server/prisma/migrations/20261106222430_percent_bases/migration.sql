-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PercentBase" ADD VALUE 'PERSON_SALARY';
ALTER TYPE "PercentBase" ADD VALUE 'GROUP_SALARY';
ALTER TYPE "PercentBase" ADD VALUE 'TRANSACTION';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "percentBaseTxId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_percentBaseTxId_fkey" FOREIGN KEY ("percentBaseTxId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
