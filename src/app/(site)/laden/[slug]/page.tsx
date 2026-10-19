import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { Avatar } from '@/components/Avatar'
import { DeleteRatingButton } from '@/components/DeleteRatingButton'
import { LevelTag } from '@/components/LevelTag'
import { MiniMap } from '@/components/MiniMap'
import { RatingForm } from '@/components/RatingForm'
import { ShopPhotos } from '@/components/ShopPhotos'
import { Breakdown, NeedLogin, Score } from '@/components/ui'
import { getBackend, getCurrentUser } from '@/lib/data'
import { ranksByUser } from '@/lib/levels'
import { activeCriteria, aggregate, buildRanking, ratingOverall } from '@/lib/scores'
import { fmtDate, fmtNum, fmtPrice, fmtScore, nameOf, plural } from '@/lib/format'
import { isGoogleMapsUrl } from '@/lib/validate'
import { SwipeNav } from '@/components/SwipeNav'

type Props = { params: Promise<{ slug: string }> }

const loadShop = cache(async (slug: string) => (await getBackend()).getShopBySlug(slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await loadShop((await params).slug)
  if (!shop) return { title: 'Nicht gefunden' }
  const backend = await getBackend()
  const [criteria, ratings] = await Promise.all([backend.listCriteria(), backend.listRatingsForShop(shop.id)])
  const agg = aggregate(ratings, criteria)
  const description = `${shop.district ?? shop.address} · Community: ${fmtScore(agg.overall)} von 10`
  return { title: shop.name, description, openGraph: { title: shop.name, description } }
}

export default async function ShopPage({ params }: Props) {
  const shop = await loadShop((await params).slug)
  if (!shop) notFound()

  const backend = await getBackend()
  const [criteria, ratings, allRatings, shops, photos, allPhotos, user] = await Promise.all([
    backend.listCriteria(),
    backend.listRatingsForShop(shop.id),
    backend.listAllRatings(),
    backend.listShops(),
    backend.listPhotosForShop(shop.id),
    backend.listAllPhotos(),
    getCurrentUser(),
  ])
  // Titelfoto setzt der Admin – ohne nimmt die Seite das neueste Community-Foto
  const cover = shop.imageUrl ?? photos[0]?.url ?? null
  const isAdmin = user?.role === 'admin'
  const agg = aggregate(ratings, criteria)
  const ranking = buildRanking(shops, allRatings, criteria)
  const rank = ranking.find((r) => r.shop.id === shop.id)?.rank
  const ranks = ranksByUser(allRatings, allPhotos)
  const mine = user ? (ratings.find((r) => r.userId === user.id) ?? null) : null
  const price = fmtPrice(shop.doenerPrice)
  // Reihenfolge wie im Ranking, am Ende springt es wieder nach vorn
  const order = ranking.map((r) => r.shop)
  const at = order.findIndex((s) => s.id === shop.id)
  const prevShop = order.length > 1 ? order[(at - 1 + order.length) % order.length] : null
  const nextShop = order.length > 1 ? order[(at + 1) % order.length] : null

  return (
    <SwipeNav prev={prevShop?.slug ?? null} next={nextShop?.slug ?? null}>
      <p className="crumbs">
        <Link href="/">← zur Liste</Link>
      </p>

      <header className="shop-head">
        {/* Fotos kommen schon verkleinert an, daher reicht ein normales <img> */}
        {cover && <img className="shop-photo" src={cover} alt={`Foto von ${shop.name}`} />}
        <h1>{shop.name}</h1>
        <p className="shop-meta">
          {shop.address}
          {shop.district && ` · ${shop.district}`}
          {price && ` · Döner ${price}`}
        </p>
        <div className="badges">{rank && <span className="sticker">Platz {rank} in der Community</span>}</div>
        <div className="actions">
          <a className="btn primary" href={isGoogleMapsUrl(shop.mapsUrl) ? shop.mapsUrl : '#'} target="_blank" rel="noopener noreferrer">
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
          <h2>Community-Schnitt</h2>
          {agg.count ? (
            <>
              <Breakdown agg={agg} criteria={criteria} />
              <p className="muted small">Schnitt aus {plural(agg.count, 'Bewertung', 'Bewertungen')}</p>
            </>
          ) : (
            <p className="muted">Noch keine Bewertungen. Mach den Anfang.</p>
          )}
        </section>

        <MiniMap lat={shop.lat} lng={shop.lng} />
      </div>

      <ShopPhotos
        shopId={shop.id}
        photos={photos}
        me={user ? { id: user.id, isAdmin } : null}
        loginHref={`/login?weiter=${encodeURIComponent(`/laden/${shop.slug}`)}`}
      />

      <section className="rate-section">
        {user ? (
          <RatingForm shopId={shop.id} criteria={criteria} mine={mine} />
        ) : (
          <NeedLogin text="Du warst auch schon da? Dann bewerte selbst." back={`/laden/${shop.slug}`} />
        )}
      </section>

      <section className="fazits">
        <h2>Fazits aus der Community ({ratings.length})</h2>
        {ratings.length ? (
          ratings.map((r) => {
            const level = ranks.get(r.userId)?.level
            return (
              <article className="fazit" key={r.id}>
                <header>
                  <Avatar person={r.author} size={28} />
                  <Link href={`/u/${encodeURIComponent(r.author?.username ?? '')}`}>{nameOf(r.author)}</Link>
                  {level && <LevelTag level={level} />}
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
            )
          })
        ) : (
          <p className="muted">Noch keiner hat was geschrieben.</p>
        )}
      </section>
    </SwipeNav>
  )
}
