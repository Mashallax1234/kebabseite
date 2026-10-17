// MapLibre erst im Browser laden und auf den Worker in public/maplibre zeigen
// (siehe scripts/copy-maplibre-worker.mjs).
type MapLib = typeof import('maplibre-gl')

let loading: Promise<MapLib> | null = null

export function loadMaplibre(): Promise<MapLib> {
  loading ??= import('maplibre-gl').then((ml) => {
    ml.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
    return ml
  })
  return loading
}
