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
    limit: 1
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
  const first = data.results[0];
  console.log(`Type: ${typeof first.properties.high_priority_target_lead}`);
  console.log(`Value: [${first.properties.high_priority_target_lead}]`);
}

main();
