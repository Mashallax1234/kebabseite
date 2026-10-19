import type { Metadata, Viewport } from 'next'
import { Anton, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google'
import { connection } from 'next/server'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import { SITE } from '@/lib/config'

const anton = Anton({ weight: '400', subsets: ['latin', 'latin-ext'], variable: '--font-anton' })
const barlow = Barlow_Condensed({ weight: ['500', '600', '700'], subsets: ['latin', 'latin-ext'], variable: '--font-barlow' })
const plex = IBM_Plex_Mono({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-plex' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: `Jeder Dönerladen in ${SITE.city}, getestet und bewertet von der Community. Mit Ranking, Rängen und Karte.`,
}

export const viewport: Viewport = { themeColor: '#f2ecdf' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Jede Seite dynamisch rendern, damit die CSP-Nonce aus proxy.ts überall greift
  await connection()
  return (
    <html lang="de" className={`${anton.variable} ${barlow.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  )
}
