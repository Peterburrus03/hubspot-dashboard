const fs = require('fs');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  const contactId = '205103672114'; // Taemi Horikawa
  
  const properties = [
    'firstname', 'lastname', 'email', 'hubspot_owner_id', 
    'specialty', 'contact_status', 'hs_lead_status', 
    'ipad_shipment_date', 'ipad_group', 'ipad_response', 
    'ipad_response_type', 'associatedcompanyid', 
    'high_priority_target_lead'
  ];
  
  console.log(`Fetching contact ${contactId}...`);
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=${properties.join(',')}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  const data = await res.json();
  const props = data.properties;
  
  console.log('HubSpot Properties:');
  console.log(JSON.stringify(props, null, 2));
  
  const isTier1 = props.high_priority_target_lead === 'true';
  console.log(`Is Tier 1? ${isTier1}`);
  
  console.log('Upserting to DB...');
  await prisma.contact.upsert({
    where: { contactId: contactId },
    update: { tier1: isTier1 },
    create: { contactId: contactId, firstName: props.firstname, lastName: props.lastname, tier1: isTier1 }
  });
  
  const updated = await prisma.contact.findUnique({ where: { contactId: contactId } });
  console.log(`DB Tier 1 after sync: ${updated.tier1}`);
  
  process.exit(0);
}

main().catch(console.error);
