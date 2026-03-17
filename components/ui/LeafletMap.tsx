'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
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
  interested:    '#16a34a',
  fairGame:      '#0284c7',
  notNow:        '#d97706',
  notInterested: '#dc2626',
}

const DISPOSITION_LABELS: Record<string, string> = {
  interested:    'Interested',
  fairGame:      'Fair Game',
  notNow:        'Not Now',
  notInterested: 'Not Interested',
}

// Child component — uses useMap() which only works inside MapContainer
function MapController({ flyTo }: { flyTo: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (flyTo) map.flyTo([flyTo.lat, flyTo.lng], 13, { duration: 1.2 })
  }, [flyTo, map])
  return null
}

export default function LeafletMap({
  contacts,
  adgLocations = [],
  showAdg = true,
  flyTo = null,
  onContactClick,
}: {
  contacts: MapContact[]
  adgLocations?: AdgLocation[]
  showAdg?: boolean
  flyTo?: { lat: number; lng: number } | null
  onContactClick?: (contact: MapContact) => void
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

      <MapController flyTo={flyTo} />

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

      {/* Prospect contacts layer */}
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
          eventHandlers={{
            click: () => onContactClick?.(c),
          }}
        >
          <Popup maxWidth={220}>
            <div style={{ fontFamily: 'inherit', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                {c.tier1 && <span style={{ color: '#ca8a04' }}>★ </span>}
                {c.name}
              </div>
              <div style={{ color: '#6b7280', marginBottom: 2 }}>{c.specialty ?? '—'}</div>
              {c.clinic && <div style={{ color: '#6b7280', marginBottom: 2 }}>{c.clinic}</div>}
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: DISPOSITION_COLORS[c.disposition], fontWeight: 700 }}>
                  {DISPOSITION_LABELS[c.disposition]}
                </span>
              </div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.ownerName}</div>
              {onContactClick && (
                <button
                  onClick={() => onContactClick(c)}
                  style={{
                    marginTop: 8, width: '100%', padding: '4px 0',
                    background: '#2563eb', color: 'white', border: 'none',
                    borderRadius: 6, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '0.05em',
                  }}
                >
                  VIEW OUTREACH HISTORY
                </button>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
