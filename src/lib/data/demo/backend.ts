// Demo-Backend: Daten in .data/demo.json, Login per Cookie.
// Zum Ausprobieren und Entwickeln – NICHT für den echten Betrieb
// (Passwörter im Klartext, keine echte Sitzungssicherheit).
import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { seedData, type DemoDb, type DemoSuggestion } from './seed'
import { BackendError, type Backend, type Profile, type Rating, type Suggestion } from '../types'

const FILE = path.join(process.cwd(), '.data', 'demo.json')
const COOKIE = 'demo_session'
const now = () => new Date().toISOString()
const clone = <T,>(x: T): T => structuredClone(x)

// Über HMR-Neuladungen hinweg denselben Stand behalten
const g = globalThis as unknown as { __demoDb?: DemoDb }

function db(): DemoDb {
  if (!g.__demoDb) {
    try {
      g.__demoDb = JSON.parse(fs.readFileSync(FILE, 'utf8')) as DemoDb
    } catch {
      g.__demoDb = seedData()
      persist()
    }
  }
  return g.__demoDb
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(g.__demoDb, null, 2))
  } catch {
    // Schreibgeschütztes Dateisystem (z. B. Serverless): dann eben nur im Speicher
  }
}

export function resetDemo() {
  g.__demoDb = seedData()
  persist()
}

/** Simulierter Google-Login: legt "Gina Google" an (falls nötig) und loggt ein */
export async function demoGoogleLogin() {
  const d = db()
  const id = 'user-google-demo'
  if (!d.profiles.some((p) => p.id === id)) {
    d.users.push({ id, email: 'gina.google@gmail.com', password: randomUUID() })
    d.profiles.push({ id, username: 'gina.google', displayName: 'Gina Google', bio: null, role: 'user', createdAt: now() })
    persist()
  }
  ;(await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
}

export function createDemoBackend(): Backend {
  async function me(): Promise<Profile | null> {
    const id = (await cookies()).get(COOKIE)?.value
    return db().profiles.find((p) => p.id === id) ?? null
  }
  async function needUser() {
    const u = await me()
    if (!u) throw new BackendError('Bitte zuerst einloggen.')
    return u
  }
  async function needAdmin() {
    const u = await needUser()
    if (u.role !== 'admin') throw new BackendError('Das dürfen nur Admins.')
    return u
  }
  const profile = (id: string) => db().profiles.find((p) => p.id === id) ?? null
  const author = (id: string) => {
    const p = profile(id)
    return p ? { username: p.username, displayName: p.displayName, role: p.role } : null
  }
  const withSuggester = (s: DemoSuggestion): Suggestion => {
    const p = profile(s.suggestedBy)
    return { ...s, suggester: p ? { username: p.username, displayName: p.displayName } : null }
  }
  const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const byNewest = <T extends { updatedAt?: string; createdAt: string }>(a: T, b: T) =>
    (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)

  async function setSession(id: string | null) {
    const jar = await cookies()
    if (id) jar.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    else jar.delete(COOKIE)
  }

  return {
    kind: 'demo',

    // ---------- Konto ----------
    getCurrentUser: async () => clone(await me()),
    async signUp({ email, password, username }) {
      const d = db()
      email = email.trim().toLowerCase()
      if (d.users.some((u) => u.email === email)) throw new BackendError('Für diese E-Mail gibt es schon ein Konto.')
      if (d.profiles.some((p) => sameName(p.username, username))) throw new BackendError('Der Nutzername ist schon vergeben.')
      const id = randomUUID()
      d.users.push({ id, email, password })
      d.profiles.push({ id, username, displayName: username, bio: null, role: 'user', createdAt: now() })
      persist()
      await setSession(id)
      return { needsConfirmation: false }
    },
    async signIn({ email, password }) {
      const login = email.trim().toLowerCase()
      const d = db()
      // Im Demo-Modus geht auch der Nutzername
      const byName = d.profiles.find((p) => p.username.toLowerCase() === login)
      const user = d.users.find((u) => u.email === login || (byName && u.id === byName.id))
      if (!user || user.password !== password) throw new BackendError('E-Mail oder Passwort falsch.')
      await setSession(user.id)
    },
    // Kein echtes Google im Demo-Modus: direkt einen Beispiel-Google-Nutzer einloggen
    // und gleich zum Ziel weiterleiten
    async signInWithOAuth({ redirectTo }) {
      await demoGoogleLogin()
      return { url: new URL(redirectTo).searchParams.get('weiter') ?? '/' }
    },
    async signOut() {
      await setSession(null)
    },

    // ---------- Profile ----------
    getProfileByUsername: async (username) => clone(db().profiles.find((p) => p.username === username) ?? null),
    async updateMyProfile({ displayName, bio }) {
      const u = await needUser()
      Object.assign(profile(u.id)!, { displayName, bio })
      persist()
    },
    isUsernameTaken: async (username) => db().profiles.some((p) => sameName(p.username, username)),

    // ---------- Kriterien ----------
    listCriteria: async () => clone(db().criteria),
    async saveCriterion(c) {
      await needAdmin()
      const list = db().criteria
      const i = list.findIndex((x) => x.key === c.key)
      if (i >= 0) list[i] = { ...c }
      else list.push({ ...c })
      persist()
    },

    // ---------- Läden ----------
    listShops: async () => clone(db().shops),
    getShopBySlug: async (slug) => clone(db().shops.find((s) => s.slug === slug) ?? null),
    getShopById: async (id) => clone(db().shops.find((s) => s.id === id) ?? null),
    async createShop(input) {
      await needAdmin()
      if (db().shops.some((s) => s.slug === input.slug)) throw new BackendError('Diese URL gibt es schon.')
      const shop = { id: randomUUID(), ...input, createdAt: now(), updatedAt: now() }
      db().shops.push(shop)
      persist()
      return clone(shop)
    },
    async updateShop(id, input) {
      await needAdmin()
      if (db().shops.some((s) => s.slug === input.slug && s.id !== id)) throw new BackendError('Diese URL gibt es schon.')
      const shop = db().shops.find((s) => s.id === id)
      if (!shop) throw new BackendError('Laden nicht gefunden.')
      Object.assign(shop, input, { updatedAt: now() })
      persist()
      return clone(shop)
    },
    async deleteShop(id) {
      await needAdmin()
      const d = db()
      d.shops = d.shops.filter((s) => s.id !== id)
      d.ratings = d.ratings.filter((r) => r.shopId !== id)
      d.suggestions.forEach((s) => {
        if (s.shopId === id) s.shopId = null
      })
      persist()
    },

    // ---------- Bewertungen ----------
    listAllRatings: async () =>
      db().ratings.map((r) => ({ shopId: r.shopId, scores: { ...r.scores }, authorRole: author(r.userId)?.role ?? 'user' })),
    listRatingsForShop: async (shopId) =>
      clone(db().ratings.filter((r) => r.shopId === shopId).map((r): Rating => ({ ...r, author: author(r.userId) })).sort(byNewest)),
    listRatingsByUser: async (userId) =>
      clone(
        db()
          .ratings.filter((r) => r.userId === userId)
          .map((r): Rating => {
            const s = db().shops.find((x) => x.id === r.shopId)
            return { ...r, author: author(r.userId), shop: s ? { name: s.name, slug: s.slug } : null }
          })
          .sort(byNewest),
      ),
    async saveMyRating(shopId, { scores, fazit }) {
      const u = await needUser()
      const d = db()
      if (!d.shops.some((s) => s.id === shopId)) throw new BackendError('Laden nicht gefunden.')
      const existing = d.ratings.find((r) => r.shopId === shopId && r.userId === u.id)
      if (existing) Object.assign(existing, { scores, fazit, updatedAt: now() })
      else d.ratings.push({ id: randomUUID(), shopId, userId: u.id, scores, fazit, createdAt: now(), updatedAt: now() })
      persist()
    },
    async deleteMyRating(shopId) {
      const u = await needUser()
      const d = db()
      d.ratings = d.ratings.filter((r) => !(r.shopId === shopId && r.userId === u.id))
      persist()
    },
    async deleteRating(ratingId) {
      await needAdmin()
      const d = db()
      d.ratings = d.ratings.filter((r) => r.id !== ratingId)
      persist()
    },

    // ---------- Vorschläge ----------
    async createSuggestion(input) {
      const u = await needUser()
      db().suggestions.push({
        id: randomUUID(),
        ...input,
        suggestedBy: u.id,
        status: 'pending',
        adminNote: null,
        shopId: null,
        createdAt: now(),
        reviewedAt: null,
      })
      persist()
    },
    async listMySuggestions() {
      const u = await needUser()
      return clone(db().suggestions.filter((s) => s.suggestedBy === u.id).map(withSuggester).sort(byNewest))
    },
    async listSuggestions() {
      await needAdmin()
      return clone(db().suggestions.map(withSuggester).sort(byNewest))
    },
    async getSuggestion(id) {
      const u = await needUser()
      const s = db().suggestions.find((x) => x.id === id)
      if (!s || (s.suggestedBy !== u.id && u.role !== 'admin')) return null
      return clone(withSuggester(s))
    },
    async reviewSuggestion(id, { status, adminNote, shopId }) {
      await needAdmin()
      const s = db().suggestions.find((x) => x.id === id)
      if (!s) throw new BackendError('Vorschlag nicht gefunden.')
      Object.assign(s, { status, adminNote, shopId, reviewedAt: now() })
      persist()
    },
  }
}
