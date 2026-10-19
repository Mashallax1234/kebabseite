// Vorschaubild, wenn ein Laden-Link in WhatsApp & Co. geteilt wird
import { ImageResponse } from 'next/og'
import { getBackend } from '@/lib/data'
import { aggregate, buildRanking } from '@/lib/scores'
import { fmtScore } from '@/lib/format'
import { SITE } from '@/lib/config'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Bewertung auf ' + SITE.name

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const backend = await getBackend()
  const shop = await backend.getShopBySlug(slug)
  const [criteria, ratings, all, shops] = shop
    ? await Promise.all([backend.listCriteria(), backend.listRatingsForShop(shop.id), backend.listAllRatings(), backend.listShops()])
    : [[], [], [], []]
  const agg = aggregate(ratings, criteria)
  const rank = shop ? buildRanking(shops, all, criteria).find((r) => r.shop.id === shop.id)?.rank : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f2ecdf',
          color: '#221f1a',
          padding: 70,
          border: '16px solid #221f1a',
        }}
      >
        <div style={{ fontSize: 34, display: 'flex' }}>{SITE.name.toUpperCase()}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>{shop?.name ?? 'Nicht gefunden'}</div>
          <div style={{ fontSize: 36, color: '#6f675a', marginTop: 16 }}>{shop?.district ?? ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div style={{ fontSize: 120, fontWeight: 800, background: '#a8cf8c', border: '6px solid #221f1a', padding: '0 30px' }}>
            {fmtScore(agg.overall)}
          </div>
          {rank && (
            <div style={{ fontSize: 48, background: '#f4d24a', border: '5px solid #221f1a', padding: '6px 20px', transform: 'rotate(-2deg)' }}>
              PLATZ {rank} IN DER COMMUNITY
            </div>
          )}
        </div>
      </div>
    ),
    size,
  )
}
