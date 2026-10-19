// Punkte (XP) und Ränge. Gerechnet wird nur aus öffentlichen Bewertungen und
// Fotos, damit jeder Rang auch auf fremden Profilen gleich aussieht. Gelöschte
// Fotos/Bewertungen zählen nicht mehr – Hochladen und Löschen bringt also nichts.
import { LEVELS, XP } from './config'
import type { PhotoLite, RatingLite } from './data/types'

export type Level = (typeof LEVELS)[number]

export interface Rank {
  xp: number
  level: Level
  /** nächste Stufe, null auf der höchsten */
  next: Level | null
  /** 0–1, Fortschritt bis zur nächsten Stufe */
  progress: number
}

export const xpFor = (ratings: { hasFazit: boolean }[], photoCount = 0) =>
  ratings.reduce((sum, r) => sum + XP.rating + (r.hasFazit ? XP.fazit : 0), 0) + photoCount * XP.photo

export function rankFor(xp: number): Rank {
  const i = LEVELS.findLastIndex((l) => xp >= l.min)
  const level = LEVELS[Math.max(i, 0)]
  const next = LEVELS[i + 1] ?? null
  const progress = next ? (xp - level.min) / (next.min - level.min) : 1
  return { xp, level, next, progress }
}

/** Rang pro Nutzer-ID, z. B. für die Fazit-Liste eines Ladens */
export function ranksByUser(ratings: Pick<RatingLite, 'userId' | 'hasFazit'>[], photos: Pick<PhotoLite, 'userId'>[] = []): Map<string, Rank> {
  const xp = new Map<string, number>()
  const add = (id: string, n: number) => xp.set(id, (xp.get(id) ?? 0) + n)
  for (const r of ratings) add(r.userId, xpFor([r]))
  for (const p of photos) add(p.userId, XP.photo)
  return new Map([...xp].map(([id, n]) => [id, rankFor(n)]))
}
