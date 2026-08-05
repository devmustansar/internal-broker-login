-- AlterTable
ALTER TABLE "AwsResource" ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "SharedCredential" ADD COLUMN     "ownerUserId" TEXT;

-- CreateTable
CREATE TABLE "PersonalCredential" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "loginUrl" TEXT,
    "description" TEXT,
    "encryptedPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalTwoFactorEntry" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "issuer" TEXT,
    "accountLabel" TEXT,
    "encryptedSecret" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA1',
    "digits" INTEGER NOT NULL DEFAULT 6,
    "period" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PersonalTwoFactorEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalTwoFactorSecretVersion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rotatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalTwoFactorSecretVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalVaultAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "outcome" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalVaultAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "organizationId" TEXT NOT NULL,
    "resourceId" TEXT,
    "awsResourceId" TEXT,
    "appName" TEXT NOT NULL,
    "loginUrl" TEXT,
    "justification" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdCredentialId" TEXT,
    "createdTwoFactorEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "relatedId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalCredential_ownerUserId_idx" ON "PersonalCredential"("ownerUserId");

-- CreateIndex
CREATE INDEX "PersonalTwoFactorEntry_ownerUserId_idx" ON "PersonalTwoFactorEntry"("ownerUserId");

-- CreateIndex
CREATE INDEX "PersonalTwoFactorEntry_deletedAt_idx" ON "PersonalTwoFactorEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "PersonalTwoFactorSecretVersion_entryId_idx" ON "PersonalTwoFactorSecretVersion"("entryId");

-- CreateIndex
CREATE INDEX "PersonalVaultAccessLog_userId_idx" ON "PersonalVaultAccessLog"("userId");

-- CreateIndex
CREATE INDEX "PersonalVaultAccessLog_targetId_idx" ON "PersonalVaultAccessLog"("targetId");

-- CreateIndex
CREATE INDEX "PersonalVaultAccessLog_timestamp_idx" ON "PersonalVaultAccessLog"("timestamp");

-- CreateIndex
CREATE INDEX "VaultRequest_organizationId_idx" ON "VaultRequest"("organizationId");

-- CreateIndex
CREATE INDEX "VaultRequest_status_idx" ON "VaultRequest"("status");

-- CreateIndex
CREATE INDEX "VaultRequest_requestedById_idx" ON "VaultRequest"("requestedById");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsResource" ADD CONSTRAINT "AwsResource_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedCredential" ADD CONSTRAINT "SharedCredential_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCredential" ADD CONSTRAINT "PersonalCredential_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTwoFactorEntry" ADD CONSTRAINT "PersonalTwoFactorEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTwoFactorSecretVersion" ADD CONSTRAINT "PersonalTwoFactorSecretVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PersonalTwoFactorEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTwoFactorSecretVersion" ADD CONSTRAINT "PersonalTwoFactorSecretVersion_rotatedById_fkey" FOREIGN KEY ("rotatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalVaultAccessLog" ADD CONSTRAINT "PersonalVaultAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_awsResourceId_fkey" FOREIGN KEY ("awsResourceId") REFERENCES "AwsResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_createdCredentialId_fkey" FOREIGN KEY ("createdCredentialId") REFERENCES "SharedCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequest" ADD CONSTRAINT "VaultRequest_createdTwoFactorEntryId_fkey" FOREIGN KEY ("createdTwoFactorEntryId") REFERENCES "TwoFactorEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

