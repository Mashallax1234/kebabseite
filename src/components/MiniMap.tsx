'use client'
// Kleine helle Karte: zeigt einen Laden oder dient im Editor als Positions-Picker.
import { useEffect, useRef } from 'react'
import type { Map as MlMap, Marker } from 'maplibre-gl'
import { MAP, SITE } from '@/lib/config'
import { loadMaplibre } from '@/lib/loadMaplibre'
import { MAP_LOCALE } from '@/lib/mapLocale'

type LatLng = { lat: number; lng: number }

function pinElement() {
  const el = document.createElement('div')
  el.className = 'pin'
  el.innerHTML = '<span></span>'
  return el
}

export function MiniMap({
  lat,
  lng,
  onPick,
  height = 260,
}: {
  lat: number | null
  lng: number | null
  onPick?: (p: LatLng) => void
  height?: number
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const lib = useRef<typeof import('maplibre-gl') | null>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const has = Number.isFinite(lat) && Number.isFinite(lng)
  const picker = !!onPick

  // Marker setzen/verschieben
  function syncMarker() {
    const m = map.current
    const ml = lib.current
    if (!m || !ml) return
    if (!has) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const pos: [number, number] = [lng!, lat!]
    if (!marker.current) {
      marker.current = new ml.Marker({ element: pinElement(), anchor: 'bottom', draggable: picker }).setLngLat(pos).addTo(m)
      if (picker) {
        marker.current.on('dragend', () => {
          const p = marker.current!.getLngLat()
          pickRef.current?.({ lat: p.lat, lng: p.lng })
        })
      }
    } else {
      marker.current.setLngLat(pos)
    }
    if (!m.getBounds().contains(pos)) m.jumpTo({ center: pos, zoom: Math.max(m.getZoom(), 15) })
  }

  useEffect(() => {
    let cancelled = false
    loadMaplibre().then((ml) => {
      if (cancelled || !el.current) return
      lib.current = ml
      const m = new ml.Map({
        container: el.current,
        style: MAP.lightStyle,
        center: has ? [lng!, lat!] : [SITE.mapCenter[1], SITE.mapCenter[0]],
        zoom: has ? 15 : SITE.mapZoom,
        scrollZoom: picker,
        cooperativeGestures: !picker,
        attributionControl: { compact: true },
        locale: MAP_LOCALE,
      })
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      if (picker) {
        m.getCanvas().style.cursor = 'crosshair'
        m.on('click', (e) => pickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
      }
      map.current = m
      syncMarker()
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(syncMarker, [lat, lng])

  return <div className="minimap" ref={el} style={{ height }} />
}
