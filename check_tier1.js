const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const tier1Count = await prisma.contact.count({
    where: { tier1: true }
  });
  console.log(`Tier 1 Contacts: ${tier1Count}`);

  const notTier1Count = await prisma.contact.count({
    where: { OR: [{ tier1: false }, { tier1: null }] }
  });
  console.log(`Non-Tier 1 Contacts: ${notTier1Count}`);

  const totalContacts = await prisma.contact.count();
  console.log(`Total Contacts: ${totalContacts}`);

  // Find engagements for Tier 1 contacts
  // We need to find the contactIds first since the relation might not be named 'contact' in the schema or I used it wrong
  const tier1Contacts = await prisma.contact.findMany({
    where: { tier1: true },
    select: { contactId: true }
  });
  const tier1Ids = tier1Contacts.map(c => c.contactId);

  const engagementCount = await prisma.engagement.count({
    where: {
      contactId: { in: tier1Ids }
    }
  });
  console.log(`Engagements with Tier 1 Contacts: ${engagementCount}`);
  
  process.exit(0);
}

main();
