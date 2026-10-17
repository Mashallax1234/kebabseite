'use client'
// Die große Karte im Stil eines GTA-Pausenmenüs.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl'
import { SITE } from '@/lib/config'
import { fmtNum, fmtPrice, fmtScore } from '@/lib/format'
import { gtaStyle } from '@/lib/gtaStyle'
import { loadMaplibre } from '@/lib/loadMaplibre'
import { MAP_LOCALE } from '@/lib/mapLocale'
import { distanceKm } from '@/lib/validate'
import type { Mode, RankedRow } from '@/lib/scores'
import type { Criterion } from '@/lib/data/types'

type LatLng = { lat: number; lng: number }
type MapLib = typeof import('maplibre-gl')

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
  rankings,
  criteria,
  username,
  initialMode,
  initialSlug,
}: {
  rankings: Record<Mode, RankedRow[]>
  criteria: Criterion[]
  username: string | null
  initialMode: Mode
  initialSlug: string | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [player, setPlayer] = useState<LatLng | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const [mapTick, setMapTick] = useState(0) // zählt hoch, sobald die Karte bereit ist

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const libRef = useRef<MapLib | null>(null)
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement; base: string }>())
  const playerMarker = useRef<Marker | null>(null)

  const rows = rankings[mode]
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
  function locate() {
    if (!navigator.geolocation) return setNotice('Dein Browser kann keinen Standort.')
    setNotice('Suche Standort …')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPlayer(p)
        setNotice(null)
        mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 14, duration: 700 })
      },
      () => setNotice('Standort nicht verfügbar.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const back = () => (selectedId ? setSelectedId(null) : router.push('/'))

  // Für Listener, die nur einmal registriert werden
  const live = useRef({ select, step, locate, back, selected })
  live.current = { select, step, locate, back, selected }

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
      const all = rankings.admin
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

  // Tastatur wie im Spiel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
      const { selected: sel, step: go, locate: loc, back: esc } = live.current
      const map = mapRef.current
      switch (e.key) {
        case 'Escape': esc(); break
        case 'ArrowRight': case 'e': case 'E': go(1); break
        case 'ArrowLeft': case 'q': case 'Q': go(-1); break
        case 'Enter': if (sel) router.push(`/laden/${sel.shop.slug}`); break
        case 'g': case 'G': if (sel) window.open(sel.shop.mapsUrl, '_blank', 'noopener'); break
        case 'p': case 'P': loc(); break
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
          {SITE.city} · {rated.length} bewertet
        </p>
        <div className="gta-switch" role="group" aria-label="Welches Ranking">
          <button className={mode === 'admin' ? 'on' : ''} onClick={() => setMode('admin')}>
            {SITE.admin}
          </button>
          <button className={mode === 'community' ? 'on' : ''} onClick={() => setMode('community')}>
            Community
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
