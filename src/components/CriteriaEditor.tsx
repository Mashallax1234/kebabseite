'use client'
import { useState, useTransition } from 'react'
import { saveCriterionAction } from '@/app/actions'
import type { Criterion } from '@/lib/data/types'

function Row({ initial, isNew }: { initial: Criterion; isNew?: boolean }) {
  const [row, setRow] = useState(initial)
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({})
  const [pending, start] = useTransition()
  const set = <K extends keyof Criterion>(k: K, v: Criterion[K]) => {
    setMsg({})
    setRow((r) => ({ ...r, [k]: v }))
  }

  const save = () =>
    start(async () => {
      const r = await saveCriterionAction(row)
      setMsg(r)
      if (!r.error && isNew) setRow(initial)
    })

  return (
    <tr>
      <td>
        {isNew ? (
          <input type="text" placeholder="z. b. brot" value={row.key} onChange={(e) => set('key', e.target.value)} />
        ) : (
          <code>{row.key}</code>
        )}
      </td>
      <td>
        <input type="text" value={row.label} onChange={(e) => set('label', e.target.value)} />
      </td>
      <td>
        <input type="text" value={row.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </td>
      <td>
        <input type="number" className="short" value={row.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />
      </td>
      <td>
        <input type="checkbox" checked={row.active} onChange={(e) => set('active', e.target.checked)} />
      </td>
      <td>
        <button className="btn small" onClick={save} disabled={pending}>
          {isNew ? 'Anlegen' : 'Speichern'}
        </button>
        {msg.ok && !isNew && <span className="ok-inline"> ok</span>}
        {msg.error && <div className="error small">{msg.error}</div>}
      </td>
    </tr>
  )
}

export function CriteriaEditor({ criteria }: { criteria: Criterion[] }) {
  const nextSort = Math.max(0, ...criteria.map((c) => c.sortOrder)) + 1
  return (
    <div className="table-wrap">
      <table className="rank-table crit-table">
        <thead>
          <tr>
            <th>Schlüssel</th>
            <th>Name</th>
            <th>Beschreibung</th>
            <th>Reihenf.</th>
            <th>aktiv</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <Row key={c.key} initial={c} />
          ))}
          <Row key={'new-' + criteria.length} isNew initial={{ key: '', label: '', description: '', sortOrder: nextSort, active: true }} />
        </tbody>
      </table>
    </div>
  )
}
