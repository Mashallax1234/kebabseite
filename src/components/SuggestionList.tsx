'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { rejectSuggestionAction } from '@/app/actions'
import { fmtDate, nameOf } from '@/lib/format'
import { isGoogleMapsUrl } from '@/lib/validate'
import type { Suggestion } from '@/lib/data/types'
import { StatusTag } from './ui'

function SuggestionCard({ s }: { s: Suggestion }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const reject = () =>
    start(async () => {
      const r = await rejectSuggestionAction(s.id, note)
      setError(r.error ?? null)
    })

  return (
    <article className="box suggestion">
      <h3>
        {s.name} <StatusTag status={s.status} />
      </h3>
      {s.address && <p>{s.address}</p>}
      {s.mapsUrl && isGoogleMapsUrl(s.mapsUrl) && (
        <p>
          <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer">
            in Google Maps ansehen ↗
          </a>
        </p>
      )}
      {s.note && <p className="fazit-text">„{s.note}“</p>}
      <p className="muted small">
        von {s.suggester ? <Link href={`/u/${encodeURIComponent(s.suggester.username)}`}>{nameOf(s.suggester)}</Link> : 'unbekannt'} am{' '}
        {fmtDate(s.createdAt)}
        {s.reviewedAt && ` · bearbeitet ${fmtDate(s.reviewedAt)}`}
      </p>
      {s.adminNote && <p className="small">Deine Antwort: „{s.adminNote}“</p>}

      {s.status === 'pending' && !rejecting && (
        <div className="actions">
          <Link className="btn primary" href={`/admin/laden/neu?vorschlag=${encodeURIComponent(s.id)}`}>
            Als Laden anlegen
          </Link>
          <button className="btn" onClick={() => setRejecting(true)}>
            Ablehnen
          </button>
        </div>
      )}
      {s.status === 'pending' && rejecting && (
        <>
          <label className="field">
            <span>Kurze Begründung (sieht {s.suggester ? nameOf(s.suggester) : 'der Nutzer'})</span>
            <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn red" onClick={reject} disabled={pending}>
              Ablehnen
            </button>
            <button className="linkish" onClick={() => setRejecting(false)}>
              abbrechen
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  )
}

export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  const [showDone, setShowDone] = useState(false)
  const open = suggestions.filter((s) => s.status === 'pending')
  const done = suggestions.filter((s) => s.status !== 'pending')
  return (
    <>
      {open.length ? open.map((s) => <SuggestionCard key={s.id} s={s} />) : <p className="muted">Nichts offen.</p>}
      {done.length > 0 && (
        <>
          <p>
            <button className="linkish" onClick={() => setShowDone(!showDone)}>
              {showDone ? 'erledigte ausblenden' : `erledigte anzeigen (${done.length})`}
            </button>
          </p>
          {showDone && done.map((s) => <SuggestionCard key={s.id} s={s} />)}
        </>
      )}
    </>
  )
}
