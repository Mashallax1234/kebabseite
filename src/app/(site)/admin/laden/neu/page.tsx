import type { Metadata } from 'next'
import { ShopEditor } from '@/components/ShopEditor'
import { requireAdminPage } from '@/lib/auth'
import { getBackend } from '@/lib/data'

export const metadata: Metadata = { title: 'Neuer Laden' }

export default async function NewShopPage({ searchParams }: { searchParams: Promise<{ vorschlag?: string }> }) {
  await requireAdminPage('/admin/laden/neu')
  const { vorschlag } = await searchParams
  const backend = await getBackend()
  const [criteria, suggestion] = await Promise.all([
    backend.listCriteria(),
    vorschlag ? backend.getSuggestion(vorschlag) : null,
  ])
  return <ShopEditor criteria={criteria} shop={null} mine={null} suggestion={suggestion?.status === 'pending' ? suggestion : null} />
}
