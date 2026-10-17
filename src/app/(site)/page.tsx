import Link from 'next/link'
import { RankingTable } from '@/components/RankingTable'
import { Score } from '@/components/ui'
import { getBackend, getCurrentUser } from '@/lib/data'
import { activeCriteria, buildRanking } from '@/lib/scores'
import { genitive, plural } from '@/lib/format'
import { SCORE, SITE } from '@/lib/config'

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const mode = (await searchParams).ansicht === 'community' ? 'community' : 'admin'
  const backend = await getBackend()
  const [shops, criteria, ratings, user] = await Promise.all([
    backend.listShops(),
    backend.listCriteria(),
    backend.listAllRatings(),
    getCurrentUser(),
  ])
  const crit = activeCriteria(criteria)
  const rows = buildRanking(shops, ratings, criteria, mode)
  const leader = rows.find((r) => r.rank === 1)
  const communityVotes = ratings.filter((r) => r.authorRole !== 'admin').length

  return (
    <>
      <section className="intro">
        <div>
          {mode === 'admin' ? (
            <p className="lead">
              Hier steht jeder Dönerladen aus der Gegend, den {SITE.admin} durchprobiert hat. Bewertet wird nach{' '}
              {crit.map((c) => c.label).join(', ')}, jeweils {SCORE.min} bis {SCORE.max}. Der Schnitt daraus ist die Gesamtnote.
            </p>
          ) : (
            <p className="lead">
              Das Ranking aus euren Bewertungen. Jeder mit Konto kann pro Laden einmal abstimmen und die Bewertung später
              ändern. {genitive(SITE.admin)} eigene Wertung zählt hier nicht mit.
            </p>
          )}
          <p className="muted small">
            {plural(shops.length, 'Laden', 'Läden')} auf der Liste ·{' '}
            {plural(communityVotes, 'Community-Bewertung', 'Community-Bewertungen')}
          </p>
        </div>
        {leader && (
          <Link className="leader" href={`/laden/${leader.shop.slug}`}>
            <span className="sticker">Platz 1</span>
            <b>{leader.shop.name}</b>
            <Score value={leader.agg.overall} big />
            <span className="muted small">{leader.shop.district}</span>
          </Link>
        )}
      </section>

      <RankingTable
        key={mode}
        mode={mode}
        rows={rows}
        criteria={crit}
        tabs={{ admin: `${genitive(SITE.admin)} Ranking`, community: 'Community-Ranking' }}
      />

      <section className="how">
        <h2>So wird bewertet</h2>
        <dl>
          {crit.map((c) => (
            <div key={c.key}>
              <dt>{c.label}</dt>
              <dd>{c.description}</dd>
            </div>
          ))}
          <div>
            <dt>Gesamt</dt>
            <dd>Durchschnitt aller Kriterien. Keine Gewichtung, kein Hokuspokus.</dd>
          </div>
        </dl>
        <p className="legend">
          <span className="score tier-top">8,5+</span>
          <span className="score tier-good">7,5+</span>
          <span className="score tier-ok">6,5+</span>
          <span className="score tier-meh">5+</span>
          <span className="score tier-bad">darunter</span>
        </p>
        {!user && (
          <p>
            Anderer Meinung? <Link href="/registrieren">Konto anlegen</Link> und selbst bewerten.
          </p>
        )}
      </section>
    </>
  )
}
