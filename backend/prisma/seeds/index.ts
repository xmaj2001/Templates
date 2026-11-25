
import { prisma } from './_client.js';

import { seedUsers } from './users.seed.js';

async function main() {
  console.log('Starting database seed...');

  await seedUsers();

  console.log('Database seed completed.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
