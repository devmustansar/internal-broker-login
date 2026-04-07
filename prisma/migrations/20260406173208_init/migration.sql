-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowedResourceKeys" TEXT[],
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appHost" TEXT NOT NULL,
    "apiHost" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "loginMethod" TEXT NOT NULL DEFAULT 'POST',
    "loginAdapter" TEXT NOT NULL,
    "tokenExtractionPath" TEXT,
    "tokenValidationPath" TEXT,
    "usernameField" TEXT,
    "passwordField" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedAccount" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "vaultPath" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerSession" (
    "brokerSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "managedAccountId" TEXT NOT NULL,
    "upstreamCookies" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerSession_pkey" PRIMARY KEY ("brokerSessionId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "resourceId" TEXT,
    "brokerSessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "ipAddress" TEXT,
    "outcome" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredSecret" (
    "id" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "provider" TEXT NOT NULL DEFAULT 'database',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredSecretRef" (
    "id" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredSecretRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsResource" (
    "id" TEXT NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "awsAccountId" TEXT NOT NULL,
    "roleArn" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "destination" TEXT NOT NULL DEFAULT 'https://console.aws.amazon.com/',
    "issuer" TEXT NOT NULL DEFAULT 'internal-broker',
    "sessionDurationSeconds" INTEGER NOT NULL DEFAULT 3600,
    "externalId" TEXT,
    "brokerCredentialRef" TEXT NOT NULL,
    "stsStrategy" TEXT NOT NULL DEFAULT 'assume_role',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_resourceKey_key" ON "Resource"("resourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoredSecret_secretRef_key" ON "StoredSecret"("secretRef");

-- CreateIndex
CREATE INDEX "StoredSecret_secretRef_idx" ON "StoredSecret"("secretRef");

-- CreateIndex
CREATE INDEX "StoredSecret_kind_idx" ON "StoredSecret"("kind");

-- CreateIndex
CREATE INDEX "StoredSecret_deletedAt_idx" ON "StoredSecret"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredSecretRef_secretRef_key" ON "StoredSecretRef"("secretRef");

-- CreateIndex
CREATE UNIQUE INDEX "AwsResource_resourceKey_key" ON "AwsResource"("resourceKey");

-- AddForeignKey
ALTER TABLE "ManagedAccount" ADD CONSTRAINT "ManagedAccount_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerSession" ADD CONSTRAINT "BrokerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerSession" ADD CONSTRAINT "BrokerSession_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerSession" ADD CONSTRAINT "BrokerSession_managedAccountId_fkey" FOREIGN KEY ("managedAccountId") REFERENCES "ManagedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_brokerSessionId_fkey" FOREIGN KEY ("brokerSessionId") REFERENCES "BrokerSession"("brokerSessionId") ON DELETE SET NULL ON UPDATE CASCADE;
