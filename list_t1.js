const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const t1 = await prisma.contact.findMany({ where: { tier1: true } });
  console.log(`Count: ${t1.length}`);
  t1.forEach(c => console.log(`- ${c.firstName} ${c.lastName} (${c.contactId})`));
  process.exit(0);
}

main();
