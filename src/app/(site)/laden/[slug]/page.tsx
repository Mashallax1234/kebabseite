import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { DeleteRatingButton } from '@/components/DeleteRatingButton'
import { MiniMap } from '@/components/MiniMap'
import { RatingForm } from '@/components/RatingForm'
import { Breakdown, NeedLogin, Score } from '@/components/ui'
import { getBackend, getCurrentUser } from '@/lib/data'
import { activeCriteria, aggregate, buildRanking, ratingOverall } from '@/lib/scores'
import { fmtDate, fmtNum, fmtPrice, fmtScore, genitive, nameOf, plural } from '@/lib/format'
import { SITE } from '@/lib/config'
import { isGoogleMapsUrl } from '@/lib/validate'

type Props = { params: Promise<{ slug: string }> }

const loadShop = cache(async (slug: string) => (await getBackend()).getShopBySlug(slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await loadShop((await params).slug)
  if (!shop) return { title: 'Nicht gefunden' }
  const backend = await getBackend()
  const [criteria, ratings] = await Promise.all([backend.listCriteria(), backend.listRatingsForShop(shop.id)])
  const admin = aggregate(ratings.filter((r) => r.author?.role === 'admin'), criteria)
  const description = `${shop.district ?? shop.address} · ${SITE.admin}: ${fmtScore(admin.overall)} von 10`
  return { title: shop.name, description, openGraph: { title: shop.name, description } }
}

export default async function ShopPage({ params }: Props) {
  const shop = await loadShop((await params).slug)
  if (!shop) notFound()

  const backend = await getBackend()
  const [criteria, ratings, allRatings, shops, user] = await Promise.all([
    backend.listCriteria(),
    backend.listRatingsForShop(shop.id),
    backend.listAllRatings(),
    backend.listShops(),
    getCurrentUser(),
  ])
  const isAdmin = user?.role === 'admin'
  const adminRatings = ratings.filter((r) => r.author?.role === 'admin')
  const community = ratings.filter((r) => r.author?.role !== 'admin')
  const communityAgg = aggregate(community, criteria)
  const rankIn = (mode: 'admin' | 'community') => buildRanking(shops, allRatings, criteria, mode).find((r) => r.shop.id === shop.id)?.rank
  const adminRank = rankIn('admin')
  const communityRank = rankIn('community')
  const mine = user ? (ratings.find((r) => r.userId === user.id) ?? null) : null
  const price = fmtPrice(shop.doenerPrice)

  return (
    <>
      <p className="crumbs">
        <Link href="/">← zur Liste</Link>
      </p>

      <header className="shop-head">
        <h1>{shop.name}</h1>
        <p className="shop-meta">
          {shop.address}
          {shop.district && ` · ${shop.district}`}
          {price && ` · Döner ${price}`}
        </p>
        <div className="badges">
          {adminRank && (
            <span className="sticker">
              Platz {adminRank} bei {SITE.admin}
            </span>
          )}
          {communityRank && <span className="sticker alt">Platz {communityRank} in der Community</span>}
        </div>
        <div className="actions">
          <a className="btn primary" href={isGoogleMapsUrl(shop.mapsUrl) ? shop.mapsUrl : "#"} target="_blank" rel="noopener noreferrer">
            In Google Maps navigieren ↗
          </a>
          <Link className="btn" href={`/karte?laden=${encodeURIComponent(shop.slug)}`}>
            Auf der Döner-Karte
          </Link>
          {isAdmin && (
            <Link className="btn" href={`/admin/laden/${shop.id}`}>
              Bearbeiten
            </Link>
          )}
        </div>
        {shop.notes && <p className="note">{shop.notes}</p>}
      </header>

      <div className="two-col">
        <section className="box">
          {adminRatings.length ? (
            adminRatings.map((r) => (
              <div className="verdict" key={r.id}>
                <h2>{genitive(nameOf(r.author))} Urteil</h2>
                <Breakdown agg={aggregate([r], criteria)} criteria={criteria} />
                {r.fazit && <blockquote>{r.fazit}</blockquote>}
                <p className="muted small">
                  getestet {fmtDate(r.createdAt)}
                  {r.updatedAt !== r.createdAt && `, aktualisiert ${fmtDate(r.updatedAt)}`}
                </p>
              </div>
            ))
          ) : (
            <>
              <h2>{genitive(SITE.admin)} Urteil</h2>
              <p className="muted">Noch nicht getestet.</p>
            </>
          )}
        </section>

        <section className="box">
          <h2>Community</h2>
          {communityAgg.count ? (
            <>
              <Breakdown agg={communityAgg} criteria={criteria} />
              <p className="muted small">Schnitt aus {plural(communityAgg.count, 'Bewertung', 'Bewertungen')}</p>
            </>
          ) : (
            <p className="muted">Noch keine Bewertungen. Mach den Anfang.</p>
          )}
        </section>
      </div>

      <MiniMap lat={shop.lat} lng={shop.lng} />

      <section className="rate-section">
        {user ? (
          <RatingForm shopId={shop.id} criteria={criteria} mine={mine} isAdmin={isAdmin} />
        ) : (
          <NeedLogin text="Du warst auch schon da? Dann bewerte selbst." back={`/laden/${shop.slug}`} />
        )}
      </section>

      <section className="fazits">
        <h2>Fazits aus der Community ({community.length})</h2>
        {community.length ? (
          community.map((r) => (
            <article className="fazit" key={r.id}>
              <header>
                <Link href={`/u/${encodeURIComponent(r.author?.username ?? '')}`}>{nameOf(r.author)}</Link>
                <span className="muted"> · {fmtDate(r.updatedAt)}</span>
                <Score value={ratingOverall(r.scores, criteria)} />
              </header>
              <p className="crit-line">
                {activeCriteria(criteria)
                  .filter((c) => r.scores[c.key] != null)
                  .map((c) => `${c.label} ${fmtNum(r.scores[c.key])}`)
                  .join(' · ')}
              </p>
              {r.fazit ? <p className="fazit-text">{r.fazit}</p> : <p className="muted small">(kein Text)</p>}
              {isAdmin && <DeleteRatingButton ratingId={r.id} name={nameOf(r.author)} />}
            </article>
          ))
        ) : (
          <p className="muted">Noch keiner hat was geschrieben.</p>
        )}
      </section>
    </>
  )
}
