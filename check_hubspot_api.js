const { getClient } = require('./lib/hubspot/client');

async function main() {
  const client = getClient();
  console.log('HubSpot client crm.deals methods:');
  console.log(Object.keys(client.crm.deals));
  if (client.crm.deals.basicApi) {
    console.log('HubSpot client crm.deals.basicApi methods:');
    console.log(Object.keys(client.crm.deals.basicApi));
  }
}

main().catch(console.error);
