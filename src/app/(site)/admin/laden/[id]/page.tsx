import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ShopEditor } from '@/components/ShopEditor'
import { requireAdminPage } from '@/lib/auth'
import { getBackend } from '@/lib/data'

export const metadata: Metadata = { title: 'Laden bearbeiten' }

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAdminPage(`/admin/laden/${id}`)
  const backend = await getBackend()
  const shop = await backend.getShopById(id)
  if (!shop) notFound()
  const [criteria, ratings] = await Promise.all([backend.listCriteria(), backend.listRatingsForShop(shop.id)])
  const mine = ratings.find((r) => r.userId === user.id) ?? null
  return <ShopEditor key={shop.id} criteria={criteria} shop={shop} mine={mine} suggestion={null} />
}
