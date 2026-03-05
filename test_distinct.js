const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  try {
    const t1 = await prisma.contact.findMany({ where: { tier1: true }, select: { contactId: true } });
    const ids = t1.map(c => c.contactId);
    
    console.log('Testing problematic query...');
    const engs = await prisma.engagement.findMany({
      where: { contactId: { in: ids } },
      orderBy: { timestamp: 'desc' },
      distinct: ['contactId']
    });
    console.log('Success:', engs.length);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
  process.exit(0);
}

main();
