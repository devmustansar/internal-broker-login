import { PrismaClient } from "@prisma/client";

// Idempotent: registers the portfolio hub (served at /portfolio by this app)
// as a Resource so it can be assigned to users like any other app.
// Safe to run on production — unlike seed.ts it deletes nothing.
//   npx tsx prisma/seed-portfolio.ts

const prisma = new PrismaClient();

async function main() {
  const resource = await prisma.resource.upsert({
    where: { resourceKey: "portfolio" },
    update: {},
    create: {
      resourceKey: "portfolio",
      name: "Tech Stack Portfolio",
      description: "CodingCops portfolio hub — projects, sectors and tech stack",
      appHost: "/portfolio",
      apiHost: "/portfolio",
      loginUrl: "/portfolio/",
      loginAdapter: "internal_static",
      environment: "production",
    },
  });
  console.log(`Portfolio resource ready: ${resource.id}`);
}

main().finally(() => prisma.$disconnect());
