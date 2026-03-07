const fs = require('fs');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  let after = undefined;
  let total = 0;
  
  do {
    console.log(`Fetching batch... (after: ${after || 'start'})`);
    const url = `https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=pipeline${after ? `&after=${after}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    
    if (!data.results) break;
    
    for (const d of data.results) {
      await prisma.deal.updateMany({
        where: { dealId: d.id },
        data: { pipelineId: d.properties.pipeline }
      });
    }
    
    total += data.results.length;
    after = data.paging?.next?.after;
  } while (after);
  
  const count = await prisma.deal.count({ where: { pipelineId: '705209413' } });
  console.log(`Total deals updated: ${total}`);
  console.log(`Acquisition deals found: ${count}`);
  process.exit(0);
}

main();
