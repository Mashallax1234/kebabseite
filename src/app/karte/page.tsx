import type { Metadata } from 'next'
import { GtaMap } from '@/components/GtaMap'
import { getBackend, getCurrentUser } from '@/lib/data'
import { activeCriteria, buildRanking } from '@/lib/scores'
import './map.css'

export const metadata: Metadata = { title: 'Karte' }

export default async function MapPage({ searchParams }: { searchParams: Promise<{ laden?: string; modus?: string }> }) {
  const sp = await searchParams
  const backend = await getBackend()
  const [shops, criteria, ratings, user] = await Promise.all([
    backend.listShops(),
    backend.listCriteria(),
    backend.listAllRatings(),
    getCurrentUser(),
  ])

  return (
    <GtaMap
      rankings={{
        admin: buildRanking(shops, ratings, criteria, 'admin'),
        community: buildRanking(shops, ratings, criteria, 'community'),
      }}
      criteria={activeCriteria(criteria)}
      username={user?.username ?? null}
      initialMode={sp.modus === 'community' ? 'community' : 'admin'}
      initialSlug={sp.laden ?? null}
    />
  )
}
