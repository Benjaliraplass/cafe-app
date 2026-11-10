import { useEffect, useRef } from 'react'
import { AttributionControl, LngLatBounds, Map as MLMap, Marker, Popup, setWorkerUrl, type MapMouseEvent, type StyleSpecification } from 'maplibre-gl'
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

/**
 * Marcador propio como SVG con la punta exactamente en el centro inferior del elemento.
 * El elemento mantiene el mismo tamaño en ambos estados y el pin crece desde la punta, así
 * seleccionar no desplaza nada.
 */
const PIN_W = 36
const PIN_H = 44
function pinSvg(active: boolean): string {
  const fill = active ? '#111111' : '#ffffff'
  const dot = active ? '#ffffff' : '#111111'
  const scale = active ? 1.18 : 1
  return `<svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 36 44" style="display:block;overflow:visible;transform:scale(${scale});transform-origin:50% 100%;transition:transform .18s ease;filter:drop-shadow(0 4px 6px rgba(0,0,0,.28))">
    <path d="M18 42 C 10 30, 4 24, 4 15.5 A 14 14 0 1 1 32 15.5 C 32 24, 26 30, 18 42 Z" fill="${fill}" stroke="#111111" stroke-width="2"/>
    <circle cx="18" cy="15.5" r="4.5" fill="${dot}"/>
  </svg>`
}
function pinElement(active: boolean): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `width:${PIN_W}px;height:${PIN_H}px;cursor:pointer;`
  el.innerHTML = pinSvg(active)
  return el
}

function userElement(): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.2)'
  return el
}

export const KIND_SHORT: Record<Cafe['kind'], string> = { cafe: 'Cafetería', roastery: 'Tostaduría', both: 'Cafetería y tostaduría' }

function popupHtml(c: Cafe): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const addr = [c.address, c.comuna ?? c.city].filter(Boolean).join(', ')
  const url = c.google_maps_url ?? (c.lat != null && c.lng != null ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` : null)
  return `<div class="dripo-popup">
    <div class="dripo-popup-kind">${esc(KIND_SHORT[c.kind])}</div>
    <div class="dripo-popup-name">${esc(c.name)}</div>
    ${addr ? `<div class="dripo-popup-addr">${esc(addr)}</div>` : ''}
    ${url ? `<a class="dripo-popup-link" href="${esc(url)}" target="_blank" rel="noreferrer">Ver en Google Maps</a>` : ''}
  </div>`
}

export function CafeMap({
  cafes,
  selectedId,
  onSelect,
  bottomInset = 0,
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
  /** null = se tocó el mapa fuera de un pin (cerrar selección). */
  onSelect?: (id: string | null) => void
  /** Píxeles del borde inferior del mapa tapados por el panel; se usan para decidir si un pin está visible. */
  bottomInset?: number
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
  const popup = useRef<Popup | null>(null)
  const cafesRef = useRef(cafes)
  cafesRef.current = cafes
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
    // Tocar el mapa fuera de un pin cierra la selección (los pines detienen la propagación).
    m.on('click', () => onSelectRef.current?.(null))
    map.current = m
    return () => {
      m.remove()
      map.current = null
      markers.current.clear()
      userMarker.current = null
      popup.current = null
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
        if ((el.dataset.active === '1') !== active) el.innerHTML = pinSvg(active)
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

  // Burbuja del pin seleccionado; si el pin queda fuera de la zona visible, desplaza lo mínimo.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const c = selectedId ? cafesRef.current.find((x) => x.id === selectedId) : null
    if (!c || c.lat == null || c.lng == null) {
      popup.current?.remove()
      popup.current = null
      return
    }
    if (!popup.current) {
      popup.current = new Popup({ closeButton: false, closeOnClick: false, offset: [0, -(PIN_H + 2)], maxWidth: '260px', className: 'dripo-popup-wrap' }).addTo(m)
    }
    popup.current.setLngLat([c.lng, c.lat]).setHTML(popupHtml(c))

    const pt = m.project([c.lng, c.lat])
    const { clientWidth: w, clientHeight: h } = m.getContainer()
    const pad = 24
    const popupH = 120
    const visible = pt.x > pad && pt.x < w - pad && pt.y > pad + popupH && pt.y < h - bottomInset - pad
    if (!visible) {
      // Mueve el centro solo lo necesario para que el pin y su burbuja entren en la zona visible.
      const dx = pt.x < pad ? pt.x - pad - 40 : pt.x > w - pad ? pt.x - (w - pad) + 40 : 0
      const dy = pt.y < pad + popupH ? pt.y - (pad + popupH) - 20 : pt.y > h - bottomInset - pad ? pt.y - (h - bottomInset - pad) + 40 : 0
      m.panBy([dx, dy], { duration: 450 })
    }
  }, [selectedId, bottomInset])

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
