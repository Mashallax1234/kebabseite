import type { NextConfig } from 'next'

// Sicherheits-Header für alle Antworten. Die Content Security Policy
// kommt pro Request (mit Nonce) aus src/proxy.ts.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Standort nur für die eigene Seite ("Meine Position" auf der Karte), Rest aus
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Ladenfotos gehen über eine Server Action. Sie kommen schon verkleinert
  // (~100–400 KB), das Limit lässt nur etwas Luft über den Standard von 1 MB.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
