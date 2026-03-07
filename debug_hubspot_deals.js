const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals?limit=5&properties=dealname,dealstage,pipeline', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data.results, null, 2));
}

main();
