# Mashallas Dönerliste

Ranking aller Dönerläden in der Gegend: Hallahsams eigenes Ranking, ein Community-Ranking aus den Nutzerbewertungen, eine Seite pro Laden mit Google-Maps-Navigation und eine Karte im GTA-Pausenmenü-Stil.

**Stack:** Next.js 16 (App Router, React 19, TypeScript) · Server Actions · Supabase (`@supabase/ssr`) · zod · MapLibre GL + OpenFreeMap · Vitest

## Loslegen

```bash
npm install
npm run dev
```

→ <http://localhost:3000>. Ohne weitere Einstellungen läuft die Seite im **Demo-Modus**: Die Daten liegen in `.data/demo.json`, Platzhalter-Läden sind schon drin.

| Login | Passwort | Rolle |
|---|---|---|
| `hallahsam@demo.de` | `demo` | Admin |
| `kallek@demo.de` | `demo` | normaler Nutzer |

Im Fußbereich gibt es „Demo zurücksetzen“.

```bash
npm test            # Ranking-/Noten-Logik und Validierung
npm run typecheck
npm run build
```

## Was die Seite kann

- **Ranking** (`/`): Tabelle wie in Excel, sortierbar, mit Suche. Umschalten zwischen *Hallahsams Ranking* (nur Admin-Bewertungen) und *Community-Ranking* (`/?ansicht=community`, alle anderen Nutzer).
- **Gesamtnote** = Durchschnitt aller aktiven Kriterien (1–10, halbe Punkte erlaubt). Gleiche Note = gleicher Platz.
- **Ladenseite** (`/laden/<slug>`): Hallahsams Urteil, Community-Schnitt, kleine Karte, Button „In Google Maps navigieren“ (hinterlegter Maps-Link), eigene Bewertung mit Fazit, Liste aller Fazits. Beim Teilen (z. B. in WhatsApp) erscheint ein Vorschaubild mit Note und Platz.
- **Bewerten**: nur mit Konto, eine Bewertung pro Nutzer und Laden, jederzeit änderbar oder löschbar.
- **Karte** (`/karte`): Blips nach Note eingefärbt, Legende, Info-Karte, „Meine Position“ mit Wegpunkt-Linie. Tasten: `←/→` Laden wechseln, `Enter` Details, `G` Navigation, `P` Position, `+/-` Zoom, `L` Legende, `Esc` zurück.
- **Vorschlagen** (`/vorschlagen`): Nutzer schlagen Läden vor und sehen den Status (offen / angenommen / abgelehnt mit Begründung).
- **Profile** (`/u/<name>`, `/profil`): Anzeigename, Bio und alle Bewertungen.
- **Admin** (`/admin`): Vorschläge annehmen (öffnet den Editor vorausgefüllt, Koordinaten werden aus dem Maps-Link gelesen) oder ablehnen, Läden anlegen, bearbeiten und löschen, Fazits moderieren, **Kriterien verwalten**.

### Neues Kriterium

Admin → Kriterien → unterste Zeile ausfüllen → „Anlegen“. Es taucht sofort überall auf. Alte Bewertungen ohne das neue Kriterium werden über die Kriterien gemittelt, die sie haben. Deaktivierte Kriterien zählen nicht mehr mit, die Werte bleiben aber gespeichert.

## Supabase anschließen

1. Projekt auf <https://supabase.com> anlegen.
2. **SQL Editor** → Inhalt von `supabase/schema.sql` einfügen → *Run*.
3. `.env.example` nach `.env.local` kopieren und ausfüllen:
   ```
   SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_…     (oder der alte anon-Key)
   SITE_URL=https://deine-domain.de
   ```
4. **Authentication → URL Configuration**: *Site URL* auf die echte Adresse setzen und `https://deine-domain.de/auth/callback` als Redirect-URL eintragen.
5. Hallahsam registriert sich ganz normal auf der Seite, mit Nutzername `Hallahsam`.
6. Im SQL Editor zum Admin machen:
   ```sql
   update public.profiles set role = 'admin' where lower(username) = 'hallahsam';
   ```
7. Optional: `supabase/seed.sql` ausführen, dann sind die Platzhalter-Läden mit Hallahsams Bewertungen drin.

### Google-Login einrichten

1. In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) unter *APIs & Dienste → Anmeldedaten* eine **OAuth-Client-ID** vom Typ *Webanwendung* anlegen. Vorher fragt Google einmal nach dem Zustimmungsbildschirm: App-Name, Support-Mail, Bereiche `email` und `profile`.
2. Bei *Autorisierte Weiterleitungs-URIs* die Callback-URL von Supabase eintragen:
   `https://DEIN-PROJEKT.supabase.co/auth/v1/callback`
3. Im Supabase-Dashboard unter **Authentication → Sign In / Providers → Google** aktivieren und Client-ID und Client-Secret einfügen.
4. Unter **Authentication → URL Configuration** muss `https://deine-domain.de/auth/callback` erlaubt sein (siehe oben). Lokal kommt `http://localhost:3000/auth/callback` dazu.

Wer sich zum ersten Mal per Google anmeldet, bekommt automatisch ein Profil. Der Nutzername wird aus dem Google-Namen gebildet (z. B. „Max Müller“ → `max_muller`, bei Doppelungen `max_muller2`), der Anzeigename ist der volle Name. Im Demo-Modus loggt der Google-Button einen Beispielnutzer „Gina Google“ ein.

Hat sich Hallahsam per Google angemeldet, geht das Admin-Machen im SQL Editor über die E-Mail-Adresse:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'hallahsams.adresse@gmail.com');
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

Texte wie Seitenname, Stadt und Admin-Name stehen in `src/lib/config.ts`.
