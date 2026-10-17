import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/safeRedirect'
import { GoogleLogin } from '@/components/GoogleLogin'
import { RegisterForm } from '@/components/forms'
import { getCurrentUser } from '@/lib/data'

export const metadata: Metadata = { title: 'Konto anlegen' }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const next = safeNext((await searchParams).weiter)
  if (await getCurrentUser()) redirect(next)
  return (
    <>
      <h1>Konto anlegen</h1>
      <p className="lead">Mit Konto kannst du Läden bewerten, Fazits schreiben und neue Läden vorschlagen.</p>
      <GoogleLogin next={next} label="Mit Google registrieren" />
      <RegisterForm next={next} />
    </>
  )
}
