import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Development-only seed data. This is never run automatically in production —
 * see package.json (`npm run prisma:seed` is a manual, explicit command).
 * Replace with your actual configured police station data before going live.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Refusing to run seed script in production.");
    return;
  }

  await prisma.policeStation.createMany({
    data: [
      {
        organization: "Sample Local Police Station",
        phone: "+910000000000",
        email: "sample.station@example.com",
        latitude: 13.0827,
        longitude: 80.2707,
        address: "Replace with a real configured station address",
        isHeadquarters: false,
        active: true,
      },
      {
        organization: "Sample Police Headquarters",
        phone: "+910000000001",
        email: "sample.hq@example.com",
        latitude: 13.0674,
        longitude: 80.2376,
        address: "Replace with a real configured headquarters address",
        isHeadquarters: true,
        active: true,
      },
    ],
  });

  console.log("Seed complete: sample police stations created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
