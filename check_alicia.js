const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contact.findUnique({
    where: { contactId: '28190907416' }
  });
  console.log(`Alicia 28190907416: ${c ? 'FOUND' : 'NOT FOUND'}`);
  if (c) {
    console.log(`tier1: ${c.tier1}`);
  }
  process.exit(0);
}

main();
