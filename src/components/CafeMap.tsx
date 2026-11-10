import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Cafe } from '@/lib/types'
import { DEFAULT_CENTER, type LatLng } from '@/lib/geo'

/** Marcador propio (gota negra) para no depender de los PNG por defecto de Leaflet. */
function pin(active: boolean) {
  const size = active ? 34 : 26
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? '#111111' : '#ffffff'};border:2px solid #111111;box-shadow:0 4px 10px -4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.3}px;height:${size * 0.3}px;border-radius:50%;background:${active ? '#ffffff' : '#111111'}"></div></div>`,
  })
}

const userIcon = L.divIcon({
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.2)"></div>',
})

export interface MapViewport {
  center: LatLng
  zoom: number
  bounds: L.LatLngBounds
}

export function CafeMap({
  cafes,
  selectedId,
  onSelect,
  center,
  zoom = 13,
  user,
  flyTo,
  onMoveEnd,
  className,
  interactive = true,
}: {
  cafes: Cafe[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  center?: LatLng
  zoom?: number
  user?: LatLng | null
  /** Cuando cambia, el mapa vuela a ese punto. */
  flyTo?: { point: LatLng; zoom?: number; key: number } | null
  onMoveEnd?: (v: MapViewport) => void
  className?: string
  interactive?: boolean
}) {
  const initial = center ?? DEFAULT_CENTER
  const located = useMemo(() => cafes.filter((c) => c.lat != null && c.lng != null), [cafes])
  return (
    <MapContainer
      center={[initial.lat, initial.lng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      className={className}
      style={{ background: '#eceae6' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat!, c.lng!]}
          icon={pin(c.id === selectedId)}
          zIndexOffset={c.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect?.(c.id) }}
        />
      ))}
      {user && <Marker position={[user.lat, user.lng]} icon={userIcon} interactive={false} />}
      {/* Atribución arriba a la izquierda: el panel inferior taparía la posición por defecto. */}
      <AttributionControl position="topleft" prefix={false} />
      <MapEvents onMoveEnd={onMoveEnd} flyTo={flyTo} />
    </MapContainer>
  )
}

function MapEvents({ onMoveEnd, flyTo }: { onMoveEnd?: (v: MapViewport) => void; flyTo?: { point: LatLng; zoom?: number; key: number } | null }) {
  const map = useMap()
  useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onMoveEnd?.({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom(), bounds: map.getBounds() })
    },
  })
  useEffect(() => {
    if (flyTo) map.flyTo([flyTo.point.lat, flyTo.point.lng], flyTo.zoom ?? map.getZoom(), { duration: 0.6 })
  }, [flyTo, map])
  // Leaflet necesita recalcular el tamaño cuando el contenedor aparece con altura definida por CSS.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(t)
  }, [map])
  return null
}

/** Mapa pequeño con un marcador arrastrable, para fijar la ubicación de una cafetería nueva. */
export function PickLocationMap({ value, onChange, className }: { value: LatLng; onChange: (p: LatLng) => void; className?: string }) {
  return (
    <MapContainer center={[value.lat, value.lng]} zoom={16} zoomControl={false} className={className} style={{ background: '#eceae6' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <DraggablePin value={value} onChange={onChange} />
    </MapContainer>
  )
}

function DraggablePin({ value, onChange }: { value: LatLng; onChange: (p: LatLng) => void }) {
  const map = useMap()
  useEffect(() => {
    map.setView([value.lat, value.lng], map.getZoom())
  }, [value.lat, value.lng, map])
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return (
    <Marker
      position={[value.lat, value.lng]}
      icon={pin(true)}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const p = (e.target as L.Marker).getLatLng()
          onChange({ lat: p.lat, lng: p.lng })
        },
      }}
    />
  )
}
