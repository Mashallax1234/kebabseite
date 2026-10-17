import type { Metadata } from 'next'
import Link from 'next/link'
import { CriteriaEditor } from '@/components/CriteriaEditor'
import { SuggestionList } from '@/components/SuggestionList'
import { requireAdminPage } from '@/lib/auth'
import { getBackend } from '@/lib/data'
import { buildRanking } from '@/lib/scores'
import { fmtScore, nameOf } from '@/lib/format'

export const metadata: Metadata = { title: 'Admin' }

export default async function AdminPage() {
  const user = await requireAdminPage('/admin')
  const backend = await getBackend()
  const [suggestions, shops, criteria, ratings] = await Promise.all([
    backend.listSuggestions(),
    backend.listShops(),
    backend.listCriteria(),
    backend.listAllRatings(),
  ])
  const adminRows = buildRanking(shops, ratings, criteria, 'admin')
  const community = new Map(buildRanking(shops, ratings, criteria, 'community').map((r) => [r.shop.id, r.agg]))

  return (
    <>
      <h1>Admin</h1>
      <p className="lead">Hi {nameOf(user)}. Hier legst du Läden an, bearbeitest sie und gehst die Vorschläge durch.</p>

      <section>
        <h2>Offene Vorschläge ({suggestions.filter((s) => s.status === 'pending').length})</h2>
        <SuggestionList suggestions={suggestions} />
      </section>

      <section>
        <div className="section-head">
          <h2>Läden ({shops.length})</h2>
          <Link className="btn primary" href="/admin/laden/neu">
            + Neuer Laden
          </Link>
        </div>
        <div className="table-wrap">
          <table className="rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Laden</th>
                <th>Stadtteil</th>
                <th className="num">Dein Score</th>
                <th className="num">Community</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {adminRows.map((r) => {
                const c = community.get(r.shop.id)
                return (
                  <tr key={r.shop.id}>
                    <td>{r.rank ?? '–'}</td>
                    <td>
                      <Link href={`/laden/${r.shop.slug}`}>{r.shop.name}</Link>
                    </td>
                    <td>{r.shop.district}</td>
                    <td className="num">{fmtScore(r.agg.overall)}</td>
                    <td className="num">
                      {fmtScore(c?.overall)} <span className="muted small">({c?.count ?? 0})</span>
                    </td>
                    <td>
                      <Link href={`/admin/laden/${r.shop.id}`}>bearbeiten</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Kriterien</h2>
        <p className="small">
          Neue Kriterien zählen sofort mit. Ältere Bewertungen, die das neue Kriterium noch nicht haben, werden über die vorhandenen
          Kriterien gemittelt. Deaktivierte Kriterien fallen aus allen Noten raus, die Werte bleiben aber gespeichert.
        </p>
        <CriteriaEditor criteria={criteria} />
      </section>
    </>
  )
}
