import { describe, expect, it } from 'vitest'
import { aggregate, buildRanking, ratingOverall } from './scores'
import { coordsFromMapsUrl, shopSchema, validateScores } from './validate'
import { slugify } from './format'
import type { Criterion, RatingLite, Shop } from './data/types'

const crit = (key: string, active = true, sortOrder = 0): Criterion => ({ key, label: key, description: null, sortOrder, active })
const criteria = [crit('preis', true, 1), crit('auswahl', true, 2), crit('sosse', true, 3), crit('fleisch', true, 4)]
const shop = (id: string, name = id): Shop => ({
  id, slug: id, name, address: 'x', district: null, lat: 0, lng: 0, mapsUrl: 'https://maps.app.goo.gl/x',
  doenerPrice: null, notes: null, createdAt: '', updatedAt: '',
})
const r = (shopId: string, scores: number[], authorRole: 'admin' | 'user' = 'user'): RatingLite => ({
  shopId, authorRole, scores: { preis: scores[0], auswahl: scores[1], sosse: scores[2], fleisch: scores[3] },
})

describe('Gesamtnote', () => {
  it('ist der Durchschnitt der Kriterien', () => {
    expect(ratingOverall({ preis: 8, auswahl: 8, sosse: 9.5, fleisch: 9 }, criteria)).toBeCloseTo(8.625)
  })
  it('ignoriert deaktivierte Kriterien', () => {
    const c = [...criteria, crit('brot', false)]
    expect(ratingOverall({ preis: 8, auswahl: 8, sosse: 8, fleisch: 8, brot: 1 }, c)).toBe(8)
  })
  it('mittelt alte Bewertungen über vorhandene Kriterien, wenn ein neues dazukommt', () => {
    const c = [...criteria, crit('brot', true, 5)]
    expect(ratingOverall({ preis: 6, auswahl: 8, sosse: 8, fleisch: 10 }, c)).toBe(8)
  })
  it('Community-Schnitt pro Kriterium', () => {
    const agg = aggregate([r('a', [8, 8, 8, 8]), r('a', [6, 6, 6, 6])], criteria)
    expect(agg.perCriterion.preis).toBe(7)
    expect(agg.overall).toBe(7)
    expect(agg.count).toBe(2)
  })
})

describe('Ranking', () => {
  const shops = [shop('a', 'Anadolu'), shop('b', 'Bosporus'), shop('c', 'Cem'), shop('d', 'Döner Ecke')]
  const ratings = [
    r('a', [8, 8, 8, 8], 'admin'),
    r('b', [9, 9, 9, 9], 'admin'),
    r('c', [8, 8, 8, 8], 'admin'),
    r('a', [2, 2, 2, 2]),
    r('b', [5, 5, 5, 5]),
  ]

  it('Admin-Ranking zählt nur Admin-Bewertungen, gleiche Note = gleicher Platz', () => {
    const rows = buildRanking(shops, ratings, criteria, 'admin')
    expect(rows.map((x) => [x.shop.id, x.rank])).toEqual([['b', 1], ['a', 2], ['c', 2], ['d', null]])
  })
  it('Community-Ranking ignoriert Admin-Bewertungen', () => {
    const rows = buildRanking(shops, ratings, criteria, 'community')
    expect(rows.map((x) => [x.shop.id, x.rank])).toEqual([['b', 1], ['a', 2], ['c', null], ['d', null]])
  })
})

describe('Validierung', () => {
  it('akzeptiert halbe Punkte zwischen 1 und 10', () => {
    expect(() => validateScores({ preis: 7.5, auswahl: 1, sosse: 10, fleisch: 9 }, criteria)).not.toThrow()
  })
  it('lehnt fehlende, krumme oder zu große Werte ab', () => {
    expect(() => validateScores({ preis: 7, auswahl: 7, sosse: 7 }, criteria)).toThrow(/Fleisch|fleisch/)
    expect(() => validateScores({ preis: 7.3, auswahl: 7, sosse: 7, fleisch: 7 }, criteria)).toThrow()
    expect(() => validateScores({ preis: 11, auswahl: 7, sosse: 7, fleisch: 7 }, criteria)).toThrow()
  })
  it('verlangt einen Google-Maps-Link und liest deutsche Zahlen', () => {
    const base = { name: 'X', slug: 'x', address: 'Weg 1', district: '', lat: '52,5', lng: '13,4', doenerPrice: '7,50', notes: '' }
    expect(shopSchema.safeParse({ ...base, mapsUrl: 'https://example.com' }).success).toBe(false)
    const ok = shopSchema.parse({ ...base, mapsUrl: 'https://maps.app.goo.gl/abc' })
    expect(ok).toMatchObject({ lat: 52.5, lng: 13.4, doenerPrice: 7.5, district: null, notes: null })
  })
  it('liest Koordinaten aus Google-Maps-Links', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/X/@52.48,13.43,17z/data=!3d52.4801!4d13.4302')).toEqual({ lat: 52.4801, lng: 13.4302 })
    expect(coordsFromMapsUrl('https://maps.app.goo.gl/abc')).toBeNull()
  })
  it('macht aus Namen saubere URLs', () => {
    expect(slugify('Paşa Döner')).toBe('pasa-doener')
    expect(slugify('Yıldız Kebap')).toBe('yildiz-kebap')
  })
})
