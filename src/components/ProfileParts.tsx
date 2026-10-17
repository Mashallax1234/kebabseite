import Link from 'next/link'
import { getBackend } from '@/lib/data'
import { ratingOverall } from '@/lib/scores'
import { fmtDate, fmtScore, nameOf, plural } from '@/lib/format'
import type { Profile } from '@/lib/data/types'
import { Score } from './ui'

export function ProfileHead({ profile }: { profile: Profile }) {
  return (
    <header className="profile-head">
      <h1>{nameOf(profile)}</h1>
      <p className="muted">
        @{profile.username} {profile.role === 'admin' && <span className="tag">Admin</span>} · dabei seit {fmtDate(profile.createdAt)}
      </p>
      {profile.bio && <p className="bio">{profile.bio}</p>}
    </header>
  )
}

export async function RatingsOfUser({ userId }: { userId: string }) {
  const backend = await getBackend()
  const [ratings, criteria] = await Promise.all([backend.listRatingsByUser(userId), backend.listCriteria()])
  if (!ratings.length) return <p className="muted">Noch keine Bewertungen.</p>
  const overalls = ratings.map((r) => ratingOverall(r.scores, criteria)).filter((v): v is number => v != null)
  const avg = overalls.length ? overalls.reduce((a, b) => a + b, 0) / overalls.length : null

  return (
    <>
      <p className="muted small">
        {plural(ratings.length, 'Bewertung', 'Bewertungen')} · vergibt im Schnitt {fmtScore(avg)}
      </p>
      <div className="fazits">
        {ratings.map((r) => (
          <article className="fazit" key={r.id}>
            <header>
              {r.shop ? <Link href={`/laden/${r.shop.slug}`}>{r.shop.name}</Link> : <span className="muted">gelöschter Laden</span>}
              <span className="muted"> · {fmtDate(r.updatedAt)}</span>
              <Score value={ratingOverall(r.scores, criteria)} />
            </header>
            {r.fazit && <p className="fazit-text">{r.fazit}</p>}
          </article>
        ))}
      </div>
    </>
  )
}
