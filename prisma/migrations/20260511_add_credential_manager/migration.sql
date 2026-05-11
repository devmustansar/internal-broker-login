-- CreateTable
CREATE TABLE "SharedCredential" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "loginUrl" TEXT,
    "description" TEXT,
    "encryptedPayload" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialGroupEntry" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialGroupEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialShare" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedCredential_organizationId_idx" ON "SharedCredential"("organizationId");

-- CreateIndex
CREATE INDEX "CredentialGroup_organizationId_idx" ON "CredentialGroup"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialGroup_name_organizationId_key" ON "CredentialGroup"("name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialGroupEntry_credentialId_groupId_key" ON "CredentialGroupEntry"("credentialId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialGroupMember_groupId_userId_key" ON "CredentialGroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialShare_credentialId_userId_key" ON "CredentialShare"("credentialId", "userId");

-- AddForeignKey
ALTER TABLE "SharedCredential" ADD CONSTRAINT "SharedCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGroup" ADD CONSTRAINT "CredentialGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGroupEntry" ADD CONSTRAINT "CredentialGroupEntry_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "SharedCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGroupEntry" ADD CONSTRAINT "CredentialGroupEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CredentialGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGroupMember" ADD CONSTRAINT "CredentialGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CredentialGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGroupMember" ADD CONSTRAINT "CredentialGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialShare" ADD CONSTRAINT "CredentialShare_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "SharedCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialShare" ADD CONSTRAINT "CredentialShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add sessionName to UserAwsPolicy
ALTER TABLE "UserAwsPolicy" ADD COLUMN "sessionName" TEXT;
