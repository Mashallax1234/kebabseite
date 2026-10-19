import Link from 'next/link'
import { cache } from 'react'
import { getBackend } from '@/lib/data'
import { rankFor, xpFor } from '@/lib/levels'
import { ratingOverall } from '@/lib/scores'
import { fmtDate, fmtScore, nameOf, plural } from '@/lib/format'
import type { Profile } from '@/lib/data/types'
import { Avatar } from './Avatar'
import { LevelProgress } from './LevelTag'
import { Score } from './ui'

/** Kopf und Liste brauchen dieselben Bewertungen – pro Request nur einmal laden */
const loadRatings = cache(async (userId: string) => (await getBackend()).listRatingsByUser(userId))

export async function ProfileHead({ profile }: { profile: Profile }) {
  const [ratings, photos] = await Promise.all([loadRatings(profile.id), (await getBackend()).listAllPhotos()])
  const photoCount = photos.filter((p) => p.userId === profile.id).length
  const rank = rankFor(xpFor(ratings.map((r) => ({ hasFazit: !!r.fazit?.trim() })), photoCount))
  return (
    <header className="profile-head">
      <div className="profile-title">
        <Avatar person={profile} size={84} />
        <div>
          <h1>{nameOf(profile)}</h1>
          <p className="muted">
            @{profile.username} {profile.role === 'admin' && <span className="tag">Admin</span>} · dabei seit {fmtDate(profile.createdAt)}
          </p>
        </div>
      </div>
      <LevelProgress rank={rank} />
      {profile.bio && <p className="bio">{profile.bio}</p>}
    </header>
  )
}

export async function RatingsOfUser({ userId }: { userId: string }) {
  const [ratings, criteria] = await Promise.all([loadRatings(userId), (await getBackend()).listCriteria()])
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
