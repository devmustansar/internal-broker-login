-- CreateTable
CREATE TABLE "UserResourceAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT,
    "awsResourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserResourceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserResourceAccess_userId_resourceId_key" ON "UserResourceAccess"("userId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserResourceAccess_userId_awsResourceId_key" ON "UserResourceAccess"("userId", "awsResourceId");

-- AddForeignKey
ALTER TABLE "UserResourceAccess" ADD CONSTRAINT "UserResourceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResourceAccess" ADD CONSTRAINT "UserResourceAccess_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResourceAccess" ADD CONSTRAINT "UserResourceAccess_awsResourceId_fkey" FOREIGN KEY ("awsResourceId") REFERENCES "AwsResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
