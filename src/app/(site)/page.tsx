import Link from 'next/link'
import { RankingTable } from '@/components/RankingTable'
import { Score } from '@/components/ui'
import { getBackend, getCurrentUser } from '@/lib/data'
import { activeCriteria, buildRanking } from '@/lib/scores'
import { plural } from '@/lib/format'
import { LEVELS, SCORE, XP } from '@/lib/config'

export default async function RankingPage() {
  const backend = await getBackend()
  const [shops, criteria, ratings, user] = await Promise.all([
    backend.listShops(),
    backend.listCriteria(),
    backend.listAllRatings(),
    getCurrentUser(),
  ])
  const crit = activeCriteria(criteria)
  const rows = buildRanking(shops, ratings, criteria)
  const leader = rows.find((r) => r.rank === 1)

  return (
    <>
      <section className="intro">
        <div>
          <p className="lead">
            Das Ranking aus euren Bewertungen. Jeder mit Konto kann pro Laden einmal abstimmen und die Bewertung später ändern.
            Bewertet wird nach {crit.map((c) => c.label).join(', ')}, jeweils {SCORE.min} bis {SCORE.max}. Der Schnitt aus allen
            Bewertungen ist die Gesamtnote.
          </p>
          <p className="muted small">
            {plural(shops.length, 'Laden', 'Läden')} auf der Liste · {plural(ratings.length, 'Bewertung', 'Bewertungen')}
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

      <RankingTable rows={rows} criteria={crit} />

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
            <dd>Durchschnitt aller Kriterien, gemittelt über alle Bewertungen. Keine Gewichtung, kein Hokuspokus.</dd>
          </div>
        </dl>
        <p className="legend">
          <span className="score tier-top">8,5+</span>
          <span className="score tier-good">7,5+</span>
          <span className="score tier-ok">6,5+</span>
          <span className="score tier-meh">5+</span>
          <span className="score tier-bad">darunter</span>
        </p>
        <h2>Ränge</h2>
        <p>
          Jede Bewertung bringt {XP.rating} XP, mit geschriebenem Fazit {XP.rating + XP.fazit} XP, jedes Foto {XP.photo} XP. Je mehr
          XP, desto höher der Rang:
        </p>
        <ol className="levels">
          {LEVELS.map((l, i) => {
            const next = LEVELS[i + 1]
            return (
              <li key={l.level}>
                <span className={`level-tag level-${l.level}`}>{l.name}</span>
                <span className="muted small">{next ? `${l.min}–${next.min - 1} XP` : `ab ${l.min} XP`}</span>
              </li>
            )
          })}
        </ol>
        {!user && (
          <p>
            Anderer Meinung? <Link href="/registrieren">Konto anlegen</Link> und selbst bewerten.
          </p>
        )}
      </section>
    </>
  )
}
