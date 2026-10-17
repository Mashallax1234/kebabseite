// Noten, Durchschnitte, Ranking. Unabhängig vom Backend: jedes Backend
// liefert nur Rohdaten, gerechnet wird hier.
import type { Criterion, RatingLite, Scores, Shop } from './data/types'

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export type Mode = 'admin' | 'community'

export interface Aggregate {
  overall: number | null
  perCriterion: Record<string, number | null>
  count: number
}

export interface RankedRow {
  shop: Shop
  agg: Aggregate
  rank: number | null
}

export const activeCriteria = (criteria: Criterion[]) =>
  criteria.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder)

/**
 * Gesamtnote einer Bewertung = Durchschnitt der aktiven Kriterien, die darin
 * vorkommen. Kommt später ein Kriterium dazu, werden alte Bewertungen über
 * die vorhandenen Kriterien gemittelt.
 */
export function ratingOverall(scores: Scores | null | undefined, criteria: Criterion[]): number | null {
  const vals = activeCriteria(criteria)
    .map((c) => scores?.[c.key])
    .filter((v): v is number => typeof v === 'number')
  return vals.length ? mean(vals) : null
}

export function aggregate(ratings: { scores: Scores }[], criteria: Criterion[]): Aggregate {
  const perCriterion: Record<string, number | null> = {}
  for (const c of activeCriteria(criteria)) {
    const vals = ratings.map((r) => r.scores[c.key]).filter((v): v is number => typeof v === 'number')
    perCriterion[c.key] = vals.length ? mean(vals) : null
  }
  const overalls = ratings.map((r) => ratingOverall(r.scores, criteria)).filter((v): v is number => v != null)
  return { overall: overalls.length ? mean(overalls) : null, perCriterion, count: overalls.length }
}

const matchesMode = (mode: Mode) => (r: { authorRole: string }) =>
  mode === 'admin' ? r.authorRole === 'admin' : r.authorRole !== 'admin'

/**
 * mode 'admin'     -> nur Bewertungen von Admins (Hallahsams Ranking)
 * mode 'community' -> alle anderen Nutzer
 * Gleiche Note = gleicher Platz (1, 2, 2, 4 …). Läden ohne Wertung stehen unten, ohne Platz.
 */
export function buildRanking(shops: Shop[], ratings: RatingLite[], criteria: Criterion[], mode: Mode): RankedRow[] {
  const byShop = new Map<string, RatingLite[]>(shops.map((s) => [s.id, []]))
  ratings.filter(matchesMode(mode)).forEach((r) => byShop.get(r.shopId)?.push(r))

  const rows: RankedRow[] = shops.map((shop) => ({ shop, agg: aggregate(byShop.get(shop.id) ?? [], criteria), rank: null }))
  rows.sort((a, b) => {
    const x = a.agg.overall
    const y = b.agg.overall
    if (x == null && y == null) return a.shop.name.localeCompare(b.shop.name, 'de')
    if (x == null) return 1
    if (y == null) return -1
    return y - x || b.agg.count - a.agg.count || a.shop.name.localeCompare(b.shop.name, 'de')
  })

  let last: number | null = null
  let lastRank = 0
  rows.forEach((row, i) => {
    if (row.agg.overall == null) return
    if (last == null || Math.abs(row.agg.overall - last) > 1e-9) {
      lastRank = i + 1
      last = row.agg.overall
    }
    row.rank = lastRank
  })
  return rows
}

export type Tier = 'top' | 'good' | 'ok' | 'meh' | 'bad' | 'none'

export function tier(v: number | null | undefined): Tier {
  if (v == null) return 'none'
  if (v >= 8.5) return 'top'
  if (v >= 7.5) return 'good'
  if (v >= 6.5) return 'ok'
  if (v >= 5) return 'meh'
  return 'bad'
}

/** Nur die aktiven Kriterien aus einer (evtl. älteren) Bewertung übernehmen */
export function pickActive(scores: Scores | null | undefined, criteria: Criterion[]): Scores {
  const out: Scores = {}
  for (const c of activeCriteria(criteria)) {
    const v = scores?.[c.key]
    if (typeof v === 'number') out[c.key] = v
  }
  return out
}

export const isComplete = (scores: Scores, criteria: Criterion[]) =>
  activeCriteria(criteria).every((c) => typeof scores[c.key] === 'number')
