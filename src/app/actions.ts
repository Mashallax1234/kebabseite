'use server'
// Alle Änderungen laufen über diese Server Actions. Jede Action
//  1. prüft Login/Rolle,
//  2. bremst Spam (Rate-Limit),
//  3. validiert alle Eingaben mit zod (nichts vom Client wird ungeprüft übernommen),
//  4. ruft das Backend auf – das die Rechte nochmal selbst prüft (Supabase: Row Level Security).
// Server Actions sind öffentliche Endpunkte: sie dürfen sich NIE auf Prüfungen im Browser verlassen.
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { backendKind, getBackend, getCurrentUser } from '@/lib/data'
import type { Scores } from '@/lib/data/types'
import { UserError } from '@/lib/errors'
import { rateLimit } from '@/lib/rateLimit'
import { safeNext } from '@/lib/safeRedirect'
import {
  criterionSchema,
  fazitSchema,
  firstIssue,
  profileSchema,
  shopSchema,
  signUpSchema,
  suggestionSchema,
  validateScores,
} from '@/lib/validate'

export type ActionResult = { error?: string; ok?: string }

/** Eigene Fehler im Klartext anzeigen, alles Unerwartete nur ins Server-Log */
function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) return { error: firstIssue(e) }
  if (e instanceof UserError) return { error: e.message }
  console.error(e)
  return { error: 'Da ist was schiefgelaufen. Bitte nochmal versuchen.' }
}

const idSchema = z.string().trim().min(1).max(100)
const scoresSchema = z.record(z.string().max(40), z.number().finite())
const textSchema = z.string().max(5000)

const str = (fd: FormData, key: string) => {
  const v = fd.get(key)
  return typeof v === 'string' ? v.slice(0, 5000) : ''
}

async function clientIp() {
  const h = await headers()
  // Netlify setzt die echte Client-IP in x-nf-client-connection-ip (nicht fälschbar)
  return (
    h.get('x-nf-client-connection-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unbekannt'
  )
}

/** Eigene Adresse für Rücksprung-Links. In Produktion fest aus SITE_URL – nie aus dem Host-Header. */
async function siteOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') throw new Error('SITE_URL ist nicht gesetzt.')
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
}

async function requireUser() {
  const u = await getCurrentUser()
  if (!u) throw new UserError('Bitte zuerst einloggen.')
  return u
}
async function requireAdmin() {
  const u = await requireUser()
  if (u.role !== 'admin') throw new UserError('Das dürfen nur Admins.')
  return u
}
const refreshAll = () => revalidatePath('/', 'layout')

// ---------- Konto ----------

export async function loginAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    rateLimit('login', await clientIp())
    await (await getBackend()).signIn({ email: str(fd, 'email').slice(0, 320), password: str(fd, 'password').slice(0, 200) })
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  redirect(safeNext(str(fd, 'next')))
}

export async function registerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let needsConfirmation = false
  try {
    rateLimit('register', await clientIp())
    const input = signUpSchema.parse({ username: str(fd, 'username'), email: str(fd, 'email'), password: str(fd, 'password') })
    const backend = await getBackend()
    if (await backend.isUsernameTaken(input.username)) throw new UserError('Der Nutzername ist schon vergeben.')
    ;({ needsConfirmation } = await backend.signUp({ ...input, redirectTo: `${await siteOrigin()}/auth/callback` }))
  } catch (e) {
    return fail(e)
  }
  if (needsConfirmation) return { ok: 'Wir haben dir eine Mail geschickt. Klick auf den Link darin, dann bist du drin.' }
  refreshAll()
  redirect(safeNext(str(fd, 'next')))
}

/** Startet den Google-Login: Weiterleitung zu Google, zurück über /auth/callback */
export async function googleLoginAction(fd: FormData) {
  const backend = await getBackend()
  if (!backend.signInWithOAuth) redirect('/login?fehler=google')
  const next = safeNext(str(fd, 'next'))
  let url: string
  try {
    rateLimit('login', await clientIp())
    ;({ url } = await backend.signInWithOAuth({
      provider: 'google',
      redirectTo: `${await siteOrigin()}/auth/callback?weiter=${encodeURIComponent(next)}`,
    }))
  } catch (e) {
    console.error(e)
    redirect('/login?fehler=google')
  }
  refreshAll()
  redirect(url)
}

export async function logoutAction() {
  await (await getBackend()).signOut()
  refreshAll()
  redirect('/')
}

export async function updateProfileAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const u = await requireUser()
    rateLimit('profile', u.id)
    const input = profileSchema.parse({ displayName: str(fd, 'displayName'), bio: str(fd, 'bio') })
    await (await getBackend()).updateMyProfile(input)
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return { ok: 'Gespeichert.' }
}

// ---------- Bewertungen ----------

export async function saveRatingAction(shopId: string, scores: Scores, fazit: string): Promise<ActionResult> {
  try {
    const u = await requireUser()
    rateLimit('rating', u.id)
    const backend = await getBackend()
    const cleanScores = scoresSchema.parse(scores)
    validateScores(cleanScores, await backend.listCriteria())
    await backend.saveMyRating(idSchema.parse(shopId), { scores: cleanScores, fazit: fazitSchema.parse(textSchema.parse(fazit)) })
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return { ok: 'Gespeichert.' }
}

export async function deleteMyRatingAction(shopId: string): Promise<ActionResult> {
  try {
    const u = await requireUser()
    rateLimit('rating', u.id)
    await (await getBackend()).deleteMyRating(idSchema.parse(shopId))
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return { ok: 'Bewertung gelöscht.' }
}

export async function deleteRatingAction(ratingId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    await (await getBackend()).deleteRating(idSchema.parse(ratingId))
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return {}
}

// ---------- Vorschläge ----------

export async function suggestAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let name = ''
  try {
    const u = await requireUser()
    rateLimit('suggestion', u.id)
    const input = suggestionSchema.parse({
      name: str(fd, 'name'),
      address: str(fd, 'address'),
      mapsUrl: str(fd, 'mapsUrl'),
      note: str(fd, 'note'),
    })
    name = input.name
    await (await getBackend()).createSuggestion(input)
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return { ok: `Danke! „${name}“ ist eingereicht.` }
}

export async function rejectSuggestionAction(id: string, note: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const adminNote = z.string().trim().max(500).parse(note) || null
    await (await getBackend()).reviewSuggestion(idSchema.parse(id), { status: 'rejected', adminNote, shopId: null })
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return {}
}

// ---------- Läden (Admin) ----------

export interface ShopFormInput {
  id: string | null
  suggestionId: string | null
  shop: Record<string, string>
  scores: Scores
  fazit: string
}

const shopFormSchema = z.object({
  id: idSchema.nullable(),
  suggestionId: idSchema.nullable(),
  shop: z.record(z.string(), z.string().max(1000)),
  scores: scoresSchema,
  fazit: textSchema,
})

export async function saveShopAction(raw: ShopFormInput): Promise<ActionResult> {
  let slug = ''
  try {
    await requireAdmin()
    const input = shopFormSchema.parse(raw)
    const backend = await getBackend()
    const shop = shopSchema.parse(input.shop)
    const hasRating = Object.keys(input.scores).length > 0
    if (hasRating) validateScores(input.scores, await backend.listCriteria())

    const saved = input.id ? await backend.updateShop(input.id, shop) : await backend.createShop(shop)
    if (hasRating) await backend.saveMyRating(saved.id, { scores: input.scores, fazit: fazitSchema.parse(input.fazit) })
    if (input.suggestionId) await backend.reviewSuggestion(input.suggestionId, { status: 'approved', adminNote: null, shopId: saved.id })
    slug = saved.slug
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  redirect(`/laden/${encodeURIComponent(slug)}`)
}

export async function deleteShopAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    await (await getBackend()).deleteShop(idSchema.parse(id))
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  redirect('/admin')
}

export async function saveCriterionAction(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin()
    await (await getBackend()).saveCriterion(criterionSchema.parse(input))
  } catch (e) {
    return fail(e)
  }
  refreshAll()
  return { ok: 'Gespeichert.' }
}

// ---------- Demo ----------

export async function resetDemoAction() {
  if (backendKind() !== 'demo') return
  const { resetDemo } = await import('@/lib/data/demo/backend')
  resetDemo()
  refreshAll()
  redirect('/')
}
