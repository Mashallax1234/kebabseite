export function fmtScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '–'
  return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',')
}

/** 7.5 -> "7,5", 8 -> "8", Durchschnitte auf eine Nachkommastelle */
export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '–'
  return String(Math.round(v * 10) / 10).replace('.', ',')
}

export function fmtPrice(v: number | null | undefined): string | null {
  if (v == null) return null
  return v.toFixed(2).replace('.', ',') + ' €'
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** "Hallahsam" -> "Hallahsams", "Klaus" -> "Klaus’" */
export const genitive = (name: string) => (/[sßxz]$/i.test(name) ? name + '’' : name + 's')

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const nameOf = (p: { displayName?: string | null; username?: string } | null | undefined) =>
  p?.displayName || p?.username || 'unbekannt'
