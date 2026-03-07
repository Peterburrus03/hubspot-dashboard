const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'hs_lead_status', operator: 'HAS_PROPERTY' }] }],
      properties: ['state', 'hs_state', 'city', 'hs_city', 'zip', 'address'],
      limit: 10
    })
  });
  
  const data = await res.json();
  console.log('Contact Location Debug:');
  data.results?.forEach(r => {
    console.log(`- ${r.properties.firstname} ${r.properties.lastname}: state=[${r.properties.state}] hs_state=[${r.properties.hs_state}] city=[${r.properties.city}]`);
  });

  const res2 = await fetch('https://api.hubapi.com/crm/v3/objects/deals?limit=10&properties=state,city,dealname', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data2 = await res2.json();
  console.log('\nDeal Location Debug:');
  data2.results?.forEach(r => {
    console.log(`- ${r.properties.dealname}: state=[${r.properties.state}] city=[${r.properties.city}]`);
  });
}

main();
