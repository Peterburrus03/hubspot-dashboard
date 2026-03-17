'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type AdgLocation = {
  name: string
  clinic: string
  specialty: string
  city: string
  state: string
  market: string
  latitude: number
  longitude: number
  tag: string
}

export type MapContact = {
  contactId: string
  name: string
  specialty: string | null
  ownerName: string
  leadStatus: string | null
  tier1: boolean | null
  latitude: number
  longitude: number
  clinic: string | null
  market: string | null
  practiceTag: string | null
  disposition: 'interested' | 'fairGame' | 'notNow' | 'notInterested'
}

const DISPOSITION_COLORS: Record<string, string> = {
  interested: '#16a34a',
  fairGame: '#0284c7',
  notNow: '#d97706',
  notInterested: '#dc2626',
}

const DISPOSITION_LABELS: Record<string, string> = {
  interested: 'Interested',
  fairGame: 'Fair Game',
  notNow: 'Not Now',
  notInterested: 'Not Interested',
}

export default function LeafletMap({
  contacts,
  adgLocations = [],
  showAdg = true,
}: {
  contacts: MapContact[]
  adgLocations?: AdgLocation[]
  showAdg?: boolean
}) {
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* ADG / AOSN locations layer */}
      {showAdg && adgLocations.map((loc, i) => (
        <CircleMarker
          key={`adg-${i}`}
          center={[loc.latitude, loc.longitude]}
          radius={8}
          pathOptions={{
            fillColor: '#7c3aed',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }}
        >
          <Popup maxWidth={240}>
            <div style={{ fontFamily: 'inherit', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 2 }}>★ ADG / AOSN</div>
              <div style={{ fontWeight: 700, color: '#111827', marginBottom: 2 }}>{loc.name}</div>
              <div style={{ color: '#6b7280', marginBottom: 2 }}>{loc.specialty}</div>
              {loc.clinic && <div style={{ color: '#6b7280', marginBottom: 2 }}>{loc.clinic}</div>}
              <div style={{ color: '#6b7280' }}>{loc.city}, {loc.state}</div>
              {loc.market && <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{loc.market}</div>}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {contacts.map(c => (
        <CircleMarker
          key={c.contactId}
          center={[c.latitude, c.longitude]}
          radius={c.tier1 ? 9 : 6}
          pathOptions={{
            fillColor: DISPOSITION_COLORS[c.disposition] ?? '#6b7280',
            color: 'white',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.85,
          }}
        >
          <Popup maxWidth={240}>
            <div style={{ fontFamily: 'inherit', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                {c.tier1 && <span style={{ color: '#ca8a04' }}>★ </span>}
                {c.name}
              </div>
              <div style={{ color: '#6b7280', marginBottom: 2 }}>{c.specialty ?? '—'}</div>
              {c.clinic && <div style={{ color: '#6b7280', marginBottom: 2 }}>{c.clinic}</div>}
              <div style={{ marginBottom: 2 }}>
                <span style={{ color: DISPOSITION_COLORS[c.disposition], fontWeight: 700 }}>
                  {DISPOSITION_LABELS[c.disposition]}
                </span>
              </div>
              {c.leadStatus && (
                <div style={{ color: '#6b7280', marginBottom: 2 }}>Status: {c.leadStatus}</div>
              )}
              <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.ownerName}</div>
              {c.market && <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{c.market}</div>}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

