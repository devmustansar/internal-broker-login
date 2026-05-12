import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing
  await prisma.auditLog.deleteMany();
  await prisma.brokerSession.deleteMany();
  await prisma.managedAccount.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();

  // 1. Users
  const alice = await prisma.user.create({
    data: {
      email: "alice@company.com",
      name: "Alice Admin",
      role: "admin",
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@company.com",
      name: "Bob Developer",
      role: "user",
    },
  });

  const carol = await prisma.user.create({
    data: {
      email: "carol@company.com",
      name: "Carol Viewer",
      role: "readonly",
    },
  });

  // 2. Resources (Apps)
  const prodApp = await prisma.resource.create({
    data: {
      resourceKey: "client-app-prod",
      name: "Client App (Production)",
      description: "Main client-facing application — production environment",
      appHost: "https://app.client.com",
      apiHost: "https://api.client.com",
      loginUrl: "https://api.client.com/auth/login",
      loginAdapter: "json_login",
      environment: "production",
    },
  });

  const stagingApp = await prisma.resource.create({
    data: {
      resourceKey: "client-app-staging",
      name: "Client App (Staging)",
      description: "Client application — staging / QA environment",
      appHost: "https://staging.app.client.com",
      apiHost: "https://staging.api.client.com",
      loginUrl: "https://staging.api.client.com/login",
      loginAdapter: "form_login_csrf",
      environment: "staging",
    },
  });

  const dashboardApp = await prisma.resource.create({
    data: {
      resourceKey: "internal-dashboard",
      name: "Internal Dashboard",
      description: "Internal operations and analytics dashboard",
      appHost: "https://dashboard.internal.company.com",
      apiHost: "https://api.dashboard.internal.company.com",
      loginUrl: "https://dashboard.internal.company.com/login",
      loginAdapter: "form_login_basic",
      environment: "production",
    },
  });

  // 3. Managed Accounts (to be fetched from Vault)
  await prisma.managedAccount.createMany({
    data: [
      {
        resourceId: prodApp.id,
        accountKey: "admin-svc",
        vaultPath: "secret/apps/client-app-prod/admin",
        label: "Admin Service Account",
        role: "admin",
      },
      {
        resourceId: prodApp.id,
        accountKey: "readonly-svc",
        vaultPath: "secret/apps/client-app-prod/readonly",
        label: "Read Only Access",
        role: "readonly",
      },
      {
        resourceId: stagingApp.id,
        accountKey: "dev-account",
        vaultPath: "secret/apps/client-app-staging/dev",
        label: "Shared Dev Account",
        role: "developer",
      },
      {
        resourceId: dashboardApp.id,
        accountKey: "internal-reporting",
        vaultPath: "secret/apps/internal-dashboard/reporting",
        label: "Reporting Account",
        role: "viewer",
      },
    ],
  });

  // 4. Resource Access — assign via join table instead of legacy string array
  // Alice (admin) gets access to all resources
  await prisma.userResourceAccess.createMany({
    data: [
      { userId: alice.id, resourceId: prodApp.id },
      { userId: alice.id, resourceId: stagingApp.id },
      { userId: alice.id, resourceId: dashboardApp.id },
    ],
  });

  // Bob gets staging + dashboard
  await prisma.userResourceAccess.createMany({
    data: [
      { userId: bob.id, resourceId: stagingApp.id },
      { userId: bob.id, resourceId: dashboardApp.id },
    ],
  });

  // Carol gets dashboard only
  await prisma.userResourceAccess.create({
    data: { userId: carol.id, resourceId: dashboardApp.id },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
