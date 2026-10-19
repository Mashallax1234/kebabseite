// Platzhalter-Daten für den Demo-Modus. Alle Läden, Adressen und Nutzer
// sind ausgedacht. Dieselben Läden gibt es als SQL in supabase/seed.sql.
import type { Criterion, Profile, Shop, Scores, SuggestionStatus } from '../types'

export interface DemoRating {
  id: string
  shopId: string
  userId: string
  scores: Scores
  fazit: string | null
  createdAt: string
  updatedAt: string
}

export interface DemoSuggestion {
  id: string
  name: string
  address: string | null
  mapsUrl: string | null
  note: string | null
  suggestedBy: string
  status: SuggestionStatus
  adminNote: string | null
  shopId: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface DemoPhoto {
  id: string
  shopId: string
  userId: string
  /** data:-URL, im Demo-Modus gibt es keinen Speicher-Bucket */
  url: string
  createdAt: string
}

export interface DemoDb {
  users: { id: string; email: string; password: string }[]
  profiles: Profile[]
  criteria: Criterion[]
  shops: Shop[]
  ratings: DemoRating[]
  suggestions: DemoSuggestion[]
  photos: DemoPhoto[]
}

const CRITERIA: Criterion[] = [
  { key: 'preis', label: 'Preis', description: 'Was bekommt man fürs Geld?', sortOrder: 1, active: true },
  { key: 'auswahl', label: 'Auswahl', description: 'Fleisch, Brot, Beilagen, Extras', sortOrder: 2, active: true },
  { key: 'sosse', label: 'Soße(n)', description: 'Geschmack, Menge, selbstgemacht oder Eimer', sortOrder: 3, active: true },
  { key: 'fleisch', label: 'Fleisch', description: 'Qualität, Würzung, saftig oder trocken', sortOrder: 4, active: true },
]

type UserRow = [username: string, displayName: string | null, bio: string | null, role: 'user' | 'admin']
const USERS: UserRow[] = [
  ['admin', 'Admin', 'Pflegt die Läden und schaut über die Vorschläge. Isst natürlich auch mit.', 'admin'],
  ['kalle_k', 'Kalle', 'Soße ist wichtiger als Fleisch. Diskutier ich gern aus.', 'user'],
  ['sanne', 'Sanne', 'Immer mit scharf.', 'user'],
  ['mo.b', 'Mo', 'Wohne quasi im Kapadokya.', 'user'],
  ['yusuf_eats', 'Yusuf', 'Mein Onkel hatte einen Imbiss. Ich bin streng.', 'user'],
  ['tobi', null, null, 'user'],
]

type ShopRow = [slug: string, name: string, address: string, district: string, lat: number, lng: number, price: number, scores: number[], fazit: string, tested: string]
const SHOPS: ShopRow[] = [
  ['kapadokya-grill', 'Kapadokya Grill', 'Musterstraße 14, 12043 Berlin', 'Neukölln', 52.4768, 13.439, 7.0, [8, 8, 9.5, 9],
    'Aktuell meine Nummer 1. Fleisch saftig und nicht zu fettig, die Knoblauchsoße machen sie selbst. Das Brot kommt nochmal kurz auf den Grill. Einziger Haken: mittags steht die Schlange bis draußen.', '2025-11-08'],
  ['bosporus-grill', 'Bosporus Grill', 'Beispielstraße 3, 10999 Berlin', 'Kreuzberg', 52.499, 13.4185, 7.5, [8, 7, 9, 9.5],
    'Bestes Fleisch, das ich hier gegessen hab. Die Auswahl ist eher klassisch, aber wer braucht schon zwölf Soßen.', '2025-06-21'],
  ['mangal-haus', 'Mangal Haus', 'Musterallee 88, 10781 Berlin', 'Schöneberg', 52.4905, 13.353, 8.0, [6, 9, 9, 9],
    'Qualität ganz oben, Preis leider auch. Riesige Auswahl, sogar gegrilltes Gemüse im Brot.', '2026-02-14'],
  ['sultan-doener', 'Sultan Döner', 'Platzhalterweg 21, 10245 Berlin', 'Friedrichshain', 52.5118, 13.4555, 7.0, [7, 8, 8.5, 8],
    'Solider Allrounder. Hier kann man nichts falsch machen, aber auch nicht vom Hocker fallen.', '2025-09-02'],
  ['anadolu-imbiss', 'Anadolu Imbiss', 'Beispielstraße 40, 12047 Berlin', 'Neukölln', 52.4842, 13.431, 6.5, [9, 6, 8, 8.5],
    'Fairer Preis, ehrliche Portion, kein Schnickschnack. Der Chef erkennt einen nach dem dritten Mal.', '2025-04-17'],
  ['kebap-kral', 'Kebap Kral', 'Musterstraße 7, 13353 Berlin', 'Wedding', 52.5495, 13.359, 6.0, [9.5, 7, 7, 7.5],
    'Günstigster guter Döner, den ich kenne. Nachts um drei der Retter.', '2025-03-01'],
  ['pasa-doener', 'Paşa Döner', 'Musterplatz 2, 10437 Berlin', 'Prenzlauer Berg', 52.5395, 13.4225, 7.5, [7, 7.5, 8, 7],
    'Ordentlich. Die Joghurtsoße ist schön dick und nicht so wässrig wie anderswo.', '2026-01-10'],
  ['yildiz-kebap', 'Yıldız Kebap', 'Beispielweg 55, 10965 Berlin', 'Kreuzberg', 52.4935, 13.3955, 7.0, [7.5, 6.5, 7, 8],
    'Fleisch gut gewürzt, der Rest unauffällig.', '2025-07-30'],
  ['istanbul-grillhaus', 'Istanbul Grillhaus', 'Musterstraße 101, 10119 Berlin', 'Mitte', 52.5268, 13.4035, 8.5, [5, 8, 7, 8],
    'Für Mitte okay. Aber 8,50 € für einen ganz normalen Döner ist frech.', '2025-10-11'],
  ['ali-baba-kebab', 'Ali Baba Kebab', 'Platzhalterstraße 9, 10551 Berlin', 'Moabit', 52.5285, 13.3425, 6.0, [8.5, 5, 6, 6.5],
    'Geht klar, wenn man eh in der Nähe ist. Extra hinfahren muss man nicht.', '2025-05-24'],
  ['efes-imbiss', 'Efes Imbiss', 'Beispielallee 12, 12101 Berlin', 'Tempelhof', 52.4705, 13.3855, 5.5, [9, 4, 5, 5],
    'Billig, und das schmeckt man auch. Soße aus dem Eimer.', '2025-08-09'],
  ['doener-ecke-bahnhof', 'Döner Ecke am Bahnhof', 'Bahnhofsplatz 1, 10317 Berlin', 'Lichtenberg', 52.5105, 13.4975, 5.0, [9, 3, 4, 4.5],
    'Hat mich nicht überzeugt. Fleisch trocken, Salat welk. Aber hey: 5 Euro.', '2026-03-22'],
]

type CommunityRow = [username: string, slug: string, scores: number[], fazit: string | null, day: string]
const COMMUNITY: CommunityRow[] = [
  ['kalle_k', 'kapadokya-grill', [8, 8, 10, 9], 'Die Knoblauchsoße ist ein Gedicht. Mindestens zweimal die Woche.', '2025-12-01'],
  ['mo.b', 'kapadokya-grill', [7, 9, 9, 9.5], 'Bester Laden in Neukölln, keine Diskussion. Nur die Schlange nervt.', '2026-01-15'],
  ['yusuf_eats', 'kapadokya-grill', [7, 8, 8, 8], 'Gut, aber nicht so übertrieben gut, wie alle sagen.', '2026-04-03'],
  ['kalle_k', 'bosporus-grill', [7, 7, 8, 9], 'Fleisch top, das Brot ist manchmal etwas trocken.', '2025-08-12'],
  ['sanne', 'bosporus-grill', [8, 6, 9, 9], 'Die scharfe Soße ist wirklich scharf. Endlich mal.', '2025-09-30'],
  ['tobi', 'bosporus-grill', [8, 7, 7, 8], null, '2026-05-05'],
  ['yusuf_eats', 'mangal-haus', [5, 9, 9, 9.5], 'Teuer, aber das Fleisch ist ehrlich. Kein Fabrik-Spieß.', '2026-03-01'],
  ['sanne', 'mangal-haus', [6, 8, 8, 8], 'Lecker, aber 8 € sind schon eine Ansage.', '2026-03-18'],
  ['mo.b', 'kebap-kral', [10, 6, 6, 7], 'Für den Preis unschlagbar. Nach dem Feiern perfekt.', '2025-06-06'],
  ['tobi', 'kebap-kral', [9, 7, 7, 7], 'Solide. Nicht mehr, nicht weniger.', '2025-11-20'],
  ['kalle_k', 'sultan-doener', [7, 8, 9, 8], 'Unterschätzt! Die Kräutersoße ist hausgemacht, das schmeckt man.', '2025-10-02'],
  ['sanne', 'pasa-doener', [7, 8, 7, 7], 'Guter Döner, netter Laden, nichts Besonderes.', '2026-02-09'],
  ['yusuf_eats', 'istanbul-grillhaus', [4, 7, 6, 7], 'Touristenpreise. Döner okay.', '2025-12-28'],
  ['tobi', 'doener-ecke-bahnhof', [9, 3, 3, 4], 'Man kriegt, wofür man bezahlt.', '2026-04-11'],
  ['mo.b', 'anadolu-imbiss', [9, 6, 8, 8], 'Sehr fair, sehr freundlich.', '2025-07-19'],
  ['kalle_k', 'ali-baba-kebab', [8, 5, 5, 6], 'Nur im Notfall.', '2025-06-30'],
  ['sanne', 'yildiz-kebap', [7, 7, 8, 8], 'Überraschend gut, der Salat ist immer frisch.', '2025-09-14'],
]

const KEYS = CRITERIA.map((c) => c.key)
const toScores = (arr: number[]): Scores => Object.fromEntries(arr.map((v, i) => [KEYS[i], v]))
const iso = (day: string) => new Date(day + 'T12:00:00Z').toISOString()
const userId = (username: string) => 'user-' + username.toLowerCase().replace(/[^a-z0-9]/g, '')
export const demoEmail = (username: string) => username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@demo.de'

export function seedData(): DemoDb {
  const users = USERS.map(([username]) => ({ id: userId(username), email: demoEmail(username), password: 'demo' }))
  const profiles: Profile[] = USERS.map(([username, displayName, bio, role]) => ({
    id: userId(username),
    username,
    displayName,
    bio,
    role,
    avatarUrl: null,
    createdAt: iso('2025-01-05'),
  }))

  const shops: Shop[] = SHOPS.map(([slug, name, address, district, lat, lng, price, , , tested]) => ({
    id: 'shop-' + slug,
    slug,
    name,
    address,
    district,
    lat,
    lng,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    doenerPrice: price,
    notes: null,
    imageUrl: null,
    createdAt: iso(tested),
    updatedAt: iso(tested),
  }))

  let n = 0
  const ratings: DemoRating[] = [
    ...SHOPS.map(([slug, , , , , , , scores, fazit, tested]) => ({
      id: 'r' + ++n,
      shopId: 'shop-' + slug,
      userId: userId('admin'),
      scores: toScores(scores),
      fazit,
      createdAt: iso(tested),
      updatedAt: iso(tested),
    })),
    ...COMMUNITY.map(([username, slug, scores, fazit, day]) => ({
      id: 'r' + ++n,
      shopId: 'shop-' + slug,
      userId: userId(username),
      scores: toScores(scores),
      fazit,
      createdAt: iso(day),
      updatedAt: iso(day),
    })),
  ]

  const suggestions: DemoSuggestion[] = [
    {
      id: 'sug-1', name: 'Lale Grill', address: 'Sonnenallee, irgendwo Höhe Nr. 90', mapsUrl: null,
      note: 'Mein Arbeitskollege schwört drauf. Angeblich mit Lammfleisch.', suggestedBy: userId('kalle_k'),
      status: 'pending', adminNote: null, shopId: null, createdAt: iso('2026-09-12'), reviewedAt: null,
    },
    {
      id: 'sug-2', name: 'Döner Palast', address: 'Musterweg 7, 13597 Berlin (Spandau)',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=52.536,13.204',
      note: 'Weit draußen, soll sich aber lohnen.', suggestedBy: userId('sanne'),
      status: 'pending', adminNote: null, shopId: null, createdAt: iso('2026-09-20'), reviewedAt: null,
    },
    {
      id: 'sug-3', name: 'Burger King', address: 'am Hauptbahnhof', mapsUrl: null,
      note: 'Hat auch Fleisch im Brot.', suggestedBy: userId('tobi'),
      status: 'rejected', adminNote: 'Netter Versuch.', shopId: null, createdAt: iso('2026-08-01'), reviewedAt: iso('2026-08-02'),
    },
  ]

  return { users, profiles, criteria: CRITERIA.map((c) => ({ ...c })), shops, ratings, suggestions, photos: [] }
}
