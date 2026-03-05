const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'name',
            operator: 'CONTAINS_TOKEN',
            value: 'Mobile'
          }
        ]
      }
    ],
    properties: ['name', 'practice_type'],
    limit: 10
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
  console.log('Companies with "Mobile" in name:');
  data.results?.forEach(r => {
    console.log(`- ${r.properties.name}: Type=[${r.properties.practice_type}]`);
  });
}

main();
