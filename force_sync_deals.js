const { PrismaClient } = require('./generated/prisma');
const { getDeals } = require('./lib/hubspot/deals');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  console.log('Force refreshing deals via script...');
  const deals = await getDeals(true);
  console.log(`Synced ${deals.length} deals.`);
  
  const withPipeline = await prisma.deal.count({
    where: { pipelineId: { not: null } }
  });
  console.log(`Deals with pipelineId in DB: ${withPipeline}`);
  
  const sample = await prisma.deal.findFirst({
    where: { pipelineId: { not: null } }
  });
  if (sample) {
    console.log(`Sample: ${sample.dealName} -> ${sample.pipelineId}`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
