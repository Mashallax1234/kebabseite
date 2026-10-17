'use client'
// Einfache Formulare, die direkt eine Server Action aufrufen.
import Link from 'next/link'
import { useActionState, useState } from 'react'
import {
  loginAction,
  registerAction,
  suggestAction,
  updateProfileAction,
  type ActionResult,
} from '@/app/actions'
import { USERNAME_RE } from '@/lib/validate'

function Feedback({ state }: { state: ActionResult }) {
  if (state.error) return <p className="error">{state.error}</p>
  if (state.ok) return <p className="ok">{state.ok}</p>
  return null
}

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const [state, action, pending] = useActionState(loginAction, {})
  return (
    <form className="box narrow" action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>E-Mail{demo && ' oder Nutzername'}</span>
        <input name="email" type={demo ? 'text' : 'email'} autoComplete="username" required />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Feedback state={state} />
      <button className="btn primary" disabled={pending}>
        Einloggen
      </button>
      <p className="small">
        Noch kein Konto? <Link href={'/registrieren' + (next !== '/' ? '?weiter=' + encodeURIComponent(next) : '')}>Hier anlegen</Link>.
      </p>
      {demo && (
        <p className="hint">
          Demo: <code>hallahsam@demo.de</code> / <code>demo</code> ist Admin, <code>kallek@demo.de</code> / <code>demo</code> ist ein
          normaler Nutzer.
        </p>
      )}
    </form>
  )
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, {})
  const [username, setUsername] = useState('')
  const nameOk = !username || USERNAME_RE.test(username)

  if (state.ok) return <p className="ok narrow">{state.ok}</p>

  return (
    <form className="box narrow" action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Nutzername</span>
        <input
          name="username"
          type="text"
          required
          minLength={3}
          maxLength={24}
          autoComplete="nickname"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <span className={'hint' + (nameOk ? '' : ' bad')}>3–24 Zeichen: Buchstaben, Zahlen, _ und Punkt. Wird öffentlich angezeigt.</span>
      </label>
      <label className="field">
        <span>E-Mail</span>
        <input name="email" type="email" required autoComplete="email" />
        <span className="hint">Wird nicht angezeigt.</span>
      </label>
      <label className="field">
        <span>Passwort</span>
        <input name="password" type="password" required minLength={6} autoComplete="new-password" />
      </label>
      <Feedback state={state} />
      <button className="btn primary" disabled={pending || !nameOk}>
        Konto anlegen
      </button>
      <p className="small">
        Schon dabei? <Link href="/login">Einloggen</Link>.
      </p>
    </form>
  )
}

export function SuggestForm() {
  const [state, action, pending] = useActionState(suggestAction, {})
  return (
    <>
      <form className="box narrow" action={action} key={state.ok /* nach Erfolg leeren */}>
        <label className="field">
          <span>Name des Ladens *</span>
          <input name="name" type="text" required maxLength={80} />
        </label>
        <label className="field">
          <span>Adresse oder ungefähr wo</span>
          <input name="address" type="text" maxLength={160} placeholder="z. B. Sonnenallee Ecke Pannierstraße" />
        </label>
        <label className="field">
          <span>Google-Maps-Link</span>
          <input name="mapsUrl" type="url" placeholder="https://maps.app.goo.gl/…" />
          <span className="hint">In Google Maps auf „Teilen“ und dann „Link kopieren“. Adresse oder Link reicht.</span>
        </label>
        <label className="field">
          <span>Warum sollte der auf die Liste?</span>
          <textarea name="note" rows={3} maxLength={1000} />
        </label>
        <Feedback state={state} />
        <button className="btn primary" disabled={pending}>
          Vorschlag abschicken
        </button>
      </form>
    </>
  )
}

export function ProfileForm({ displayName, bio }: { displayName: string; bio: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, {})
  return (
    <form className="box narrow" action={action}>
      <label className="field">
        <span>Anzeigename</span>
        <input name="displayName" type="text" maxLength={40} defaultValue={displayName} />
      </label>
      <label className="field">
        <span>Über dich</span>
        <textarea name="bio" rows={3} maxLength={500} placeholder="Lieblingssoße, Stammladen, …" defaultValue={bio} />
      </label>
      <Feedback state={state} />
      <button className="btn primary" disabled={pending}>
        Speichern
      </button>
    </form>
  )
}
