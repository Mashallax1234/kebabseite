// Wählt das Backend. Neues Backend = neuer Eintrag in `factories`.
import 'server-only'
import { cache } from 'react'
import type { Backend } from './types'

export function backendKind(): 'supabase' | 'demo' {
  const explicit = process.env.DATA_BACKEND?.trim()
  const kind = explicit === 'supabase' || explicit === 'demo' ? explicit : process.env.SUPABASE_URL ? 'supabase' : 'demo'
  // Sicherheitsnetz: Der Demo-Modus hat bekannte Admin-Zugangsdaten (demo/demo).
  // In Produktion nur mit ausdrücklicher Freigabe – sonst lieber gar nicht starten.
  if (kind === 'demo' && process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    throw new Error('Demo-Modus ist in Produktion gesperrt. SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY setzen.')
  }
  return kind
}

const factories: Record<ReturnType<typeof backendKind>, () => Promise<Backend>> = {
  supabase: async () => (await import('./supabase/backend')).createSupabaseBackend(),
  demo: async () => (await import('./demo/backend')).createDemoBackend(),
}

/** Ein Backend pro Request (cache() gilt nur für die Dauer des Requests) */
export const getBackend = cache(() => factories[backendKind()]())

/** Aktueller Nutzer, pro Request nur einmal geladen */
export const getCurrentUser = cache(async () => (await getBackend()).getCurrentUser())
