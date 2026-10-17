import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ProfileHead, RatingsOfUser } from '@/components/ProfileParts'
import { getBackend } from '@/lib/data'
import { nameOf } from '@/lib/format'

type Props = { params: Promise<{ username: string }> }

const load = cache(async (username: string) => (await getBackend()).getProfileByUsername(decodeURIComponent(username)))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).username)
  return { title: p ? nameOf(p) : 'Nicht gefunden' }
}

export default async function ProfilePage({ params }: Props) {
  const profile = await load((await params).username)
  if (!profile) notFound()
  return (
    <>
      <ProfileHead profile={profile} />
      <h2>Bewertungen</h2>
      <RatingsOfUser userId={profile.id} />
    </>
  )
}
