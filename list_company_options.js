const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const res = await fetch('https://api.hubapi.com/crm/v3/properties/companies/practice_type', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await res.json();
  console.log('Valid Options for practice_type:');
  data.options?.forEach(o => {
    console.log(`- ${o.label} (value: ${o.value})`);
  });
}

main();
