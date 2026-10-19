import type { Metadata } from 'next'
import Link from 'next/link'
import { logoutAction } from '@/app/actions'
import { AvatarEditor } from '@/components/AvatarEditor'
import { ProfileForm } from '@/components/forms'
import { ProfileHead, RatingsOfUser } from '@/components/ProfileParts'
import { NeedLogin } from '@/components/ui'
import { getCurrentUser } from '@/lib/data'

export const metadata: Metadata = { title: 'Mein Profil' }

export default async function MyProfilePage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <>
        <h1>Profil</h1>
        <NeedLogin back="/profil" />
      </>
    )
  }
  return (
    <>
      <ProfileHead profile={user} />
      <div className="actions">
        <Link className="btn" href={`/u/${encodeURIComponent(user.username)}`}>
          Öffentliches Profil ansehen
        </Link>
        <Link className="btn" href="/vorschlagen">
          Meine Vorschläge
        </Link>
        <form action={logoutAction}>
          <button className="btn">Ausloggen</button>
        </form>
      </div>

      <h2>Profilbild</h2>
      <AvatarEditor profile={user} />

      <h2>Profil bearbeiten</h2>
      <ProfileForm displayName={user.displayName ?? ''} bio={user.bio ?? ''} />

      <h2>Deine Bewertungen</h2>
      <RatingsOfUser userId={user.id} />
    </>
  )
}
