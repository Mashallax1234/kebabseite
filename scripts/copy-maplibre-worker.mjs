// MapLibre lädt seinen Web Worker als eigene Datei nach. Der Bundler kann die
// nicht mitnehmen, also liegt sie in public/maplibre (läuft vor dev/build).
import { copyFileSync, mkdirSync } from 'node:fs'

const from = 'node_modules/maplibre-gl/dist/'
const to = 'public/maplibre/'
mkdirSync(to, { recursive: true })
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(from + file, to + file)
