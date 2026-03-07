const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  console.log(`Using token: ${token ? 'Found' : 'Missing'}`);
  
  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'high_priority_target_lead',
            operator: 'HAS_PROPERTY'
          }
        ]
      }
    ],
    properties: ['firstname', 'lastname', 'high_priority_target_lead'],
    limit: 50
  };
  
  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    
    console.log(`Found ${data.total} contacts with ANY value for high_priority_target_lead`);
    if (data.results) {
      data.results.forEach(r => {
        console.log(`- ${r.properties.firstname} ${r.properties.lastname}: [${r.properties.high_priority_target_lead}]`);
      });
    } else {
      console.log('No results found. Full response:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Search error:', err.message);
  }
}

main();
