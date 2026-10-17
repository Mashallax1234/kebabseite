import Link from 'next/link'
import { SCORE } from '@/lib/config'
import { fmtNum, fmtScore } from '@/lib/format'
import { activeCriteria, tier, type Aggregate } from '@/lib/scores'
import type { Criterion } from '@/lib/data/types'

export function Score({ value, big }: { value: number | null | undefined; big?: boolean }) {
  return <span className={`score tier-${tier(value)}${big ? ' big' : ''}`}>{fmtScore(value)}</span>
}

/** Kleiner Balken aus 10 Kästchen, halbe Punkte = halbes Kästchen */
export function ScoreBar({ value }: { value: number | null | undefined }) {
  return (
    <span className="bar" aria-hidden="true">
      {Array.from({ length: SCORE.max }, (_, i) => {
        const n = i + 1
        const cls = value == null ? '' : value >= n ? 'full' : value >= n - 0.5 ? 'half' : ''
        return <i key={n} className={cls} />
      })}
    </span>
  )
}

export function Breakdown({ agg, criteria }: { agg: Aggregate; criteria: Criterion[] }) {
  return (
    <table className="breakdown">
      <tbody>
        {activeCriteria(criteria).map((c) => (
          <tr key={c.key}>
            <th>{c.label}</th>
            <td>
              <ScoreBar value={agg.perCriterion[c.key]} />
            </td>
            <td className="num">{fmtNum(agg.perCriterion[c.key])}</td>
          </tr>
        ))}
        <tr className="total">
          <th>Gesamt</th>
          <td />
          <td className="num">
            <Score value={agg.overall} big />
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function NeedLogin({ text = 'Dafür musst du eingeloggt sein.', back }: { text?: string; back?: string }) {
  const q = back ? '?weiter=' + encodeURIComponent(back) : ''
  return (
    <p className="box">
      {text} <Link href={'/login' + q}>Einloggen</Link> oder <Link href={'/registrieren' + q}>Konto anlegen</Link>.
    </p>
  )
}

export const STATUS_LABEL = { pending: 'offen', approved: 'angenommen', rejected: 'abgelehnt' } as const

export function StatusTag({ status }: { status: keyof typeof STATUS_LABEL }) {
  return <span className={'status status-' + status}>{STATUS_LABEL[status]}</span>
}
