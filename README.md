# Kebabranking

Ranking aller Dönerläden in der Gegend, komplett aus Community-Bewertungen: eine Seite pro Laden mit Foto und Google-Maps-Navigation, Ränge mit XP für alle, die mitbewerten, und eine Karte im GTA-Pausenmenü-Stil mit „15 Min. zu Fuß“-Filter.

**Stack:** Next.js 16 (App Router, React 19, TypeScript) · Server Actions · Supabase (`@supabase/ssr`) · zod · MapLibre GL + OpenFreeMap · Vitest

## Loslegen

```bash
npm install
npm run dev
```

→ <http://localhost:3000>. Ohne weitere Einstellungen läuft die Seite im **Demo-Modus**: Die Daten liegen in `.data/demo.json`, Platzhalter-Läden sind schon drin.

| Login | Passwort | Rolle |
|---|---|---|
| `admin@demo.de` | `demo` | Admin |
| `kallek@demo.de` | `demo` | normaler Nutzer |

Im Fußbereich gibt es „Demo zurücksetzen“ (nach einem Update nötig, wenn die `demo.json` noch alte Daten hat).

```bash
npm test            # Ranking-/Noten-Logik und Validierung
npm run typecheck
npm run build
```

## Was die Seite kann

- **Ranking** (`/`): Tabelle wie in Excel, sortierbar, mit Suche. Jede Bewertung zählt gleich – auch die von Admins. Es gibt nur noch das Community-Ranking.
- **Gesamtnote** = Durchschnitt aller aktiven Kriterien (1–10, halbe Punkte erlaubt), gemittelt über alle Bewertungen. Gleiche Note = gleicher Platz, bei Gleichstand stehen Läden mit mehr Stimmen oben.
- **Ladenseite** (`/laden/<slug>`): Foto, Community-Schnitt, kleine Karte, Button „In Google Maps navigieren“ (hinterlegter Maps-Link), eigene Bewertung mit Fazit, Liste aller Fazits mit dem Rang der Verfasser. Beim Teilen (z. B. in WhatsApp) erscheint ein Vorschaubild mit Note und Platz.
- **Bewerten**: nur mit Konto, eine Bewertung pro Nutzer und Laden, jederzeit änderbar oder löschbar.
- **Fotos**: Jeder eingeloggte Nutzer kann auf der Ladenseite Fotos hochladen (bis zu 5 pro Laden). Sie werden im Browser auf max. 900 px / JPEG 70 % verkleinert und landen im Supabase-Bucket `shop-images`. Eigene Fotos kann man löschen, Admins alle. Ohne Titelfoto vom Admin zeigt die Ladenseite das neueste Community-Foto.
- **Karte** (`/karte`): Blips nach Note eingefärbt, Legende, Info-Karte, „Meine Position“ mit Wegpunkt-Linie, „In meiner Nähe · 15 Min“ (Standort per Browser, zeigt Karte und Liste nur für Läden im Umkreis von 1,2 km). Tasten: `←/→` Laden wechseln, `Enter` Details, `G` Navigation, `P` Position, `N` 15-Min.-Radius, `+/-` Zoom, `L` Legende, `Esc` zurück.
- **Vorschlagen** (`/vorschlagen`): Nutzer schlagen Läden vor und sehen den Status (offen / angenommen / abgelehnt mit Begründung).
- **Profile** (`/u/<name>`, `/profil`): Profilbild (im Browser quadratisch zugeschnitten, 320 px, Bucket `avatars`; ohne Bild Initialen), Anzeigename, Bio, Rang mit XP-Balken und alle Bewertungen. Das Profilbild erscheint auch bei Fazits und Fotos.
- **Ränge**: Jede Bewertung bringt 3 XP, mit Fazit 5 XP, jedes Foto 2 XP (gelöschte Bewertungen und Fotos zählen nicht mehr). Stufen: Karlsruher (0–5), Gelegenheitsdöner (6–20), Macher (21–50), Experte (51–100), Jumbo (ab 101). Werte und Namen stehen in `src/lib/config.ts` (`XP`, `LEVELS`).
- **Admin** (`/admin`): Vorschläge annehmen (öffnet den Editor vorausgefüllt, Koordinaten werden aus dem Maps-Link gelesen) oder ablehnen, Läden anlegen, bearbeiten und löschen, Titelfoto setzen, Fotos moderieren, Fazits moderieren, **Kriterien verwalten**.

### Neues Kriterium

Admin → Kriterien → unterste Zeile ausfüllen → „Anlegen“. Es taucht sofort überall auf. Alte Bewertungen ohne das neue Kriterium werden über die Kriterien gemittelt, die sie haben. Deaktivierte Kriterien zählen nicht mehr mit, die Werte bleiben aber gespeichert.

## Supabase anschließen

1. Projekt auf <https://supabase.com> anlegen.
2. **SQL Editor** → Inhalt von `supabase/schema.sql` einfügen → *Run*. Legt auch den öffentlichen Storage-Bucket `shop-images` für Ladenfotos an (nur Admins dürfen hochladen).
3. `.env.example` nach `.env.local` kopieren und ausfüllen:
   ```
   SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_…     (oder der alte anon-Key)
   SITE_URL=https://deine-domain.de
   ```
4. **Authentication → URL Configuration**: *Site URL* auf die echte Adresse setzen und `https://deine-domain.de/auth/callback` als Redirect-URL eintragen.
5. Der künftige Admin registriert sich ganz normal auf der Seite, z. B. mit Nutzername `admin`.
6. Im SQL Editor zum Admin machen:
   ```sql
   update public.profiles set role = 'admin' where lower(username) = 'admin';
   ```
7. Optional: `supabase/seed.sql` ausführen, dann sind die Platzhalter-Läden mit ein paar Start-Bewertungen des Admins drin.

### Google-Login einrichten

1. In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) unter *APIs & Dienste → Anmeldedaten* eine **OAuth-Client-ID** vom Typ *Webanwendung* anlegen. Vorher fragt Google einmal nach dem Zustimmungsbildschirm: App-Name, Support-Mail, Bereiche `email` und `profile`.
2. Bei *Autorisierte Weiterleitungs-URIs* die Callback-URL von Supabase eintragen:
   `https://DEIN-PROJEKT.supabase.co/auth/v1/callback`
3. Im Supabase-Dashboard unter **Authentication → Sign In / Providers → Google** aktivieren und Client-ID und Client-Secret einfügen.
4. Unter **Authentication → URL Configuration** muss `https://deine-domain.de/auth/callback` erlaubt sein (siehe oben). Lokal kommt `http://localhost:3000/auth/callback` dazu.

Wer sich zum ersten Mal per Google anmeldet, bekommt automatisch ein Profil. Der Nutzername wird aus dem Google-Namen gebildet (z. B. „Max Müller“ → `max_muller`, bei Doppelungen `max_muller2`), der Anzeigename ist der volle Name. Im Demo-Modus loggt der Google-Button einen Beispielnutzer „Gina Google“ ein.

Hat sich der Admin per Google angemeldet, geht das Admin-Machen im SQL Editor über die E-Mail-Adresse:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin.adresse@gmail.com');
```

Die Rechte werden in der Datenbank per Row Level Security durchgesetzt. Die Server Actions prüfen zusätzlich. Ein normaler Nutzer kann also auch mit Tricks keine Läden anlegen oder fremde Bewertungen ändern.

## Sicherheit

Was im Code steckt:

- **Rechte doppelt:** Jede Server Action prüft Login und Rolle selbst. Zusätzlich setzt Supabase alles per Row Level Security durch, auf allen Tabellen. Die Standardrechte von Supabase werden erst entzogen und dann gezielt vergeben. Nutzer können an ihrem Profil nur Anzeigename und Bio ändern.
- **Eingaben:** Alles, was vom Browser kommt, wird serverseitig mit zod geprüft. Die Datenbank hat dazu eigene Checks und Trigger. Links in Vorschlägen müssen echte Google-Maps-Links sein, damit sich nichts wie `javascript:` unterschieben lässt.
- **XSS:** React escaped alle Nutzertexte. An der einzigen Stelle mit `innerHTML` (Blips auf der Karte) wird extra escaped. Dazu kommt eine **Content Security Policy mit Nonce pro Request**: Eingeschleustes JavaScript würde nicht ausgeführt.
- **Header:** HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (nur Standort, nur eigene Seite) und `Cross-Origin-Opener-Policy`. Der `X-Powered-By`-Header ist aus.
- **Weiterleitungen:** `?weiter=` akzeptiert nur Pfade der eigenen Seite (Schutz vor Open Redirect). OAuth-Rücksprünge bauen in Produktion immer auf `SITE_URL` auf, nie auf dem Host-Header.
- **Spam:** Rate-Limits in den Server Actions (Login, Registrierung, Bewertungen, Vorschläge) und verbindlich in der Datenbank: max. 30 Bewertungs-Änderungen pro 10 Minuten, 5 Vorschläge pro Tag, 10 offene Vorschläge pro Nutzer.
- **Geheimnisse:** Nur der öffentliche Publishable/Anon-Key wird genutzt, und auch der nur auf dem Server. Der Service-Role-Key wird nirgends gebraucht und gehört **nie** in den Code oder in `.env`. `.env*` steht in `.gitignore`.
- **Fehlermeldungen:** Der Browser bekommt nur verständliche Meldungen, technische Details landen im Server-Log.
- **Demo-Modus** (bekannte Zugangsdaten): In Produktion gesperrt, die Seite startet dann nicht. Nur mit `ALLOW_DEMO_IN_PRODUCTION=true` ginge es, das bitte nie auf der echten Seite setzen.

Das musst du im **Supabase-Dashboard** selbst einstellen:

- *Authentication → Providers → Email*: „Confirm email“ an.
- *Authentication → Policies / Passwords*: Mindestlänge auf 10 setzen und „Leaked password protection“ an (dafür ist der Pro-Plan nötig).
- *Authentication → Rate Limits*: Die Standardwerte reichen. Bei Bot-Problemen unter *Attack Protection* ein CAPTCHA (hCaptcha/Turnstile) aktivieren.
- *Authentication → URL Configuration*: nur die eigene Domain und `localhost` erlauben, keine Wildcards.
- Nach jeder Änderung an `supabase/schema.sql` das Skript nochmal ausführen. Danach im *Security Advisor* prüfen, ob Warnungen offen sind.

Beim **Hosting**: nur über HTTPS ausliefern (Vercel macht das automatisch) und `SITE_URL` setzen.

## Backend wechseln

Der Browser spricht **nie direkt** mit Supabase. Alles läuft über Server Components und Server Actions, und die kennen nur das Interface `Backend` aus `src/lib/data/types.ts`.

```
src/lib/data/
  types.ts            Domänentypen + Interface `Backend` (der Vertrag)
  index.ts            wählt das Backend (DATA_BACKEND / SUPABASE_URL)
  supabase/           Supabase-Implementierung
  demo/               Demo-Implementierung (JSON-Datei), gutes Beispiel
```

Für ein neues Backend (PocketBase, Firebase, eigene Postgres-DB mit Drizzle …):

1. `src/lib/data/<name>/backend.ts` anlegen und `Backend` implementieren.
2. In `src/lib/data/index.ts` bei `factories` eintragen.
3. `DATA_BACKEND=<name>` setzen.

Ranking und Noten rechnet `src/lib/scores.ts`. Das Backend liefert nur Rohdaten.

## Deployen

Am einfachsten über **Vercel**: Repo verbinden und die Umgebungsvariablen aus Schritt 3 eintragen, fertig. Jeder andere Node-Host mit `npm run build && npm start` geht auch.

Der Demo-Modus ist nur für die lokale Entwicklung gedacht. Auf Serverless-Hosts bleiben Änderungen dort nicht erhalten.

Die Kartendaten kommen von [OpenFreeMap](https://openfreemap.org): kostenlos, ohne Key und ohne Anmeldung.

> Öffentliche Seite mit Nutzerkonten in Deutschland: Impressum und Datenschutzerklärung nicht vergessen.

## Aufbau

```
src/app/
  (site)/             alle Seiten mit Kopf- und Fußzeile
    page.tsx          Ranking
    laden/[slug]/     Ladenseite + Vorschaubild (opengraph-image)
    admin/            Admin-Bereich + Laden-Editor
    …
  karte/              Vollbild-Karte (eigenes Layout, map.css)
  actions.ts          alle Server Actions (Schreibzugriffe)
  auth/callback/      Bestätigungslink aus der Registrierungs-Mail
src/components/       UI-Bausteine (GtaMap, RatingForm, ShopEditor, …)
src/lib/              config, scores, validate (zod), format, gtaStyle
src/proxy.ts          hält die Supabase-Sitzung frisch
supabase/             schema.sql, seed.sql
scripts/              kopiert den MapLibre-Worker nach public/ (läuft automatisch)
```

Texte wie Seitenname und Stadt, die Ränge, der 15-Min.-Radius und die Fotogröße stehen in `src/lib/config.ts`.
