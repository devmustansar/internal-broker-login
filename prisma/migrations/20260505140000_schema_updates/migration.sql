-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "resourceKey" TEXT;

-- AlterTable
ALTER TABLE "AwsResource" ADD COLUMN     "availablePolicyArns" TEXT[],
ADD COLUMN     "sessionName" TEXT;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "loginPayloadTemplate" TEXT,
ADD COLUMN     "magicLinkExtractionPath" TEXT;

-- AlterTable
ALTER TABLE "UserOrganization" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'member',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "UserAwsPolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awsResourceId" TEXT NOT NULL,
    "policyArns" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAwsPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAwsPolicy_userId_awsResourceId_key" ON "UserAwsPolicy"("userId", "awsResourceId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_outcome_idx" ON "AuditLog"("outcome");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_resourceKey_idx" ON "AuditLog"("resourceKey");

-- AddForeignKey
ALTER TABLE "UserAwsPolicy" ADD CONSTRAINT "UserAwsPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAwsPolicy" ADD CONSTRAINT "UserAwsPolicy_awsResourceId_fkey" FOREIGN KEY ("awsResourceId") REFERENCES "AwsResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

