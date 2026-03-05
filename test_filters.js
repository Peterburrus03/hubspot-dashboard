const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing filters query...');
    const [owners, specialties, companyTypes, leadStatuses, contactStates, dealStates] = await Promise.all([
      prisma.owner.findMany({ orderBy: { lastName: 'asc' } }),
      prisma.contact.findMany({
        where: { specialty: { not: null } },
        select: { specialty: true },
        distinct: ['specialty'],
        orderBy: { specialty: 'asc' },
      }),
      prisma.company.findMany({
        where: { companyType: { not: null } },
        select: { companyType: true },
        distinct: ['companyType'],
        orderBy: { companyType: 'asc' },
      }),
      prisma.contact.findMany({
        where: { leadStatus: { not: null } },
        select: { leadStatus: true },
        distinct: ['leadStatus'],
        orderBy: { leadStatus: 'asc' },
      }),
      prisma.contact.findMany({
        where: { state: { not: null } },
        select: { state: true },
        distinct: ['state'],
      }),
      prisma.deal.findMany({
        where: { state: { not: null } },
        select: { state: true },
        distinct: ['state'],
      }),
    ]);
    console.log('Success! Found:');
    console.log(`- Owners: ${owners.length}`);
    console.log(`- Specialties: ${specialties.length}`);
    console.log(`- Company Types: ${companyTypes.length}`);
    console.log(`- Contact States: ${contactStates.length}`);
    console.log(`- Deal States: ${dealStates.length}`);
  } catch (err) {
    console.error('CRASHED:', err.message);
  }
  process.exit(0);
}

main();
