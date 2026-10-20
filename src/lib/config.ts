// Alles, was man an der Seite ohne Code-Kenntnisse anpassen möchte.

export const SITE = {
  name: 'Kebabranking',
  tagline: 'jeder Döner in der Gegend. von der Community gegessen, ehrlich bewertet.',
  city: 'Stuttgart',
  /** [lat, lng] – nur Startpunkt, die Karte zoomt danach auf alle Läden */
  mapCenter: [48.7904, 9.1895] as [number, number],
  mapZoom: 12,
}

export const SCORE = { min: 1, max: 10, step: 0.5 }

/** „In meiner Nähe“ auf der Karte: ca. 15 Minuten zu Fuß */
export const NEARBY = { radiusKm: 1.2, minutes: 15 }

/** Ladenfotos werden im Browser auf diese Größe verkleinert, bevor sie hochgeladen werden */
export const SHOP_IMAGE = { maxSize: 900, quality: 0.7, maxBytes: 1_500_000 }

/** Profilbilder: quadratisch zugeschnitten, klein gehalten */
export const AVATAR = { maxSize: 320, quality: 0.8, maxBytes: 300_000, square: true }

/** Community-Fotos: so viele darf jeder Nutzer pro Laden hochladen (verbindlich: Trigger in schema.sql) */
export const PHOTOS_PER_USER_AND_SHOP = 5

/** Punkte fürs Mitmachen. Rang = höchste Stufe, deren `min` erreicht ist. */
export const XP = { rating: 3, fazit: 2, photo: 2 }
export const LEVELS = [
  { level: 1, name: 'Karlsruher', min: 0 },
  { level: 2, name: 'Gelegenheitsdöner', min: 15 },
  { level: 3, name: 'Macher', min: 35 },
  { level: 4, name: 'Experte', min: 60 },
  { level: 5, name: 'Jumbo', min: 120 },
] as const

// Kartendaten von OpenFreeMap: kostenlos, ohne API-Key, ohne Anmeldung.
export const MAP = {
  lightStyle: 'https://tiles.openfreemap.org/styles/positron',
  tiles: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  attribution:
    '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Daten von <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
}
