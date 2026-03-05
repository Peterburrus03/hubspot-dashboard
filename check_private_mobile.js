const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'practice_type',
            operator: 'EQ',
            value: 'Private Mobile'
          }
        ]
      }
    ],
    limit: 5
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
  console.log(`Found ${data.total} companies with type 'Private Mobile'`);
}

main();
