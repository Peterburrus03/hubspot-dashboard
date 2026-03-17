import { readFileSync, writeFileSync } from 'fs'

const newEntries = [
  { name: "Derek Burney", practice: "Bernhard Mark MD (nearest match)", address: "5612 Edwards Ranch Rd, Fort Worth, TX 76109", lat: 32.7106, lng: -97.4065 },
  { name: "Zeev Schwartz", practice: "Veterinary Surgery Specialists", address: "798 NJ-73, Berlin, NJ 08091", lat: 39.7885, lng: -74.9124 },
  { name: "Barbra Easton", practice: "David and Ilene Flaum Eye Institute", address: "210 Crittenden Blvd, Rochester, NY 14642", lat: 43.1227, lng: -77.6244 },
  { name: "Stephanie Holloway", practice: "Veterinary Dental Specialties & Oral Surgery", address: "920 Kingsley Ave, Orange Park, FL 32073", lat: 30.165, lng: -81.7135 },
  { name: "Laura Harvey", practice: "Luminis Health Neurology Annapolis", address: "2000 Medical Pkwy Unit 510, Annapolis, MD 21401", lat: 38.9897, lng: -76.5366 },
  { name: "Danielle Dugat", practice: "Veterinary Specialty Center of Stillwater", address: "401 C Star Blvd, Stillwater, OK 74074", lat: 36.1184, lng: -97.1172 },
  { name: "Corrie Barker", practice: "Oconee Primary Care", address: "1624 Mars Hill Rd, Watkinsville, GA 30677", lat: 33.886, lng: -83.4544 },
  { name: "William Henry", practice: "New England Baptist Outpatient Care Center", address: "40 Allied Dr, Dedham, MA 02026", lat: 42.2252, lng: -71.1716 },
  { name: "Matt Raske", practice: "Hospital For Veterinary Surgery", address: "150 Amsterdam Ave, New York, NY 10023", lat: 40.7754, lng: -73.9847 },
  { name: "Stephen Mehler", practice: "Main Line Health Devon", address: "80 W Lancaster Ave, Devon, PA 19333", lat: 40.0475, lng: -75.418 },
  { name: "Dustin Devine", practice: "New Beginnings Recovery Center (city centroid)", address: "Littleton, CO 80121", lat: 39.6134, lng: -105.0166 },
  { name: "Rebecca Rittenberg", practice: "Charleston Veterinary Internal Medicine", address: "3163 W Montague Ave, N Charleston, SC 29418", lat: 32.8636, lng: -80.0155 },
  { name: "Melissa Eisenschenk", practice: "Pet Dermatology Clinic", address: "9712 63rd Ave N, Maple Grove, MN 55369", lat: 45.0702, lng: -93.403 },
  { name: "Stephanie Correa", practice: "Florida Cancer Specialists & Research Institute", address: "70 W Gore St Suite 100, Orlando, FL 32806", lat: 28.5305, lng: -81.3793 },
  { name: "Justin Harper", practice: "My Personal Physician Boerne", address: "124 E Bandera Rd STE 304, Boerne, TX 78006", lat: 29.7814, lng: -98.7275 },
  { name: "Andrew Sams", practice: "Sams Clinic Veterinary", address: "489 Miller Ave, Mill Valley, CA 94941", lat: 37.8953, lng: -122.5333 },
  { name: "Michael Wong", practice: "First Choice Neurology - Jupiter", address: "601 University Blvd STE 102, Jupiter, FL 33458", lat: 26.8915, lng: -80.1053 },
  { name: "Michelle Morgan", practice: "UCHealth - Margaret M. Moore MD", address: "1400 E Boulder St Suite 500, Colorado Springs, CO 80909", lat: 38.8398, lng: -104.7994 },
  { name: "Katy Burton", practice: "Dr. Robert Burton", address: "7503 S Northshore Dr, Knoxville, TN 37919", lat: 35.9056, lng: -84.0196 },
  { name: "Brian Marchione", practice: "OcuVet", address: "11335 Santa Monica Blvd, Los Angeles, CA 90025", lat: 34.0463, lng: -118.4499 },
  { name: "Tammy (White) Renteria", practice: "Inland Northwest Veterinary Dentistry & Oral Surgery", address: "655 E Best Ave, Coeur d'Alene, ID 83814", lat: 47.701, lng: -116.7755 },
  { name: "Stanley Kim", practice: "Shirley J Kim MD", address: "9092 SW 70th Ln, Gainesville, FL 32608", lat: 29.5893, lng: -82.4383 },
  { name: "Adam Moeser", practice: "Wisconsin Veterinary Neurology & Surgical Center", address: "7625 W Mequon Rd, Mequon, WI 53097", lat: 43.2215, lng: -88.0046 },
  { name: "Kathryn Doerr", practice: "Derrow Dermatology Associates", address: "146 Orange Pl, Maitland, FL 32751", lat: 28.6137, lng: -81.3645 },
  { name: "Erin Ribka (Niemiec)", practice: "Animal Hospital & Dental Clinic", address: "5169 N Blackstone Ave, Fresno, CA 93710", lat: 36.8118, lng: -119.792 },
  { name: "Don Beebe", practice: "Belleview Family Dentistry", address: "8200 E Belleview Ave Suite 465E, Greenwood Village, CO 80111", lat: 39.6232, lng: -104.8938 },
  { name: "John Kirsch", practice: "Coastal Veterinary Surgical Specialists", address: "665 N Tamiami Trl, Nokomis, FL 34275", lat: 27.1322, lng: -82.455 },
  { name: "Elizabeth McNiel", practice: "El Dorado Internal & Family Medicine", address: "5555 E 5th St #101, Tucson, AZ 85711", lat: 32.2294, lng: -110.8742 },
  { name: "William Brown", practice: "Corewell Health Beaumont - Cardiology Novi", address: "39500 W 10 Mile Rd Suite 103, Novi, MI 48375", lat: 42.4691, lng: -83.4364 },
  { name: "Ryan Birks", practice: "Veterinary Orthopedic Surgery Center", address: "1031 Meyer Rd, Wentzville, MO 63385", lat: 38.824, lng: -90.8599 },
  { name: "Kristy Broaddus", practice: "Veterinary Specialists of Hanover", address: "6127 Mechanicsville Tpke, Mechanicsville, VA 23111", lat: 37.6232, lng: -77.3092 },
  { name: "Whit Church", practice: "Gilbert Cardiology", address: "3505 Mercy Rd, Gilbert, AZ 85297", lat: 33.2852, lng: -111.7482 },
  { name: "SeungWoo Jung", practice: "Echo Vet Cardio", address: "2965 Edinger Ave, Tustin, CA 92780", lat: 33.708, lng: -117.8066 },
  { name: "Tacy Rupp", practice: "Veterinary Cardiopulmonary Care Center", address: "415 S Federal Hwy, Pompano Beach, FL 33062", lat: 26.228, lng: -80.104 },
  { name: "Jason King", practice: "Live Oak Veterinary Neurology", address: "335 Stephenson Ave, Savannah, GA 31405", lat: 32.0118, lng: -81.1075 },
  { name: "Andrew Abbo", practice: "Veterinary Cancer Specialists of New England", address: "50 Cohasset Ave, Buzzards Bay, MA 02532", lat: 41.7469, lng: -70.6119 },
  { name: "Anson Tsugawa", practice: "Dog and Cat Dentist, Inc.", address: "20051 Ventura Blvd, Woodland Hills, CA 91364", lat: 34.1718, lng: -118.5704 },
  { name: "Kristin Bannon", practice: "Veterinary Dentistry & Oral Surgery of NM", address: "5971 Jefferson St NE Suite 102, Albuquerque, NM 87109", lat: 35.1509, lng: -106.5937 },
  { name: "Jana Korsch-Dismuke", practice: "Dr. Jana Korsch-Dismukes", address: "2547 John Hawkins Pkwy Suite 103, Hoover, AL 35244", lat: 33.3559, lng: -86.8427 },
  { name: "Eric Davis", practice: "Pediatric Dentistry & Family Orthodontics", address: "5538 N Burdick St, Fayetteville, NY 13066", lat: 43.0424, lng: -76.0181 },
  { name: "Thomas Morrisison", practice: "Thomas 'Ben' Morrison MD", address: "10012 Kennerly Rd Suite 300, St. Louis, MO 63128", lat: 34.4208, lng: -119.6982 },
  { name: "Wesley Cook", practice: "William Joel Cook MD", address: "1600 Midtown Ave, Mt Pleasant, SC 29464", lat: 32.8177, lng: -79.8404 },
  { name: "Michael Bauer", practice: "Bauer Michael MD", address: "200 S Wilcox St #443, Castle Rock, CO 80104", lat: 38.8395, lng: -104.8255 },
  { name: "Kimberly Loyd", practice: "SSM Health DePaul Hospital", address: "12303 De Paul Dr, Bridgeton, MO 63044", lat: 38.7511, lng: -90.434 },
  { name: "Michaela Gruenheid", practice: "United Vision Pet Partners", address: "42 Alpha Dr, Newtown Square, PA 19073", lat: 39.9844, lng: -75.3981 },
  { name: "Paul Berdoulay", practice: "Paul Berdoulay DVM DACVIM", address: "5293 Princess Anne Rd, Virginia Beach, VA 23462", lat: 36.8283, lng: -76.1685 },
  { name: "Seth Bleakley", practice: "CARE Animal Surgery Center", address: "6677 W Thunderbird Rd Bldg L #188, Glendale, AZ 85306", lat: 33.6085, lng: -112.2007 },
  { name: "Douglas Kern", practice: "Dr. Douglas Kern", address: "5 Storm Dr, Windham, ME 04062", lat: 43.8582, lng: -70.4544 },
  { name: "John Davies", practice: "City centroid", address: "Phoenix, OR 97535", lat: 42.2737, lng: -122.8179 },
  { name: "Roy Barnes", practice: "C Ryan Barnes MD", address: "8152 Pleasant Grove Rd, Mechanicsville, VA 23116", lat: 37.6301, lng: -77.3797 },
  { name: "Daniel Linden", practice: "Baptist Primary Care - Yulee", address: "463832 E State Rd 200, Yulee, FL 32097", lat: 30.6255, lng: -81.548 },
  { name: "Jason Reeder", practice: "Northwest Primary Care - West Linn", address: "2020 8th Ave #100, West Linn, OR 97068", lat: 45.3463, lng: -122.6537 },
  { name: "Callie Winders", practice: "Blackford Vet Surgery Referral", address: "1505 Bob Kirby Rd, Knoxville, TN 37931", lat: 35.9459, lng: -84.1214 },
  { name: "Alejandro Aguirre", practice: "Internal Medicine AZ / Geriatric Specialties of AZ", address: "3666 N Miller Rd #113, Scottsdale, AZ 85251", lat: 33.4909, lng: -111.9178 },
  { name: "Danielle Rondeau", practice: "Maine Veterinary Internal Medicine", address: "15 York St Suite 9-102, Biddeford, ME 04005", lat: 43.4937, lng: -70.454 },
  { name: "Adam Ginman", practice: "Northwest Internal Medicine", address: "1551 E Mullan Ave Suite 200-A, Post Falls, ID 83854", lat: 47.7162, lng: -116.9254 },
  { name: "Howard Fischer", practice: "Howard Fishbein MD (nearby - Irvine)", address: "6640 Irvine Center Dr, Irvine, CA 92618", lat: 33.6684, lng: -117.7645 },
  { name: "Dena Lodato", practice: "Amy D. Lado PA-C (city centroid)", address: "7060 Veterans Memorial Blvd, Metairie, LA 70003", lat: 30.005, lng: -90.2193 },
  { name: "Honor Walesby", practice: "Maryland Veterinary Surgical Services", address: "61 Mellor Ave, Catonsville, MD 21228", lat: 39.2692, lng: -76.7327 },
  { name: "Mary Bergh", practice: "Mary J. McCoy MD", address: "6901 W Edgerton Ave, Greenfield, WI 53220", lat: 42.9514, lng: -88.0 },
  { name: "Shane Andrews", practice: "Christopher Ray Andrew NP", address: "1380 E Medical Center Dr, St. George, UT 84790", lat: 37.0968, lng: -113.554 },
  { name: "David Hutcheson", practice: "Desert Hills Podiatric Associates", address: "4816 E Camp Lowell Dr, Tucson, AZ 85712", lat: 32.2643, lng: -110.8902 },
  { name: "Greg Griffin", practice: "City centroid", address: "Springfield, VA 22150", lat: 38.7895, lng: -77.1872 },
  { name: "Dale Smith", practice: "Aaron H. Smith MD", address: "6750 S Highland Dr #120, Cottonwood Heights, UT 84121", lat: 40.6285, lng: -111.8346 },
  { name: "Rebecca Stevens", practice: "Adult Primary Care - South Burlington (UVM)", address: "1 Timber Ln, South Burlington, VT 05403", lat: 44.4534, lng: -73.1678 },
  { name: "Emmett Atwood", practice: "Brentwood East Family Medicine", address: "6716 Nolensville Rd Suite 210, Brentwood, TN 37027", lat: 35.9982, lng: -86.6896 },
  { name: "Merrianne Burtch", practice: "City centroid", address: "Aptos, CA 95003", lat: 36.9769, lng: -121.9019 },
]

// Parse city/state from address
function parseCityState(address) {
  const parts = address.split(',').map(s => s.trim())
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].trim().split(' ')
    return { city: parts[parts.length - 2], state: stateZip[0] }
  }
  if (parts.length === 2) {
    const stateZip = parts[1].trim().split(' ')
    return { city: parts[0], state: stateZip[0] }
  }
  return { city: null, state: null }
}

// Load existing mappings
const existing = JSON.parse(readFileSync('name_mappings.json', 'utf-8'))
const existingNames = new Set(existing.map(m => m.hubspotName.toLowerCase().trim()))

let added = 0, skipped = 0

for (const entry of newEntries) {
  const key = entry.name.toLowerCase().trim()
  if (existingNames.has(key)) {
    skipped++
    continue
  }
  const { city, state } = parseCityState(entry.address)
  existing.push({
    hubspotName: entry.name,
    csvName: entry.practice,
    latitude: entry.lat,
    longitude: entry.lng,
    clinic: entry.practice,
    city,
    state,
  })
  existingNames.add(key)
  added++
}

writeFileSync('name_mappings.json', JSON.stringify(existing, null, 2))
console.log(`Added: ${added} | Skipped (already existed): ${skipped} | Total mappings: ${existing.length}`)
