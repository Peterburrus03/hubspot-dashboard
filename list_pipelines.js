const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  
  const res = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await res.json();
  data.results.forEach(pipeline => {
    console.log(`Pipeline: ${pipeline.label} (${pipeline.id})`);
    pipeline.stages.forEach(stage => {
      console.log(`  - ${stage.label} (${stage.id})`);
    });
  });
}

main();
