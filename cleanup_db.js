const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up contacts with NO lead status...');
  const result = await prisma.contact.deleteMany({
    where: {
      leadStatus: null
    }
  });
  console.log(`Deleted ${result.count} stale contacts.`);
  process.exit(0);
}

main();
