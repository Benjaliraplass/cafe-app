import { useEffect, useRef } from 'react'
import { AttributionControl, LngLatBounds, Map as MLMap, Marker, setWorkerUrl, type MapMouseEvent, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre busca su worker junto al módulo principal; con Vite el chunk cambia de nombre y de carpeta,
// así que le pasamos la URL del worker empaquetado (es un archivo autocontenido).
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

setWorkerUrl(maplibreWorkerUrl)
import type { Cafe } from '@/lib/types'
import { DEFAULT_CENTER, type LatLng } from '@/lib/geo'
import { cn } from '@/lib/utils'

/**
 * Mapa vectorial con OpenFreeMap (gratis, sin API key). "positron" es gris claro y calza con
 * el diseño; "bright" es la alternativa más colorida tipo Apple Maps.
 */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** En desarrollo, `?offlinemap` usa un estilo vacío para probar marcadores sin red (QA en sandbox). */
function mapStyle(): string | StyleSpecification {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('offlinemap')) {
    return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eceae6' } }] }
  }
  return MAP_STYLE
}

export interface MapViewport {
  center: LatLng
  zoom: number
  bounds: LngLatBounds
}

/** Marcador propio: gota negra (seleccionado) o blanca con borde. */
function pinElement(active: boolean): HTMLElement {
  const size = active ? 34 : 26
  const el = document.createElement('div')
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;transition:transform .2s;`
  el.innerHTML = `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? '#111111' : '#ffffff'};border:2px solid #111111;box-shadow:0 4px 10px -4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.3}px;height:${size * 0.3}px;border-radius:50%;background:${active ? '#ffffff' : '#111111'}"></div></div>`
  return el
}

function userElement(): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.2)'
  return el
}

export function CafeMap({
  cafes,
  selectedId,
  onSelect,
  center,
  zoom = 13,
  user,
  flyTo,
  fitTo,
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
  /** Cuando cambia `key`, el mapa vuela a ese punto. */
  flyTo?: { point: LatLng; zoom?: number; key: number } | null
  /** Cuando cambia `key`, encuadra todos los puntos (con margen). */
  fitTo?: { points: LatLng[]; key: number } | null
  onMoveEnd?: (v: MapViewport) => void
  className?: string
  interactive?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const markers = useRef<Map<string, Marker>>(new Map())
  const userMarker = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  const onMoveEndRef = useRef(onMoveEnd)
  onSelectRef.current = onSelect
  onMoveEndRef.current = onMoveEnd

  // Crear el mapa una vez
  useEffect(() => {
    if (!container.current || map.current) return
    const c = center ?? DEFAULT_CENTER
    const m = new MLMap({
      container: container.current,
      style: mapStyle(),
      center: [c.lng, c.lat],
      zoom,
      attributionControl: false,
      interactive,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    })
    m.addControl(new AttributionControl({ compact: true }), 'top-left')
    m.on('moveend', () => {
      const ce = m.getCenter()
      onMoveEndRef.current?.({ center: { lat: ce.lat, lng: ce.lng }, zoom: m.getZoom(), bounds: m.getBounds() })
    })
    map.current = m
    return () => {
      m.remove()
      map.current = null
      markers.current.clear()
      userMarker.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marcadores de cafeterías (se reconcilian por id)
  useEffect(() => {
    const m = map.current
    if (!m) return
    const seen = new Set<string>()
    for (const c of cafes) {
      if (c.lat == null || c.lng == null) continue
      seen.add(c.id)
      const active = c.id === selectedId
      let mk: Marker | undefined = markers.current.get(c.id)
      if (!mk) {
        const el = pinElement(active)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current?.(c.id)
        })
        const created = new Marker({ element: el, anchor: 'bottom' }).setLngLat([c.lng, c.lat]).addTo(m)
        markers.current.set(c.id, created)
        mk = created
      } else {
        mk.setLngLat([c.lng, c.lat])
        const el = mk.getElement()
        const wantActive = el.dataset.active === '1'
        if (wantActive !== active) {
          const fresh = pinElement(active)
          el.innerHTML = fresh.innerHTML
          el.style.width = fresh.style.width
          el.style.height = fresh.style.height
        }
      }
      mk.getElement().dataset.active = active ? '1' : '0'
      mk.getElement().style.zIndex = active ? '10' : '1'
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.remove()
        markers.current.delete(id)
      }
    }
  }, [cafes, selectedId])

  // Punto del usuario
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!user) {
      userMarker.current?.remove()
      userMarker.current = null
      return
    }
    if (!userMarker.current) {
      userMarker.current = new Marker({ element: userElement() }).setLngLat([user.lng, user.lat]).addTo(m)
    } else {
      userMarker.current.setLngLat([user.lng, user.lat])
    }
  }, [user])

  // Volar a un punto
  useEffect(() => {
    const m = map.current
    if (!m || !flyTo) return
    m.flyTo({ center: [flyTo.point.lng, flyTo.point.lat], zoom: flyTo.zoom ?? m.getZoom(), duration: 700 })
  }, [flyTo])

  // Encuadrar varios puntos
  useEffect(() => {
    const m = map.current
    if (!m || !fitTo || fitTo.points.length === 0) return
    if (fitTo.points.length === 1) {
      m.flyTo({ center: [fitTo.points[0].lng, fitTo.points[0].lat], zoom: 14, duration: 700 })
      return
    }
    const b = new LngLatBounds()
    for (const p of fitTo.points) b.extend([p.lng, p.lat])
    m.fitBounds(b, { padding: { top: 70, right: 40, bottom: 90, left: 40 }, maxZoom: 15, duration: 700 })
  }, [fitTo])

  // El CSS de MapLibre fuerza position: relative en su contenedor; por eso el contenedor real
  // va dentro de un wrapper que recibe las clases del llamador.
  return (
    <div className={cn('relative', className)}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

/** Mapa pequeño con un marcador arrastrable, para fijar la ubicación de una cafetería nueva. */
export function PickLocationMap({ value, onChange, className }: { value: LatLng; onChange: (p: LatLng) => void; className?: string }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!container.current || map.current) return
    const m = new MLMap({
      container: container.current,
      style: mapStyle(),
      center: [value.lng, value.lat],
      zoom: 16,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    m.addControl(new AttributionControl({ compact: true }), 'top-left')
    const mk = new Marker({ element: pinElement(true), anchor: 'bottom', draggable: true }).setLngLat([value.lng, value.lat]).addTo(m)
    mk.on('dragend', () => {
      const p = mk.getLngLat()
      onChangeRef.current({ lat: p.lat, lng: p.lng })
    })
    m.on('click', (e: MapMouseEvent) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
    map.current = m
    marker.current = mk
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    marker.current?.setLngLat([value.lng, value.lat])
    map.current?.easeTo({ center: [value.lng, value.lat], duration: 400 })
  }, [value.lat, value.lng])

  return (
    <div className={cn('relative', className)}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
