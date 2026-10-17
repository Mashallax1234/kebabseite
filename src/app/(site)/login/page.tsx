import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/safeRedirect'
import { GoogleLogin } from '@/components/GoogleLogin'
import { LoginForm } from '@/components/forms'
import { backendKind, getCurrentUser } from '@/lib/data'

export const metadata: Metadata = { title: 'Login' }

const ERRORS: Record<string, string> = {
  google: 'Login mit Google hat nicht geklappt. Nochmal probieren oder mit E-Mail einloggen.',
  bestaetigung: 'Der Bestätigungslink ist ungültig oder abgelaufen.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string; fehler?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.weiter)
  if (await getCurrentUser()) redirect(next)
  return (
    <>
      <h1>Login</h1>
      {sp.fehler && ERRORS[sp.fehler] && <p className="error narrow">{ERRORS[sp.fehler]}</p>}
      <GoogleLogin next={next} />
      <LoginForm next={next} demo={backendKind() === 'demo'} />
    </>
  )
}
