-- ============================================================
-- Production patch — 2025-04-23
-- Adds columns introduced by:
--   1. Magic Link adapter (magicLinkExtractionPath, loginPayloadTemplate)
--   2. Session Name (sessionName on AwsResource)
--   3. Available Policy ARNs (availablePolicyArns on AwsResource)
--   4. UserAwsPolicy join table
-- Run once on the production database.
-- All columns are nullable / have defaults — safe to apply with zero downtime.
-- ============================================================

-- 1. Resource table — new columns for magic_link adapter
ALTER TABLE "Resource"
  ADD COLUMN IF NOT EXISTS "magicLinkExtractionPath" TEXT,
  ADD COLUMN IF NOT EXISTS "loginPayloadTemplate"    TEXT;

-- 2. AwsResource table — session name + available policy ARNs
ALTER TABLE "AwsResource"
  ADD COLUMN IF NOT EXISTS "sessionName"         TEXT,
  ADD COLUMN IF NOT EXISTS "availablePolicyArns" TEXT[] NOT NULL DEFAULT '{}';

-- 3. UserAwsPolicy join table (per-user session policy scoping)
CREATE TABLE IF NOT EXISTS "UserAwsPolicy" (
  "id"            TEXT        NOT NULL,
  "userId"        TEXT        NOT NULL,
  "awsResourceId" TEXT        NOT NULL,
  "policyArns"    TEXT[]      NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserAwsPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserAwsPolicy_userId_awsResourceId_key" UNIQUE ("userId", "awsResourceId"),
  CONSTRAINT "UserAwsPolicy_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserAwsPolicy_awsResourceId_fkey"
    FOREIGN KEY ("awsResourceId") REFERENCES "AwsResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
