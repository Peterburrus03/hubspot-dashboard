const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const contactsWithProp = await prisma.contact.findMany({
    where: {
      NOT: { tier1: null }
    }
  });
  console.log(`Contacts with tier1 NOT NULL: ${contactsWithProp.length}`);
  
  const trueCount = contactsWithProp.filter(c => c.tier1 === true).length;
  const falseCount = contactsWithProp.filter(c => c.tier1 === false).length;
  console.log(`- true: ${trueCount}`);
  console.log(`- false: ${falseCount}`);

  // Look for one of the names from HubSpot search
  const taemi = await prisma.contact.findFirst({
    where: {
      OR: [
        { firstName: 'Taemi' },
        { firstName: 'Alicia', lastName: 'Webb Milum' }
      ]
    }
  });
  
  if (taemi) {
    console.log(`Found Taemi/Alicia in DB: tier1 = ${taemi.tier1}, contactId = ${taemi.contactId}`);
  } else {
    console.log('Could not find Taemi or Alicia in DB.');
  }

  process.exit(0);
}

main();
