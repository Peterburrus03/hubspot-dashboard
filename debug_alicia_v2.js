const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const token = envContent.match(/HUBSPOT_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
  const contactId = '28190907416'; // Alicia Webb Milum
  
  const properties = [
    'firstname', 'lastname', 'email', 'hubspot_owner_id', 
    'specialty', 'contact_status', 'hs_lead_status', 
    'ipad_shipment_date', 'ipad_group', 'ipad_response', 
    'ipad_response_type', 'associatedcompanyid', 
    'high_priority_target_lead'
  ];
  
  // Use basicApi.getById (GET /crm/v3/objects/contacts/{id})
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=${properties.join(',')}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  const data = await res.json();
  const props = data.properties;
  
  console.log('HubSpot Properties (GET /id):');
  console.log(JSON.stringify(props, null, 2));
  
  // Now try searching for HER explicitly by ID using searchApi
  const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'hs_object_id', operator: 'EQ', value: contactId }] }],
      properties: properties
    })
  });
  
  const searchData = await searchRes.json();
  const searchProps = searchData.results[0].properties;
  console.log('HubSpot Properties (Search by ID):');
  console.log(JSON.stringify(searchProps, null, 2));
}

main();
