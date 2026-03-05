const { refreshDeals } = require('./lib/hubspot/deals');

async function main() {
  console.log('Refreshing deals...');
  const deals = await refreshDeals();
  console.log(`Deals synced: ${deals.length}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
