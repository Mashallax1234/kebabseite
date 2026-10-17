// Kartenstil der großen Karte: dunkles Blaugrau, helle Straßen, wenig
// Beschriftung – wie die Karte im GTA-Pausenmenü.
// Daten: OpenMapTiles-Schema über OpenFreeMap.
import type { ExpressionSpecification, LineLayerSpecification, StyleSpecification } from 'maplibre-gl'
import { MAP } from './config'

const C = {
  land: '#2c373c',
  residential: '#313d42',
  park: '#2b4034',
  water: '#16293a',
  building: '#37444a',
  minor: '#4f5d64',
  major: '#7c8a91',
  motorway: '#b3bcc0',
  rail: '#46535a',
  label: 'rgba(255,255,255,0.78)',
  roadLabel: '#b9c3c7',
  halo: 'rgba(10,14,16,0.85)',
}

const cls = (...names: string[]): ExpressionSpecification => ['match', ['get', 'class'], names, true, false]
const width = (...stops: number[]): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.5], ['zoom'], ...stops] as ExpressionSpecification
const name: ExpressionSpecification = ['coalesce', ['get', 'name:de'], ['get', 'name']]

const road = (id: string, filter: ExpressionSpecification, color: string, w: ExpressionSpecification, minzoom = 0): LineLayerSpecification => ({
  id,
  type: 'line',
  source: 'omt',
  'source-layer': 'transportation',
  minzoom,
  filter: ['all', filter, ['!=', ['get', 'brunnel'], 'tunnel']],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': color, 'line-width': w },
})

export function gtaStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: MAP.glyphs,
    sources: { omt: { type: 'vector', url: MAP.tiles, attribution: MAP.attribution } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': C.land } },
      { id: 'residential', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: cls('residential', 'suburb', 'neighbourhood'), paint: { 'fill-color': C.residential } },
      { id: 'green', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: cls('wood', 'grass', 'farmland'), paint: { 'fill-color': C.park, 'fill-opacity': 0.8 } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': C.water, 'line-width': width(10, 0.5, 16, 4) } },
      {
        id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': C.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] },
      },
      {
        id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12, filter: cls('rail', 'transit'),
        paint: { 'line-color': C.rail, 'line-width': width(12, 1, 18, 3), 'line-dasharray': [3, 2] },
      },
      road('road-path', cls('path', 'track'), C.minor, width(15, 0.5, 18, 2), 15),
      road('road-minor', cls('minor', 'service'), C.minor, width(12, 0.4, 14, 1.6, 18, 12), 12),
      road('road-major', cls('primary', 'secondary', 'tertiary', 'trunk'), C.major, width(9, 0.6, 14, 3.5, 18, 22)),
      road('road-motorway', cls('motorway'), C.motorway, width(8, 1, 14, 5, 18, 28)),
      {
        id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15,
        layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
        paint: { 'text-color': C.roadLabel, 'text-halo-color': C.halo, 'text-halo-width': 1.2 },
      },
      {
        id: 'district-label', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 11, maxzoom: 17,
        filter: cls('suburb', 'quarter', 'neighbourhood'),
        layout: {
          'text-field': name,
          'text-font': ['Noto Sans Bold'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.18,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 14],
          'text-max-width': 8,
        },
        paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'city-label', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 11, filter: cls('city'),
        layout: { 'text-field': name, 'text-font': ['Noto Sans Bold'], 'text-transform': 'uppercase', 'text-letter-spacing': 0.25, 'text-size': 16 },
        paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 2 },
      },
    ],
  }
}
