import type { Metadata } from 'next'
import { SuggestForm } from '@/components/forms'
import { NeedLogin, StatusTag } from '@/components/ui'
import { getBackend, getCurrentUser } from '@/lib/data'
import { fmtDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Laden vorschlagen' }

export default async function SuggestPage() {
  const user = await getCurrentUser()
  const mine = user ? await (await getBackend()).listMySuggestions() : []

  return (
    <>
      <h1>Laden vorschlagen</h1>
      <p className="lead">
        Da fehlt einer? Schick ihn rein. Ein Admin schaut sich das an und trägt ihn ein, dann kann die Community loslegen. Oder eben nicht.
      </p>

      {!user ? (
        <NeedLogin text="Zum Vorschlagen brauchst du ein Konto." back="/vorschlagen" />
      ) : (
        <>
          <SuggestForm />
          <h2>Deine Vorschläge</h2>
          {mine.length ? (
            <ul className="plain-list">
              {mine.map((s) => (
                <li key={s.id}>
                  <b>{s.name}</b> <StatusTag status={s.status} />
                  <span className="muted small"> · {fmtDate(s.createdAt)}</span>
                  {s.adminNote && <div className="small">Antwort: „{s.adminNote}“</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Du hast noch nichts vorgeschlagen.</p>
          )}
        </>
      )}
    </>
  )
}
