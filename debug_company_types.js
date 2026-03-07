const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  // Search for companies with specific practice types to find their internal values
  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'practice_type',
            operator: 'HAS_PROPERTY'
          }
        ]
      }
    ],
    properties: ['name', 'practice_type'],
    limit: 20
  };
  
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  const data = await res.json();
  console.log('Sample Companies from HubSpot:');
  data.results?.forEach(r => {
    console.log(`- ${r.properties.name}: [${r.properties.practice_type}]`);
  });
}

main();
