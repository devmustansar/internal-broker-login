/**
 * ONE-TIME DATA MIGRATION — COMPLETED
 *
 * This script moved User.allowedResourceKeys string[] data into the
 * UserResourceAccess join table. The migration has been executed and
 * the allowedResourceKeys column has been dropped from the schema.
 *
 * This file is preserved for historical reference only.
 * It will NOT work if run again (the source column no longer exists).
 *
 * Originally run with: npx tsx prisma/migrate-resource-access.ts
 */

console.log(
  "⚠️  This migration has already been completed. " +
  "The allowedResourceKeys column has been removed from the User model. " +
  "No action needed."
);
process.exit(0);
