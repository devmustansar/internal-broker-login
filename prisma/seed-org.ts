// Seed script: Creates the default "CodingCops" organization
// Run with: npx ts-node prisma/seed-org.ts
//   or:     npx tsx prisma/seed-org.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Create default organization
  const org = await prisma.organization.upsert({
    where: { name: "CodingCops" },
    update: {},
    create: {
      name: "CodingCops",
      description: "Default organization for CodingCops team",
    },
  });
  console.log(`✅ Organization created: ${org.name} (${org.id})`);

  // 2. Promote the first admin user to super_admin (if any exist)
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
  });

  if (admins.length > 0) {
    const firstAdmin = admins[0];
    await prisma.user.update({
      where: { id: firstAdmin.id },
      data: { role: "super_admin" },
    });
    console.log(`✅ Promoted ${firstAdmin.email} to super_admin`);

    // Assign super_admin to the default org
    await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: firstAdmin.id,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        userId: firstAdmin.id,
        organizationId: org.id,
      },
    });
    console.log(`✅ Assigned ${firstAdmin.email} to ${org.name}`);
  } else {
    console.log("⚠️  No admin users found to promote. You can manually set a user's role to 'super_admin' in the DB.");
  }

  console.log("\n🎉 Seed complete! Existing resources are left unassigned.");
  console.log("   Use the admin panel to assign resources to organizations.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
