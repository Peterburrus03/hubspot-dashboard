const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const cId = '28190907416'; // Alicia
  const e = await prisma.engagement.count({ where: { contactId: cId } });
  console.log(`Engagements for Alicia: ${e}`);
  process.exit(0);
}

main();
