import { UserError } from '../errors'

// ---------------------------------------------------------------
//  Domänentypen + Backend-Vertrag
//
//  Die gesamte Seite spricht nur über das Interface `Backend` mit der
//  Datenhaltung – und zwar ausschließlich auf dem Server. Wer von Supabase
//  weg will, implementiert dieses Interface neu (siehe demo/ als Beispiel)
//  und trägt es in data/index.ts ein. Keine Seite, kein Formular muss sich
//  dafür ändern.
// ---------------------------------------------------------------

export type Role = 'user' | 'admin'

export interface Profile {
  id: string
  username: string
  displayName: string | null
  bio: string | null
  role: Role
  createdAt: string
}

export interface Criterion {
  key: string
  label: string
  description: string | null
  sortOrder: number
  active: boolean
}

export interface Shop {
  id: string
  slug: string
  name: string
  address: string
  district: string | null
  lat: number
  lng: number
  mapsUrl: string
  doenerPrice: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type ShopInput = Omit<Shop, 'id' | 'createdAt' | 'updatedAt'>

/** z. B. { preis: 8, auswahl: 7.5, sosse: 9, fleisch: 8 } */
export type Scores = Record<string, number>

export interface Author {
  username: string
  displayName: string | null
  role: Role
}

export interface Rating {
  id: string
  shopId: string
  userId: string
  scores: Scores
  fazit: string | null
  createdAt: string
  updatedAt: string
  author: Author | null
  shop?: { name: string; slug: string } | null
}

/** Schlanke Variante für die Rankings */
export interface RatingLite {
  shopId: string
  scores: Scores
  authorRole: Role
}

export type SuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface Suggestion {
  id: string
  name: string
  address: string | null
  mapsUrl: string | null
  note: string | null
  suggestedBy: string
  suggester: { username: string; displayName: string | null } | null
  status: SuggestionStatus
  adminNote: string | null
  shopId: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface SuggestionInput {
  name: string
  address: string | null
  mapsUrl: string | null
  note: string | null
}

/**
 * Alle Methoden werfen bei Fehlern ein `BackendError` mit einer deutschen,
 * anzeigbaren Meldung. Berechtigungen prüft das Backend selbst (bei Supabase
 * per Row Level Security) – die Server Actions prüfen zusätzlich.
 */
export interface Backend {
  readonly kind: string

  // Konto
  getCurrentUser(): Promise<Profile | null>
  signUp(input: { email: string; password: string; username: string; redirectTo: string }): Promise<{ needsConfirmation: boolean }>
  signIn(input: { email: string; password: string }): Promise<void>
  signOut(): Promise<void>
  /**
   * Optional: Login über einen externen Anbieter (Google). Liefert die URL,
   * zu der der Browser weitergeleitet wird. Backends ohne OAuth lassen das weg,
   * dann wird der Button nicht angezeigt.
   */
  signInWithOAuth?(input: { provider: 'google'; redirectTo: string }): Promise<{ url: string }>

  // Profile
  getProfileByUsername(username: string): Promise<Profile | null>
  updateMyProfile(input: { displayName: string | null; bio: string | null }): Promise<void>
  isUsernameTaken(username: string): Promise<boolean>

  // Kriterien
  listCriteria(): Promise<Criterion[]>
  saveCriterion(c: Criterion): Promise<void>

  // Läden
  listShops(): Promise<Shop[]>
  getShopBySlug(slug: string): Promise<Shop | null>
  getShopById(id: string): Promise<Shop | null>
  createShop(input: ShopInput): Promise<Shop>
  updateShop(id: string, input: ShopInput): Promise<Shop>
  deleteShop(id: string): Promise<void>

  // Bewertungen (eine pro Nutzer und Laden)
  listAllRatings(): Promise<RatingLite[]>
  listRatingsForShop(shopId: string): Promise<Rating[]>
  listRatingsByUser(userId: string): Promise<Rating[]>
  saveMyRating(shopId: string, input: { scores: Scores; fazit: string | null }): Promise<void>
  deleteMyRating(shopId: string): Promise<void>
  deleteRating(ratingId: string): Promise<void>

  // Vorschläge
  createSuggestion(input: SuggestionInput): Promise<void>
  listMySuggestions(): Promise<Suggestion[]>
  listSuggestions(): Promise<Suggestion[]>
  getSuggestion(id: string): Promise<Suggestion | null>
  reviewSuggestion(id: string, input: { status: 'approved' | 'rejected'; adminNote: string | null; shopId: string | null }): Promise<void>
}

/** Fehler aus dem Backend mit anzeigbarer Meldung */
export class BackendError extends UserError {}
