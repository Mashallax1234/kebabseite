'use client'
// Die große Karte im Stil eines GTA-Pausenmenüs.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl'
import { NEARBY, SITE } from '@/lib/config'
import { fmtNum, fmtPrice, fmtScore, plural } from '@/lib/format'
import { gtaStyle } from '@/lib/gtaStyle'
import { loadMaplibre } from '@/lib/loadMaplibre'
import { MAP_LOCALE } from '@/lib/mapLocale'
import { distanceKm } from '@/lib/validate'
import type { RankedRow } from '@/lib/scores'
import type { Criterion } from '@/lib/data/types'

type LatLng = { lat: number; lng: number }
type MapLib = typeof import('maplibre-gl')

const KM_PER_DEG_LAT = 111.32

/** Ausdehnung eines Kreises in Grad (Längengrade werden zu den Polen hin schmaler) */
function circleSpan(center: LatLng, km: number) {
  return { dLat: km / KM_PER_DEG_LAT, dLng: km / (KM_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180)) }
}

/** Kreis als Polygon für MapLibre (das kann von sich aus keine Kreise in Metern) */
function circle(center: LatLng, km: number, steps = 64): GeoJSON.Feature {
  const { dLat, dLng } = circleSpan(center, km)
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI
    return [center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]
  })
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

function blipKind(row: RankedRow) {
  const v = row.agg.overall
  if (v == null || row.rank == null) return 'none'
  if (row.rank <= 3) return 'gold'
  if (v >= 8) return 'green'
  if (v >= 6) return 'white'
  return 'red'
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const emptyLine: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function GtaMap({
  ranking,
  criteria,
  username,
  initialSlug,
}: {
  ranking: RankedRow[]
  criteria: Criterion[]
  username: string | null
  initialSlug: string | null
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [player, setPlayer] = useState<LatLng | null>(null)
  const [nearby, setNearby] = useState(false) // nur Läden im Fußweg-Radius zeigen
  const [notice, setNotice] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const [mapTick, setMapTick] = useState(0) // zählt hoch, sobald die Karte bereit ist

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const libRef = useRef<MapLib | null>(null)
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement; base: string }>())
  const playerMarker = useRef<Marker | null>(null)

  const rows = useMemo(
    () => (nearby && player ? ranking.filter((r) => distanceKm(player, r.shop) <= NEARBY.radiusKm) : ranking),
    [ranking, nearby, player],
  )
  const selected = rows.find((r) => r.shop.id === selectedId) ?? null
  const rated = rows.filter((r) => r.rank != null)
  const avg = rated.length ? rated.reduce((s, r) => s + (r.agg.overall ?? 0), 0) / rated.length : null

  function select(id: string) {
    setSelectedId(id)
    const row = rows.find((r) => r.shop.id === id)
    const map = mapRef.current
    // Auf dem Handy liegt unten die Info-Karte, also etwas höher zentrieren
    const offset: [number, number] = window.innerWidth <= 760 ? [0, -120] : [0, 0]
    if (row && map) map.flyTo({ center: [row.shop.lng, row.shop.lat], zoom: Math.max(map.getZoom(), 14), offset, duration: 700, essential: true })
  }
  function step(dir: 1 | -1) {
    if (!rows.length) return
    const i = rows.findIndex((r) => r.shop.id === selectedId)
    const next = i < 0 ? (dir > 0 ? 0 : rows.length - 1) : (i + dir + rows.length) % rows.length
    select(rows[next].shop.id)
  }
  function findPlayer(then: (p: LatLng) => void) {
    if (!navigator.geolocation) return setNotice('Dein Browser kann keinen Standort.')
    setNotice('Suche Standort …')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPlayer(p)
        setNotice(null)
        then(p)
      },
      (err) => setNotice(err.code === err.PERMISSION_DENIED ? 'Standort-Freigabe abgelehnt.' : 'Standort nicht verfügbar.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  function locate() {
    findPlayer((p) => mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 14, duration: 700 }))
  }
  function toggleNearby() {
    if (nearby) {
      setNearby(false)
      setNotice(null)
      return
    }
    findPlayer((p) => {
      setNearby(true)
      const n = ranking.filter((r) => distanceKm(p, r.shop) <= NEARBY.radiusKm).length
      if (!n) setNotice(`Kein Laden in ${NEARBY.minutes} Min. Fußweg. Zeit für einen Vorschlag?`)
      const { dLat, dLng } = circleSpan(p, NEARBY.radiusKm)
      const wide = window.innerWidth > 760
      mapRef.current?.fitBounds(
        [[p.lng - dLng, p.lat - dLat], [p.lng + dLng, p.lat + dLat]],
        { padding: { top: wide ? 220 : 200, bottom: 70, left: 40, right: wide ? 340 : 40 }, duration: 700 },
      )
    })
  }
  const back = () => (selectedId ? setSelectedId(null) : router.push('/'))

  // Für Listener, die nur einmal registriert werden
  const live = useRef({ select, step, locate, toggleNearby, back, selected })
  live.current = { select, step, locate, toggleNearby, back, selected }

  // Karte einmalig aufbauen
  useEffect(() => {
    setLegendOpen(window.innerWidth > 760)
    let cancelled = false
    let map: MlMap | null = null
    loadMaplibre().then((ml) => {
      if (cancelled || !mapEl.current) return
      libRef.current = ml
      map = new ml.Map({
        container: mapEl.current,
        style: gtaStyle(),
        center: [SITE.mapCenter[1], SITE.mapCenter[0]],
        zoom: SITE.mapZoom,
        minZoom: 8,
        maxZoom: 18,
        keyboard: false,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        locale: MAP_LOCALE,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-left')
      map.on('load', () => {
        map!.addSource('nearby', { type: 'geojson', data: emptyLine })
        map!.addLayer({ id: 'nearby-fill', type: 'fill', source: 'nearby', paint: { 'fill-color': '#ff4f9a', 'fill-opacity': 0.08 } })
        map!.addLayer({
          id: 'nearby-edge',
          type: 'line',
          source: 'nearby',
          paint: { 'line-color': '#ff4f9a', 'line-width': 2, 'line-dasharray': [2, 2] },
        })
        map!.addSource('route', { type: 'geojson', data: emptyLine })
        map!.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ff4f9a', 'line-width': 5, 'line-dasharray': [0.1, 2] },
        })
        setReady(true)
      })
      mapRef.current = map

      // Erstmal alle Läden ins Bild holen oder direkt den gewünschten anfliegen
      const all = ranking
      const pre = initialSlug ? all.find((r) => r.shop.slug === initialSlug) : null
      if (pre) {
        live.current.select(pre.shop.id)
      } else if (all.length) {
        const b = new ml.LngLatBounds()
        all.forEach((r) => b.extend([r.shop.lng, r.shop.lat]))
        const wide = window.innerWidth > 760
        map.fitBounds(b, { padding: { top: wide ? 220 : 200, bottom: 70, left: 40, right: wide ? 340 : 40 }, maxZoom: 14, duration: 0 })
      }
      setMapTick((t) => t + 1)
    })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
    }
  }, [])

  // Blips neu bauen, wenn die Karte da ist oder das Ranking wechselt
  useEffect(() => {
    const map = mapRef.current
    const ml = libRef.current
    if (!map || !ml) return
    markers.current.forEach(({ marker }) => marker.remove())
    markers.current.clear()
    rows.forEach((row) => {
      const el = document.createElement('div')
      el.className = 'blip-wrap'
      el.innerHTML = `<div class="blip blip-${blipKind(row)}"><span>${row.rank ?? '?'}</span></div><span class="blip-label">${esc(row.shop.name)}</span>`
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        live.current.select(row.shop.id)
      })
      const base = row.rank ? String(1000 - row.rank) : '1'
      el.style.zIndex = base
      const marker = new ml.Marker({ element: el, anchor: 'center' }).setLngLat([row.shop.lng, row.shop.lat]).addTo(map)
      markers.current.set(row.shop.id, { marker, el, base })
    })
  }, [rows, mapTick])

  // Auswahl hervorheben
  useEffect(() => {
    markers.current.forEach(({ el, base }, id) => {
      const sel = id === selectedId
      el.classList.toggle('is-sel', sel)
      el.style.zIndex = sel ? '5000' : base
    })
  }, [selectedId, rows, mapTick])

  // Spieler-Pfeil
  useEffect(() => {
    const map = mapRef.current
    const ml = libRef.current
    if (!map || !ml || !player) return
    if (!playerMarker.current) {
      const el = document.createElement('div')
      el.className = 'player-wrap'
      el.innerHTML =
        '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      playerMarker.current = new ml.Marker({ element: el }).setLngLat([player.lng, player.lat]).addTo(map)
    } else {
      playerMarker.current.setLngLat([player.lng, player.lat])
    }
  }, [player])

  // Wegpunkt-Linie vom Spieler zum gewählten Laden
  useEffect(() => {
    const src = ready ? (mapRef.current?.getSource('route') as GeoJSONSource | undefined) : undefined
    if (!src) return
    src.setData(
      player && selected
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[player.lng, player.lat], [selected.shop.lng, selected.shop.lat]] } }
        : emptyLine,
    )
  }, [ready, player, selected])

  // Fußweg-Radius um den Spieler
  useEffect(() => {
    const src = ready ? (mapRef.current?.getSource('nearby') as GeoJSONSource | undefined) : undefined
    src?.setData(nearby && player ? circle(player, NEARBY.radiusKm) : emptyLine)
  }, [ready, nearby, player])

  // Tastatur wie im Spiel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
      const { selected: sel, step: go, locate: loc, toggleNearby: near, back: esc } = live.current
      const map = mapRef.current
      switch (e.key) {
        case 'Escape': esc(); break
        case 'ArrowRight': case 'e': case 'E': go(1); break
        case 'ArrowLeft': case 'q': case 'Q': go(-1); break
        case 'Enter': if (sel) router.push(`/laden/${sel.shop.slug}`); break
        case 'g': case 'G': if (sel) window.open(sel.shop.mapsUrl, '_blank', 'noopener'); break
        case 'p': case 'P': loc(); break
        case 'n': case 'N': near(); break
        case 'l': case 'L': setLegendOpen((o) => !o); break
        case '+': case '=': map?.zoomIn(); break
        case '-': map?.zoomOut(); break
        default: return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  const dist = player && selected ? distanceKm(player, selected.shop) : null
  const price = selected ? fmtPrice(selected.shop.doenerPrice) : null

  return (
    <div className="gta">
      <div className="gta-map" ref={mapEl} />
      <div className="gta-shade" />

      <header className="gta-top">
        <Link className="gta-brand" href="/">
          {SITE.name}
        </Link>
        <nav className="gta-tabs">
          <Link className="active" href="/karte">Karte</Link>
          <Link href="/">Ranking</Link>
          <Link href="/vorschlagen">Vorschlagen</Link>
          {username ? <Link href="/profil">Profil</Link> : <Link href="/login">Login</Link>}
        </nav>
        <div className="gta-player">
          <b>{username ?? 'Gast'}</b>
          <span>
            {rows.length} Läden · Ø {fmtScore(avg)}
          </span>
        </div>
      </header>

      <div className="gta-title">
        <h1>Döner-Karte</h1>
        <p>
          {nearby ? `${NEARBY.minutes} Min. zu Fuß · ${plural(rows.length, 'Laden', 'Läden')}` : `${SITE.city} · ${rated.length} bewertet`}
        </p>
        <div className="gta-switch" role="group" aria-label="Welche Läden">
          <button className={nearby ? '' : 'on'} onClick={() => nearby && toggleNearby()}>
            Alle
          </button>
          <button className={nearby ? 'on' : ''} onClick={() => !nearby && toggleNearby()}>
            In meiner Nähe · {NEARBY.minutes} Min
          </button>
        </div>
        {notice && <p className="gta-notice">{notice}</p>}
      </div>

      <button className="gta-legend-toggle" onClick={() => setLegendOpen((o) => !o)}>
        {legendOpen ? 'Legende zu' : 'Legende'}
      </button>
      <aside className={'gta-legend' + (legendOpen ? ' open' : '')}>
        <h2>Legende</h2>
        <ul className="gta-keys">
          <li><i className="blip blip-gold mini" />Top 3</li>
          <li><i className="blip blip-green mini" />8 und besser</li>
          <li><i className="blip blip-white mini" />6 bis 8</li>
          <li><i className="blip blip-red mini" />unter 6</li>
          <li><i className="blip blip-none mini" />ohne Wertung</li>
          <li><i className="player-mini" />Du</li>
        </ul>
        <h2>Läden</h2>
        <ol className="gta-list">
          {rows.map((r) => (
            <li key={r.shop.id} className={r.shop.id === selectedId ? 'sel' : ''} onClick={() => select(r.shop.id)}>
              <span className="n">{r.rank ?? '–'}</span>
              <span className="nm">{r.shop.name}</span>
              <span className="sc">{fmtScore(r.agg.overall)}</span>
            </li>
          ))}
        </ol>
      </aside>

      {selected && (
        <section className="gta-card">
          {selected.shop.imageUrl && <img className="gta-photo" src={selected.shop.imageUrl} alt="" />}
          <div className="gta-card-head">
            <span className="gta-rank">{selected.rank ? '#' + selected.rank : '–'}</span>
            <div>
              <h2>{selected.shop.name}</h2>
              <p>
                {selected.shop.district}
                {price && ` · Döner ${price}`}
              </p>
            </div>
            <span className="gta-score">{fmtScore(selected.agg.overall)}</span>
          </div>
          <dl className="gta-stats">
            {criteria.map((c) => {
              const v = selected.agg.perCriterion[c.key]
              return (
                <div key={c.key}>
                  <dt>{c.label}</dt>
                  <dd>
                    <span className="gta-meter">
                      <i style={{ width: `${(v ?? 0) * 10}%` }} />
                    </span>
                    {fmtNum(v)}
                  </dd>
                </div>
              )
            })}
          </dl>
          <p className="gta-addr">
            {selected.shop.address}
            {dist != null && ` · ${dist.toFixed(1).replace('.', ',')} km Luftlinie`}
          </p>
          <div className="gta-card-actions">
            <Link className="gta-btn" href={`/laden/${selected.shop.slug}`}>
              <kbd>Enter</kbd>Details
            </Link>
            <a className="gta-btn pink" href={selected.shop.mapsUrl} target="_blank" rel="noopener noreferrer">
              <kbd>G</kbd>Navigation
            </a>
          </div>
        </section>
      )}

      <footer className="gta-help">
        <button onClick={locate}><kbd>P</kbd>Meine Position</button>
        <button onClick={toggleNearby}><kbd>N</kbd>{nearby ? 'Alle Läden' : `${NEARBY.minutes} Min. zu Fuß`}</button>
        <button onClick={() => step(1)}><kbd>←</kbd><kbd>→</kbd>Laden wechseln</button>
        <button onClick={() => mapRef.current?.zoomIn()}><kbd>+</kbd></button>
        <button onClick={() => mapRef.current?.zoomOut()}><kbd>−</kbd>Zoom</button>
        <button onClick={back}><kbd>Esc</kbd>Zurück</button>
      </footer>

      {!ready && (
        <div className="gta-loading">
          <i />
          Karte wird geladen
        </div>
      )}
    </div>
  )
}
