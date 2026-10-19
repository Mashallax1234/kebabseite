'use client'
import { useEffect, useState, useTransition } from 'react'
import { deleteMyRatingAction, saveRatingAction, type ActionResult } from '@/app/actions'
import { XP } from '@/lib/config'
import { fmtDate } from '@/lib/format'
import { isComplete, pickActive, ratingOverall } from '@/lib/scores'
import { validateScores } from '@/lib/validate'
import type { Criterion, Rating } from '@/lib/data/types'
import { ScoreInputs } from './ScoreInputs'
import { Score } from './ui'

export function RatingForm({
  shopId,
  criteria,
  mine,
}: {
  shopId: string
  criteria: Criterion[]
  mine: Rating | null
}) {
  const [scores, setScores] = useState(() => pickActive(mine?.scores, criteria))
  const [fazit, setFazit] = useState(mine?.fazit ?? '')
  const [result, setResult] = useState<ActionResult>({})
  const [pending, start] = useTransition()

  // Nach Speichern/Löschen kommt eine neue Version vom Server – Formular nachziehen
  useEffect(() => {
    setScores(pickActive(mine?.scores, criteria))
    setFazit(mine?.fazit ?? '')
  }, [mine?.id, mine?.updatedAt])

  const complete = isComplete(scores, criteria)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      validateScores(scores, criteria)
    } catch (err) {
      return setResult({ error: (err as Error).message })
    }
    start(async () => {
      const r = await saveRatingAction(shopId, scores, fazit)
      setResult(r.error ? r : { ok: mine ? 'Gespeichert.' : 'Danke! Deine Bewertung ist drin.' })
    })
  }

  function remove() {
    if (!confirm('Deine Bewertung wirklich löschen?')) return
    start(async () => setResult(await deleteMyRatingAction(shopId)))
  }

  return (
    <form className="box rating-form" onSubmit={submit}>
      <h2>{mine ? 'Deine Bewertung' : 'Selbst bewerten'}</h2>
      {mine ? (
        <p className="hint">
          Bewertet am {fmtDate(mine.createdAt)}
          {mine.updatedAt !== mine.createdAt && `, zuletzt geändert am ${fmtDate(mine.updatedAt)}`}. Du kannst deine
          Bewertung jederzeit ändern.
        </p>
      ) : (
        <p className="hint">
          Eine Bewertung pro Laden, später ändern geht jederzeit. Bringt {XP.rating} XP, mit Fazit {XP.rating + XP.fazit} XP.
        </p>
      )}

      <ScoreInputs criteria={criteria} value={scores} onChange={setScores} />

      <p className="preview">
        Macht insgesamt: <Score value={complete ? ratingOverall(scores, criteria) : null} />
      </p>

      <label className="field">
        <span>
          Fazit <span className="hint">(optional)</span>
        </span>
        <textarea
          rows={4}
          maxLength={2000}
          placeholder="Wie war's? Was ist gut, was nervt?"
          value={fazit}
          onChange={(e) => setFazit(e.target.value)}
        />
      </label>

      {result.error && <p className="error">{result.error}</p>}
      {result.ok && <p className="ok">{result.ok}</p>}

      <div className="actions">
        <button className="btn primary" disabled={pending}>
          {mine ? 'Änderung speichern' : 'Bewertung abschicken'}
        </button>
        {mine && (
          <button type="button" className="linkish" onClick={remove} disabled={pending}>
            Bewertung löschen
          </button>
        )}
      </div>
    </form>
  )
}
