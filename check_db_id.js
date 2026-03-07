const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contact.findUnique({
    where: { contactId: '876709' }
  });
  console.log(`Contact 876709: ${c ? 'FOUND' : 'NOT FOUND'}`);
  if (c) {
    console.log(`Name: ${c.firstName} ${c.lastName}, tier1: ${c.tier1}`);
  }
  process.exit(0);
}

main();
