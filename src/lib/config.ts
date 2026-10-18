// Alles, was man an der Seite ohne Code-Kenntnisse anpassen möchte.

export const SITE = {
  name: 'Kebabranking',
  tagline: 'jeder Döner in der Gegend. selbst gegessen, ehrlich bewertet.',
  admin: 'Mashalla',
  city: 'Stuttgart',
  /** [lat, lng] – nur Startpunkt, die Karte zoomt danach auf alle Läden */
  mapCenter: [48.7904, 9.1895] as [number, number],
  mapZoom: 12,
}

export const SCORE = { min: 1, max: 10, step: 0.5 }

// Kartendaten von OpenFreeMap: kostenlos, ohne API-Key, ohne Anmeldung.
export const MAP = {
  lightStyle: 'https://tiles.openfreemap.org/styles/positron',
  tiles: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  attribution:
    '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Daten von <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
}
