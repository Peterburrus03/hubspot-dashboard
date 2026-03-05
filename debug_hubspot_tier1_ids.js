const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'high_priority_target_lead',
            operator: 'EQ',
            value: 'true'
          }
        ]
      }
    ],
    properties: ['firstname', 'lastname', 'high_priority_target_lead'],
    limit: 10
  };
  
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  const data = await res.json();
  data.results.forEach(r => {
    console.log(`- ${r.properties.firstname} ${r.properties.lastname} (id: ${r.id}): [${r.properties.high_priority_target_lead}]`);
  });
}

main();
