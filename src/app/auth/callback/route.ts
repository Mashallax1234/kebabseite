// Rückweg nach Google-Login und Ziel des Bestätigungslinks aus der
// Registrierungs-Mail (nur Supabase).
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/safeRedirect'
import { backendKind } from '@/lib/data'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('weiter'))

  // Google meldet Abbruch o. Ä. als ?error=…
  if (url.searchParams.get('error')) return NextResponse.redirect(new URL('/login?fehler=google', url.origin))

  if (code && backendKind() === 'supabase') {
    const { createSupabase } = await import('@/lib/data/supabase/client')
    const sb = await createSupabase()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/login?fehler=bestaetigung', url.origin))
  }  return NextResponse.redirect(new URL(next, url.origin))
}
