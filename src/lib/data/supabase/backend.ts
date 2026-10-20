// Supabase-Backend. Tabellen, Rechte (RLS) und Trigger: supabase/schema.sql
// Alles Supabase-Spezifische bleibt in diesem Ordner.
import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import { createSupabase, supabaseEnv } from './client'
import {
  BackendError,
  type Backend,
  type Criterion,
  type Profile,
  type Rating,
  type Shop,
  type ShopInput,
  type Suggestion,
} from '../types'

type Row = Record<string, any>

const PAGE = 1000 // PostgREST liefert standardmäßig max. 1000 Zeilen pro Anfrage

const AVATAR_BUCKET = 'avatars'

/** In der Tabelle steht nur der Pfad im Bucket (der lässt sich per Check-Constraint prüfen, eine URL nicht) */
const avatarUrl = (path: string | null | undefined) =>
  path ? `${supabaseEnv().url}/storage/v1/object/public/${AVATAR_BUCKET}/${path}` : null

const mapProfile = (r: Row | null): Profile | null =>
  r && {
    id: r.id, username: r.username, displayName: r.display_name, bio: r.bio, role: r.role,
    avatarUrl: avatarUrl(r.avatar_path), createdAt: r.created_at,
  }

const mapCriterion = (r: Row): Criterion => ({
  key: r.key, label: r.label, description: r.description, sortOrder: r.sort_order, active: r.active,
  weight: r.weight == null ? 1 : Number(r.weight),
})

const mapShop = (r: Row | null): Shop | null =>
  r && {
    id: r.id, slug: r.slug, name: r.name, address: r.address, district: r.district, lat: r.lat, lng: r.lng,
    mapsUrl: r.maps_url, doenerPrice: r.doener_price == null ? null : Number(r.doener_price), notes: r.notes,
    imageUrl: r.image_url ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  }

const IMAGE_BUCKET = 'shop-images'

const shopRow = (i: ShopInput) => ({
  slug: i.slug, name: i.name, address: i.address, district: i.district, lat: i.lat, lng: i.lng,
  maps_url: i.mapsUrl, doener_price: i.doenerPrice, notes: i.notes,
})

const mapRating = (r: Row): Rating => ({
  id: r.id, shopId: r.shop_id, userId: r.user_id, scores: r.scores, fazit: r.fazit,
  createdAt: r.created_at, updatedAt: r.updated_at,
  author: r.author
    ? { username: r.author.username, displayName: r.author.display_name, role: r.author.role, avatarUrl: avatarUrl(r.author.avatar_path) }
    : null,
  shop: r.shop ? { name: r.shop.name, slug: r.shop.slug } : null,
})

const mapSuggestion = (r: Row): Suggestion => ({
  id: r.id, name: r.name, address: r.address, mapsUrl: r.maps_url, note: r.note, suggestedBy: r.suggested_by,
  suggester: r.suggester ? { username: r.suggester.username, displayName: r.suggester.display_name } : null,
  status: r.status, adminNote: r.admin_note, shopId: r.shop_id, createdAt: r.created_at, reviewedAt: r.reviewed_at,
})

const RATING_SELECT = '*, author:profiles(username, display_name, role, avatar_path)'
const SUGGESTION_SELECT = '*, suggester:profiles!suggestions_suggested_by_fkey(username, display_name)'

function germanError(error: { message?: string } | null | undefined): BackendError {
  const msg = error?.message ?? String(error)
  const table: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-Mail oder Passwort falsch.'],
    [/email not confirmed/i, 'Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Mail).'],
    [/user already registered/i, 'Für diese E-Mail gibt es schon ein Konto.'],
    [/password should be at least/i, 'Passwort ist zu kurz.'],
    [/rate limit/i, 'Zu viele Versuche. Kurz warten und nochmal probieren.'],
    [/row-level security|permission denied/i, 'Dafür fehlt dir die Berechtigung.'],
    [/duplicate key.*slug/i, 'Diese URL gibt es schon.'],
    [/duplicate key.*username/i, 'Der Nutzername ist schon vergeben.'],
    [/database error saving new user/i, 'Konto konnte nicht angelegt werden – ist der Nutzername schon vergeben?'],
    [/fetch failed/i, 'Keine Verbindung zur Datenbank.'],
  ]
  const hit = table.find(([re]) => re.test(msg))
  if (hit) return new BackendError(hit[1])
  // Eigene Meldungen aus unseren Triggern (raise exception) dürfen durch
  if ((error as { code?: string } | null)?.code === 'P0001') return new BackendError(msg)
  // Alles andere (SQL-Details usw.) nur ins Log
  console.error('[supabase]', error)
  return new BackendError('Da ist was schiefgelaufen. Bitte nochmal versuchen.')
}

function unwrap<T>({ data, error }: { data: T; error: PostgrestError | null }): T {
  if (error) throw germanError(error)
  return data
}

export async function createSupabaseBackend(): Promise<Backend> {
  const sb = await createSupabase()

  // Einmal pro Request: wer ist eingeloggt?
  let userIdPromise: Promise<string | null> | null = null
  const currentUserId = () =>
    (userIdPromise ??= sb.auth.getUser().then(({ data }) => data.user?.id ?? null))
  async function needUserId() {
    const id = await currentUserId()
    if (!id) throw new BackendError('Bitte zuerst einloggen.')
    return id
  }
  async function loadProfile(id: string) {
    return mapProfile(unwrap(await sb.from('profiles').select('*').eq('id', id).maybeSingle()))
  }
  async function fetchAll(make: () => any): Promise<Row[]> {
    const out: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const rows = unwrap<Row[]>(await make().range(from, from + PAGE - 1))
      out.push(...rows)
      if (rows.length < PAGE) return out
    }
  }
  async function removeShopImages(shopId: string) {
    const { data, error } = await sb.storage.from(IMAGE_BUCKET).list(shopId)
    if (error) throw germanError(error)
    if (data?.length) {
      const { error: rmError } = await sb.storage.from(IMAGE_BUCKET).remove(data.map((f) => `${shopId}/${f.name}`))
      if (rmError) throw germanError(rmError)
    }
  }

  return {
    kind: 'supabase',

    // ---------- Konto ----------
    async getCurrentUser() {
      const id = await currentUserId()
      return id ? loadProfile(id) : null
    },
    async signUp({ email, password, username, redirectTo }) {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username }, emailRedirectTo: redirectTo },
      })
      if (error) throw germanError(error)
      userIdPromise = null
      return { needsConfirmation: !data.session }
    },
    async signIn({ email, password }) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw germanError(error)
      userIdPromise = null
    },
    async signInWithOAuth({ provider, redirectTo }) {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      })
      if (error || !data.url) throw germanError(error ?? { message: 'Google-Login konnte nicht gestartet werden.' })
      return { url: data.url }
    },
    async signOut() {
      const { error } = await sb.auth.signOut()
      if (error) throw germanError(error)
      userIdPromise = null
    },

    // ---------- Profile ----------
    async getProfileByUsername(username) {
      return mapProfile(unwrap(await sb.from('profiles').select('*').eq('username', username).maybeSingle()))
    },
    async updateMyProfile({ displayName, bio }) {
      const id = await needUserId()
      unwrap(await sb.from('profiles').update({ display_name: displayName, bio }).eq('id', id))
    },
    async setMyAvatar(image) {
      const id = await needUserId()
      const bucket = sb.storage.from(AVATAR_BUCKET)
      // Alte Bilder weg, neues unter eindeutigem Namen (kein Cache-Ärger)
      const { data: old, error: listError } = await bucket.list(id)
      if (listError) throw germanError(listError)
      let path: string | null = null
      if (image) {
        path = `${id}/${Date.now()}.jpg`
        const { error } = await bucket.upload(path, image.bytes, { contentType: image.contentType, upsert: false })
        if (error) throw germanError(error)
      }
      unwrap(await sb.from('profiles').update({ avatar_path: path }).eq('id', id))
      if (old?.length) {
        const { error } = await bucket.remove(old.map((f) => `${id}/${f.name}`))
        if (error) console.error('[supabase] altes Profilbild nicht gelöscht', error)
      }
    },
    async isUsernameTaken(username) {
      const pattern = username.replace(/[\\%_]/g, '\\$&')
      const { count, error } = await sb.from('profiles').select('id', { count: 'exact', head: true }).ilike('username', pattern)
      if (error) throw germanError(error)
      return (count ?? 0) > 0
    },

    // ---------- Kriterien ----------
    async listCriteria() {
      return (unwrap(await sb.from('criteria').select('*').order('sort_order')) ?? []).map(mapCriterion)
    },
    async saveCriterion(c) {
      unwrap(await sb.from('criteria').upsert({
        key: c.key, label: c.label, description: c.description, sort_order: c.sortOrder, active: c.active, weight: c.weight,
      }))
    },

    // ---------- Läden ----------
    async listShops() {
      return (await fetchAll(() => sb.from('shops').select('*').order('name'))).map((r) => mapShop(r)!)
    },
    async getShopBySlug(slug) {
      return mapShop(unwrap(await sb.from('shops').select('*').eq('slug', slug).maybeSingle()))
    },
    async getShopById(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      return mapShop(unwrap(await sb.from('shops').select('*').eq('id', id).maybeSingle()))
    },
    async createShop(input) {
      return mapShop(unwrap(await sb.from('shops').insert(shopRow(input)).select().single()))!
    },
    async updateShop(id, input) {
      return mapShop(unwrap(await sb.from('shops').update(shopRow(input)).eq('id', id).select().single()))!
    },
    async deleteShop(id) {
      // Pfade der Community-Fotos merken, bevor die Zeilen per Cascade verschwinden
      const photos = unwrap(await sb.from('shop_photos').select('path').eq('shop_id', id)) as Row[]
      unwrap(await sb.from('shops').delete().eq('id', id))
      if (photos.length) {
        const { error } = await sb.storage.from(IMAGE_BUCKET).remove(photos.map((p) => p.path))
        if (error) console.error('[supabase] Community-Fotos nicht gelöscht', error)
      }
      // Laden ist weg – verwaiste Fotos sind dann nur noch Aufräumarbeit
      await removeShopImages(id).catch((e) => console.error('[supabase] Fotos nicht gelöscht', e))
    },
    async setShopImage(shopId, image) {
      // Alte Fotos des Ladens weg, neues unter eindeutigem Namen (kein Cache-Ärger)
      await removeShopImages(shopId)
      let url: string | null = null
      if (image) {
        const path = `${shopId}/${Date.now()}.jpg`
        const { error } = await sb.storage.from(IMAGE_BUCKET).upload(path, image.bytes, { contentType: image.contentType, upsert: false })
        if (error) throw germanError(error)
        url = sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
      }
      unwrap(await sb.from('shops').update({ image_url: url }).eq('id', shopId))
      return url
    },

    // ---------- Community-Fotos ----------
    async listPhotosForShop(shopId) {
      const rows = unwrap(
        await sb.from('shop_photos').select('*, author:profiles(username, display_name, avatar_path)').eq('shop_id', shopId).order('created_at', { ascending: false }),
      ) as Row[]
      return rows.map((r) => ({
        id: r.id, shopId: r.shop_id, userId: r.user_id, createdAt: r.created_at,
        url: sb.storage.from(IMAGE_BUCKET).getPublicUrl(r.path).data.publicUrl,
        author: r.author ? { username: r.author.username, displayName: r.author.display_name, avatarUrl: avatarUrl(r.author.avatar_path) } : null,
      }))
    },
    async listAllPhotos() {
      const rows = await fetchAll(() => sb.from('shop_photos').select('id, shop_id, user_id').order('id'))
      return rows.map((r) => ({ shopId: r.shop_id, userId: r.user_id }))
    },
    async addMyShopPhoto(shopId, image) {
      const userId = await needUserId()
      // Erst die Zeile (Trigger prüft die Limits), dann die Datei – schlägt der Upload fehl, Zeile wieder weg
      const path = `community/${shopId}/${userId}/${Date.now()}.jpg`
      const row = unwrap(await sb.from('shop_photos').insert({ shop_id: shopId, user_id: userId, path }).select('id').single()) as Row
      const { error } = await sb.storage.from(IMAGE_BUCKET).upload(path, image.bytes, { contentType: image.contentType, upsert: false })
      if (error) {
        await sb.from('shop_photos').delete().eq('id', row.id)
        throw germanError(error)
      }
    },
    async deleteShopPhoto(photoId) {
      if (!/^[0-9a-f-]{36}$/i.test(photoId)) throw new BackendError('Foto nicht gefunden.')
      // RLS lässt nur eigene Fotos (oder Admins) durch – ohne Treffer kommt nichts zurück
      const rows = unwrap(await sb.from('shop_photos').delete().eq('id', photoId).select('path')) as Row[]
      if (!rows.length) throw new BackendError('Foto nicht gefunden oder nicht deins.')
      const { error } = await sb.storage.from(IMAGE_BUCKET).remove(rows.map((r) => r.path))
      if (error) console.error('[supabase] Foto-Datei nicht gelöscht', error)
    },

    // ---------- Bewertungen ----------
    async listAllRatings() {
      const rows = await fetchAll(() => sb.from('ratings').select('id, shop_id, user_id, scores, fazit').order('id'))
      return rows.map((r) => ({ shopId: r.shop_id, userId: r.user_id, scores: r.scores, hasFazit: !!r.fazit?.trim() }))
    },
    async listRatingsForShop(shopId) {
      const rows = unwrap(await sb.from('ratings').select(RATING_SELECT).eq('shop_id', shopId).order('updated_at', { ascending: false }))
      return (rows as Row[]).map(mapRating)
    },
    async listRatingsByUser(userId) {
      const rows = unwrap(
        await sb.from('ratings').select(RATING_SELECT + ', shop:shops(name, slug)').eq('user_id', userId).order('updated_at', { ascending: false }),
      )
      return (rows as Row[]).map(mapRating)
    },
    async saveMyRating(shopId, { scores, fazit }) {
      const userId = await needUserId()
      unwrap(await sb.from('ratings').upsert({ shop_id: shopId, user_id: userId, scores, fazit }, { onConflict: 'shop_id,user_id' }))
    },
    async deleteMyRating(shopId) {
      const userId = await needUserId()
      unwrap(await sb.from('ratings').delete().eq('shop_id', shopId).eq('user_id', userId))
    },
    async deleteRating(ratingId) {
      unwrap(await sb.from('ratings').delete().eq('id', ratingId))
    },

    // ---------- Vorschläge ----------
    async createSuggestion(input) {
      const userId = await needUserId()
      unwrap(await sb.from('suggestions').insert({
        name: input.name, address: input.address, maps_url: input.mapsUrl, note: input.note, suggested_by: userId,
      }))
    },
    async listMySuggestions() {
      const userId = await needUserId()
      const rows = unwrap(await sb.from('suggestions').select(SUGGESTION_SELECT).eq('suggested_by', userId).order('created_at', { ascending: false }))
      return (rows as Row[]).map(mapSuggestion)
    },
    async listSuggestions() {
      return (await fetchAll(() => sb.from('suggestions').select(SUGGESTION_SELECT).order('created_at', { ascending: false }))).map(mapSuggestion)
    },
    async getSuggestion(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const row = unwrap(await sb.from('suggestions').select(SUGGESTION_SELECT).eq('id', id).maybeSingle())
      return row ? mapSuggestion(row as Row) : null
    },
    async reviewSuggestion(id, { status, adminNote, shopId }) {
      const userId = await needUserId()
      unwrap(await sb.from('suggestions').update({
        status, admin_note: adminNote, shop_id: shopId, reviewed_by: userId, reviewed_at: new Date().toISOString(),
      }).eq('id', id))
    },
  }
}
