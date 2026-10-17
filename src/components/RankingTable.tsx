'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { fmtPrice, fmtScore } from '@/lib/format'
import { tier, type Mode, type RankedRow } from '@/lib/scores'
import type { Criterion } from '@/lib/data/types'

type SortKey = 'rank' | 'name' | 'overall' | 'count' | string

function valueOf(row: RankedRow, key: SortKey): number | string | null {
  if (key === 'rank') return row.rank
  if (key === 'overall') return row.agg.overall
  if (key === 'count') return row.agg.count
  if (key === 'name') return row.shop.name
  return row.agg.perCriterion[key] ?? null
}

export function RankingTable({
  mode,
  rows,
  criteria,
  tabs,
}: {
  mode: Mode
  rows: RankedRow[]
  criteria: Criterion[]
  tabs: Record<Mode, string>
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 })

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => !q || r.shop.name.toLowerCase().includes(q) || (r.shop.district ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        const x = valueOf(a, sort.key)
        const y = valueOf(b, sort.key)
        if (x == null && y == null) return 0
        if (x == null) return 1 // leere Werte immer nach unten
        if (y == null) return -1
        if (typeof x === 'string') return x.localeCompare(String(y), 'de') * sort.dir
        return ((x as number) - (y as number)) * sort.dir
      })
  }, [rows, search, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'rank' || key === 'name' ? 1 : -1 }))

  const th = (k: SortKey, label: string, className = '') => (
    <th key={k} className={className} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => toggle(k)}>
        {label}
        {sort.key === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <>
      <div className="toolbar">
        <nav className="tabs">
          <Link href="/" className={mode === 'admin' ? 'active' : ''}>
            {tabs.admin}
          </Link>
          <Link href="/?ansicht=community" className={mode === 'community' ? 'active' : ''}>
            {tabs.community}
          </Link>
        </nav>
        <input
          type="search"
          className="search"
          placeholder="Laden oder Stadtteil suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="rank-table">
          <thead>
            <tr>
              {th('rank', '#', 'col-rank')}
              {th('name', 'Laden')}
              {criteria.map((c) => th(c.key, c.label, 'num col-crit'))}
              {th('overall', 'Gesamt', 'num')}
              {mode === 'community' && th('count', 'Stimmen', 'num col-count')}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.shop.id} className="row-link" onClick={() => router.push(`/laden/${r.shop.slug}`)}>
                <td className={'col-rank' + (r.rank && r.rank <= 3 ? ' podium' : '')}>{r.rank ?? '–'}</td>
                <td className="col-name">
                  <Link href={`/laden/${r.shop.slug}`} onClick={(e) => e.stopPropagation()}>
                    {r.shop.name}
                  </Link>
                  <span className="sub">
                    {[r.shop.district, r.shop.doenerPrice != null && 'Döner ' + fmtPrice(r.shop.doenerPrice)].filter(Boolean).join(' · ')}
                  </span>
                </td>
                {criteria.map((c) => (
                  <td key={c.key} className={`num col-crit tier-${tier(r.agg.perCriterion[c.key])}`}>
                    {fmtScore(r.agg.perCriterion[c.key])}
                  </td>
                ))}
                <td className={`num col-total tier-${tier(r.agg.overall)}`}>{fmtScore(r.agg.overall)}</td>
                {mode === 'community' && <td className="num col-count">{r.agg.count}</td>}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={99} className="muted">
                  Nichts gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {mode === 'community' && <p className="muted small">Läden ohne Community-Bewertung stehen unten ohne Platz.</p>}
    </>
  )
}
