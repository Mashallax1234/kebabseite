'use client'
import { SCORE } from '@/lib/config'
import { fmtNum } from '@/lib/format'
import { activeCriteria } from '@/lib/scores'
import type { Criterion, Scores } from '@/lib/data/types'

/**
 * Ein Schieberegler pro Kriterium. Noch nicht angefasste Kriterien sind
 * "leer" (grau) und müssen vor dem Speichern gesetzt werden.
 */
export function ScoreInputs({ criteria, value, onChange }: { criteria: Criterion[]; value: Scores; onChange: (s: Scores) => void }) {
  const middle = (SCORE.min + SCORE.max) / 2
  return (
    <div className="score-inputs">
      {activeCriteria(criteria).map((c) => {
        const v = value[c.key]
        const set = (x: string) => onChange({ ...value, [c.key]: Number(x) })
        return (
          <div key={c.key} className={'score-input' + (v == null ? ' unset' : '')}>
            <label htmlFor={'si-' + c.key}>
              <b>{c.label}</b> {c.description && <span className="hint">{c.description}</span>}
            </label>
            <div className="score-input-row">
              <span className="hint">{SCORE.min}</span>
              <input
                id={'si-' + c.key}
                type="range"
                min={SCORE.min}
                max={SCORE.max}
                step={SCORE.step}
                value={v ?? middle}
                onChange={(e) => set(e.target.value)}
                onClick={(e) => v == null && set(e.currentTarget.value)}
              />
              <span className="hint">{SCORE.max}</span>
              <output>{v == null ? '–' : fmtNum(v)}</output>
            </div>
          </div>
        )
      })}
    </div>
  )
}
