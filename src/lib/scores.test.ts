import { describe, expect, it } from 'vitest'
import { aggregate, buildRanking, ratingOverall } from './scores'
import { rankFor, ranksByUser, xpFor } from './levels'
import { XP } from './config'
import { coordsFromMapsUrl, shopSchema, validateScores } from './validate'
import { slugify } from './format'
import type { Criterion, RatingLite, Shop } from './data/types'

const crit = (key: string, active = true, sortOrder = 0): Criterion => ({ key, label: key, description: null, sortOrder, active, weight: 1 })
const criteria = [crit('preis', true, 1), crit('auswahl', true, 2), crit('sosse', true, 3), crit('fleisch', true, 4)]
const shop = (id: string, name = id): Shop => ({
  id, slug: id, name, address: 'x', district: null, lat: 0, lng: 0, mapsUrl: 'https://maps.app.goo.gl/x',
  doenerPrice: null, notes: null, imageUrl: null, createdAt: '', updatedAt: '',
})
const r = (shopId: string, scores: number[], userId = 'user', hasFazit = false): RatingLite => ({
  shopId, userId, hasFazit, scores: { preis: scores[0], auswahl: scores[1], sosse: scores[2], fleisch: scores[3] },
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

describe('Gewichtung', () => {
  const weighted = [{ ...crit('preis', true, 1), weight: 1 }, { ...crit('fleisch', true, 2), weight: 3 }]
  it('zählt ein Kriterium mit Gewicht 3 dreifach', () => {
    // (4*1 + 8*3) / 4 = 7
    expect(ratingOverall({ preis: 4, fleisch: 8 }, weighted)).toBe(7)
  })
  it('Gewicht 0 lässt ein Kriterium aus der Gesamtnote', () => {
    const c = [{ ...crit('preis', true, 1), weight: 0 }, { ...crit('fleisch', true, 2), weight: 1 }]
    expect(ratingOverall({ preis: 1, fleisch: 9 }, c)).toBe(9)
  })
  it('ohne Gewichte (alle 1) bleibt es der einfache Durchschnitt', () => {
    expect(ratingOverall({ preis: 6, fleisch: 8 }, [crit('preis', true, 1), crit('fleisch', true, 2)])).toBe(7)
  })
})

describe('Ranking', () => {
  const shops = [shop('a', 'Anadolu'), shop('b', 'Bosporus'), shop('c', 'Cem'), shop('d', 'Döner Ecke')]
  const ratings = [
    r('a', [8, 8, 8, 8], 'chef'),
    r('a', [2, 2, 2, 2]),
    r('b', [9, 9, 9, 9], 'chef'),
    r('b', [5, 5, 5, 5]),
    r('c', [7, 7, 7, 7]),
  ]

  it('zählt jede Bewertung gleich, gleiche Note = gleicher Platz, mehr Stimmen zuerst', () => {
    const rows = buildRanking(shops, ratings, criteria)
    expect(rows.map((x) => [x.shop.id, x.rank])).toEqual([['b', 1], ['c', 1], ['a', 3], ['d', null]])
    expect(rows[0].agg.count).toBe(2)
  })
})

describe('Ränge', () => {
  const many = (n: number, hasFazit: boolean) => Array.from({ length: n }, () => ({ hasFazit }))

  it('gibt XP für Bewertungen und Fazits', () => {
    expect(xpFor([])).toBe(0)
    expect(xpFor([{ hasFazit: false }, { hasFazit: true }])).toBe(XP.rating * 2 + XP.fazit)
  })
  it('ordnet XP den Stufen zu', () => {
    expect([0, 5, 6, 20, 21, 50, 51, 100, 101, 999].map((xp) => rankFor(xp).level.name)).toEqual([
      'Karlsruher', 'Karlsruher', 'Gelegenheitsdöner', 'Gelegenheitsdöner', 'Macher', 'Macher', 'Experte', 'Experte', 'Jumbo', 'Jumbo',
    ])
  })
  it('zeigt den Fortschritt bis zur nächsten Stufe', () => {
    const rank = rankFor(xpFor(many(3, false)))
    expect(rank).toMatchObject({ xp: 9, next: { name: 'Macher' } })
    expect(rank.progress).toBeCloseTo((9 - 6) / (21 - 6))
    expect(rankFor(500)).toMatchObject({ next: null, progress: 1 })
  })
  it('rechnet Ränge pro Nutzer', () => {
    const s = [5, 5, 5, 5]
    const ranks = ranksByUser([r('a', s, 'chef'), r('b', s, 'chef'), r('c', s, 'chef', true), r('a', s), r('b', s), r('c', s)])
    expect(ranks.get('chef')?.xp).toBe(3 * XP.rating + XP.fazit)
    expect(ranks.get('user')?.level.name).toBe('Gelegenheitsdöner')
  })
  it('gibt XP für Fotos', () => {
    expect(xpFor([{ hasFazit: false }], 2)).toBe(XP.rating + 2 * XP.photo)
    const ranks = ranksByUser([r('a', [5, 5, 5, 5], 'mo')], [{ userId: 'mo' }, { userId: 'mo' }, { userId: 'fotograf' }])
    expect(ranks.get('mo')?.xp).toBe(XP.rating + 2 * XP.photo)
    expect(ranks.get('fotograf')?.xp).toBe(XP.photo)
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
