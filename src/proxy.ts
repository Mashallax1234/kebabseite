// Läuft vor jeder Seite:
//  1. setzt eine strikte Content Security Policy mit Nonce pro Request
//     (nur Scripts mit passendem Nonce laufen – eingeschleustes JS nicht),
//  2. hält die Supabase-Sitzung frisch (Token-Refresh per Cookie).
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MAP_ORIGIN = 'https://tiles.openfreemap.org'

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === 'development'
  const supabase = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : ''
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    // Inline-Styles braucht React (style={…}) und MapLibre; CSS kann kein JS ausführen
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${MAP_ORIGIN}${dev ? ' ws: wss:' : ''}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    // Formular-Weiterleitungen beim Google-Login (auch ohne JavaScript)
    `form-action 'self' ${supabase} https://accounts.google.com`.trim(),
    `frame-ancestors 'none'`,
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = contentSecurityPolicy(nonce)

  // Next liest den Nonce aus dem Request-Header und setzt ihn an seine Scripts
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const next = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy', csp)
    return res
  }
  let response = next()

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  const useSupabase = process.env.DATA_BACKEND ? process.env.DATA_BACKEND === 'supabase' : !!url
  if (useSupabase && url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          // Cookies auch an die weitergereichten Request-Header hängen
          requestHeaders.set('cookie', request.cookies.toString())
          response = next()
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    await supabase.auth.getUser()
  }
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|maplibre/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      // Prefetches brauchen keine eigene CSP
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
