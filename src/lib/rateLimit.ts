import 'server-only'
import { UserError } from './errors'

// Einfaches Rate-Limit im Speicher (Sliding Window) als erste Bremse in den
// Server Actions. Auf Serverless-Hosts hat jede Instanz ihren eigenen Zähler –
// die verbindliche Grenze steckt deshalb zusätzlich in der Datenbank
// (Trigger in supabase/schema.sql).

const g = globalThis as unknown as { __rate?: Map<string, number[]> }
const hits: Map<string, number[]> = (g.__rate ??= new Map())

export const LIMITS = {
  login: { max: 10, windowMs: 10 * 60_000 }, // pro IP
  register: { max: 5, windowMs: 60 * 60_000 }, // pro IP
  rating: { max: 30, windowMs: 10 * 60_000 }, // pro Nutzer
  suggestion: { max: 5, windowMs: 24 * 60 * 60_000 }, // pro Nutzer
  profile: { max: 20, windowMs: 10 * 60_000 }, // pro Nutzer
} as const

export function rateLimit(kind: keyof typeof LIMITS, key: string) {
  const { max, windowMs } = LIMITS[kind]
  const now = Date.now()
  const id = `${kind}:${key}`
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(id, recent)
    throw new UserError('Zu viele Versuche. Bitte warte kurz und probier es dann nochmal.')
  }
  recent.push(now)
  hits.set(id, recent)
  // Speicher nicht volllaufen lassen
  if (hits.size > 10_000) for (const k of hits.keys()) if (!hits.get(k)!.some((t) => now - t < 24 * 60 * 60_000)) hits.delete(k)
}
