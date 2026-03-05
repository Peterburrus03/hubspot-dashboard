const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Game Plan parts...');
    
    console.log('1. Fetching Tier 1...');
    const t1 = await prisma.contact.findMany({ where: { tier1: true }, take: 5 });
    console.log('Found:', t1.length);

    console.log('2. Latest engagements...');
    const engs = await prisma.engagement.findMany({
      where: { contactId: { in: t1.map(c => c.contactId) } },
      orderBy: { timestamp: 'desc' },
      distinct: ['contactId']
    });
    console.log('Found:', engs.length);

    console.log('3. Triggers query...');
    const triggers = await prisma.engagement.findMany({
      where: {
        body: { not: null }
      },
      take: 10
    });
    console.log('Found:', triggers.length);

    console.log('4. Enrollments...');
    const enr = await prisma.sequenceEnrollment.findMany({ take: 5 });
    console.log('Found:', enr.length);

    console.log('Success!');
  } catch (err) {
    console.error('FAILED:', err.message);
  }
  process.exit(0);
}

main();
