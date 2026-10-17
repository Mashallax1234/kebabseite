// Eingabe-Regeln an einer Stelle. Werden im Browser (sofortiges Feedback)
// und in den Server Actions (verbindlich) benutzt.
import { z } from 'zod'
import { SCORE } from './config'
import { UserError } from './errors'
import { activeCriteria } from './scores'
import type { Criterion, Scores } from './data/types'

const MAPS_RE = /^https:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i
export const USERNAME_RE = /^[A-Za-z0-9_.]{3,24}$/

export const isGoogleMapsUrl = (u: string | null | undefined) => MAPS_RE.test((u ?? '').trim())

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen.`)
    .transform((s) => s || null)
    .nullable()
    .optional()
    .transform((s) => s ?? null)

const germanNumber = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? null : Number(v.replace(',', '.'))) : v),
  z.number().nullable(),
)

export const shopSchema = z.object({
  name: z.string().trim().min(1, 'Name fehlt.').max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Die URL darf nur a–z, 0–9 und Bindestriche enthalten.'),
  address: z.string().trim().min(1, 'Adresse fehlt.').max(160),
  district: optText(60),
  mapsUrl: z.string().trim().refine(isGoogleMapsUrl, 'Bitte einen Google-Maps-Link angeben (https://www.google.… oder https://maps.app.goo.gl/…).'),
  lat: germanNumber.pipe(z.number({ error: 'Position fehlt.' }).min(-90).max(90)),
  lng: germanNumber.pipe(z.number({ error: 'Position fehlt.' }).min(-180).max(180)),
  doenerPrice: germanNumber.pipe(z.number().gt(0, 'Dönerpreis sieht komisch aus.').lt(100, 'Dönerpreis sieht komisch aus.').nullable()),
  notes: optText(300),
})

export const suggestionSchema = z
  .object({
    name: z.string().trim().min(1, 'Wie heißt der Laden?').max(80),
    address: optText(160),
    mapsUrl: optText(500),
    note: optText(1000),
  })
  .refine((s) => s.address || s.mapsUrl, 'Bitte Adresse oder Google-Maps-Link angeben.')
  // Nur echte Google-Maps-Links – der Link wird im Admin-Bereich anklickbar angezeigt
  .refine((s) => !s.mapsUrl || isGoogleMapsUrl(s.mapsUrl), 'Der Link muss ein Google-Maps-Link sein (https://maps.app.goo.gl/… oder https://www.google.…/maps/…).')

export const signUpSchema = z.object({
  username: z.string().trim().regex(USERNAME_RE, 'Nutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ und Punkt.'),
  email: z.email('Die E-Mail-Adresse sieht nicht richtig aus.'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben.'),
})

export const profileSchema = z.object({
  displayName: optText(40),
  bio: optText(500),
})

export const criterionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]+$/, 'Schlüssel: nur a–z, 0–9 und _'),
  label: z.string().trim().min(1, 'Name fehlt.').max(40),
  description: optText(120),
  sortOrder: z.coerce.number().int(),
  active: z.boolean(),
})

export const fazitSchema = optText(2000)

export function validateScores(scores: Scores, criteria: Criterion[]): void {
  const missing = activeCriteria(criteria).filter((c) => typeof scores[c.key] !== 'number')
  if (missing.length) throw new UserError('Bitte alle Kriterien bewerten: ' + missing.map((c) => c.label).join(', '))
  for (const [key, v] of Object.entries(scores)) {
    if (!criteria.some((c) => c.key === key)) throw new UserError('Unbekanntes Kriterium: ' + key)
    const onStep = Math.abs(Math.round(v / SCORE.step) * SCORE.step - v) < 1e-9
    if (typeof v !== 'number' || v < SCORE.min || v > SCORE.max || !onStep) {
      throw new UserError(`Werte müssen zwischen ${SCORE.min} und ${SCORE.max} liegen.`)
    }
  }
}

/** Erste zod-Fehlermeldung als Text */
export const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Eingabe ungültig.'

/** Liest Koordinaten aus Google-Maps-Links. Kurzlinks enthalten keine. */
export function coordsFromMapsUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  let s = url ?? ''
  try {
    s = decodeURIComponent(s)
  } catch {
    /* egal */
  }
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // Pin eines Ortes
    /[?&](?:q|query|destination|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // Kartenmitte
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  }
  return null
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
