import type { Metadata } from 'next'
import { GtaMap } from '@/components/GtaMap'
import { getBackend, getCurrentUser } from '@/lib/data'
import { activeCriteria, buildRanking } from '@/lib/scores'
import './map.css'

export const metadata: Metadata = { title: 'Karte' }

export default async function MapPage({ searchParams }: { searchParams: Promise<{ laden?: string }> }) {
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
      ranking={buildRanking(shops, ratings, criteria)}
      criteria={activeCriteria(criteria)}
      username={user?.username ?? null}
      initialSlug={sp.laden ?? null}
    />
  )
}
