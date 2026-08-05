-- AlterTable
ALTER TABLE "VaultRequest" ADD COLUMN     "algorithm" TEXT,
ADD COLUMN     "digits" INTEGER,
ADD COLUMN     "encryptedPayload" TEXT,
ADD COLUMN     "encryptedSecret" TEXT,
ADD COLUMN     "period" INTEGER;

