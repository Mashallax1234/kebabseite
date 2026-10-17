import { describe, expect, it } from 'vitest'
import { safeNext } from './safeRedirect'
import { suggestionSchema } from './validate'

describe('Weiterleitungen (Open Redirect)', () => {
  it('lässt eigene Pfade durch', () => {
    expect(safeNext('/laden/kebap-kral')).toBe('/laden/kebap-kral')
    expect(safeNext('/?ansicht=community')).toBe('/?ansicht=community')
  })
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)', '/\t/evil.com', '', null, undefined])(
    'blockt %s',
    (v) => {
      expect(safeNext(v as string)).toBe('/')
    },
  )
})

describe('Vorschläge', () => {
  const base = { name: 'X', address: 'Weg 1', note: '' }
  it('lehnt Nicht-Google-Links ab (z. B. javascript:)', () => {
    expect(suggestionSchema.safeParse({ ...base, mapsUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(suggestionSchema.safeParse({ ...base, mapsUrl: 'https://evil.com/maps' }).success).toBe(false)
  })
  it('akzeptiert Google-Maps-Links und leere Links', () => {
    expect(suggestionSchema.safeParse({ ...base, mapsUrl: 'https://maps.app.goo.gl/abc' }).success).toBe(true)
    expect(suggestionSchema.safeParse({ ...base, mapsUrl: '' }).success).toBe(true)
  })
})
